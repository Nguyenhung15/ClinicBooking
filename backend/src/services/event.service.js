const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { parsePositiveInt } = require('../utils/normalizers');
const { parseFlexibleDate } = require('../utils/dateParser');
const {
  ROLES,
  AUDIT_ACTIONS,
  EVENT_REGISTRATION_STATUSES,
} = require('../constants/enums');
const { Event, UserEvent, Voucher, User } = require('../models');
const { clock } = require('./clock.service');
const { recordAudit, buildAuditDiff, sanitizeSnapshot } = require('./audit.service');
const voucherService = require('./voucher.service');

/**
 * Build flexible query to find an Event by numeric ID or ObjectId.
 */
function buildEventIdQuery(rawId, fieldName = 'eventId') {
  if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
    throw new ApiError(400, `${fieldName} không hợp lệ`);
  }
  const str = String(rawId).trim();
  const num = Number(str);
  if (Number.isInteger(num) && num > 0) {
    return { id: num };
  }
  if (mongoose.Types.ObjectId.isValid(str)) {
    return { _id: new mongoose.Types.ObjectId(str) };
  }
  throw new ApiError(400, `${fieldName} không hợp lệ`);
}

function toIsoOrNull(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime()) ? String(val) : parsed.toISOString();
}

/**
 * Normalize an Event document with optional Voucher details to match Frontend EventItem & ReceptionEventItem.
 */
function serializeEvent(eventDoc, voucherDoc = null, extras = {}) {
  if (!eventDoc) return null;
  const e = typeof eventDoc.toJSON === 'function' ? eventDoc.toJSON() : eventDoc;
  const v = voucherDoc
    ? (typeof voucherDoc.toJSON === 'function' ? voucherDoc.toJSON() : voucherDoc)
    : null;

  const isEnabled = Boolean(e.isEnabled ?? e.enabled ?? true);

  return {
    id: e.id,
    title: e.title || '',
    description: e.description ?? null,
    location: e.location ?? null,
    startDate: toIsoOrNull(e.startDate),
    endDate: toIsoOrNull(e.endDate),
    isEnabled,
    enabled: isEnabled, // Used by RecepEvents.tsx (normalizeReceptionEvent)
    voucherId: e.voucherId ?? (v ? v.id : null),
    voucherCode: v ? v.code : null,
    voucherName: v ? v.name : null,
    ...extras,
  };
}

/**
 * Enrich an array of Event documents with their associated Voucher info.
 */
async function enrichEventsWithVouchers(events) {
  if (!events.length) return [];
  const voucherIds = [
    ...new Set(events.map((e) => e.voucherId).filter((id) => Number.isInteger(id) && id > 0)),
  ];

  const vouchers = voucherIds.length
    ? await Voucher.find({ id: { $in: voucherIds } }).lean()
    : [];
  const voucherMap = new Map(vouchers.map((v) => [v.id, v]));

  return events.map((e) => serializeEvent(e, voucherMap.get(e.voucherId) || null));
}

/**
 * Validate and normalize payload for creating or updating an Event.
 */
async function validateEventPayload(payload = {}, { isUpdate = false } = {}) {
  const result = {};

  if (!isUpdate || payload.title !== undefined) {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) {
      throw new ApiError(400, 'Tiêu đề sự kiện không được để trống');
    }
    if (title.length > 255) {
      throw new ApiError(400, 'Tiêu đề sự kiện không được vượt quá 255 ký tự');
    }
    result.title = title;
  }

  if (!isUpdate || payload.description !== undefined) {
    if (payload.description === null || payload.description === undefined || String(payload.description).trim() === '') {
      result.description = null;
    } else {
      result.description = String(payload.description).trim();
    }
  }

  if (!isUpdate || payload.location !== undefined) {
    if (payload.location === null || payload.location === undefined || String(payload.location).trim() === '') {
      result.location = null;
    } else {
      result.location = String(payload.location).trim().slice(0, 255);
    }
  }

  if (!isUpdate || payload.startDate !== undefined) {
    result.startDate = parseFlexibleDate(payload.startDate, {
      fieldName: 'Thời gian bắt đầu (startDate)',
      required: !isUpdate,
    });
  }

  if (!isUpdate || payload.endDate !== undefined) {
    result.endDate = parseFlexibleDate(payload.endDate, {
      fieldName: 'Thời gian kết thúc (endDate)',
      required: !isUpdate,
    });
  }

  const effectiveStart = result.startDate || (payload.startDate ? new Date(payload.startDate) : null);
  const effectiveEnd = result.endDate || (payload.endDate ? new Date(payload.endDate) : null);
  if (effectiveStart && effectiveEnd && effectiveStart.getTime() > effectiveEnd.getTime()) {
    throw new ApiError(400, 'Thời gian kết thúc phải sau thời gian bắt đầu');
  }

  if (!isUpdate || payload.isEnabled !== undefined) {
    result.isEnabled = payload.isEnabled === undefined ? true : Boolean(payload.isEnabled);
  }

  if (!isUpdate || payload.voucherId !== undefined) {
    if (
      payload.voucherId === null ||
      payload.voucherId === undefined ||
      String(payload.voucherId).trim() === ''
    ) {
      result.voucherId = null;
    } else {
      const vId = parsePositiveInt(payload.voucherId, 'voucherId');
      const voucher = await Voucher.findOne({ id: vId }).lean();
      if (!voucher) {
        throw new ApiError(404, `Voucher với ID #${vId} không tồn tại`);
      }
      result.voucherId = voucher.id;
    }
  }

  return result;
}

/**
 * List available public events for Home page (`GET /events`).
 * Returns enabled events whose endDate has not passed (or all enabled if none future).
 * If an authenticated patient calls this, also attaches `registrationStatus`.
 */
async function listPublicAvailableEvents(actor = null) {
  const now = clock.now();
  const events = await Event.find({
    isEnabled: true,
    endDate: { $gte: now },
  })
    .sort({ startDate: 1, id: 1 })
    .lean();

  const enriched = await enrichEventsWithVouchers(events);

  if (actor && actor.userType === ROLES.PATIENT && enriched.length > 0) {
    const eventIds = enriched.map((e) => e.id);
    const registrations = await UserEvent.find({
      userId: actor.id,
      eventId: { $in: eventIds },
    }).lean();
    const statusMap = new Map(registrations.map((r) => [r.eventId, r.status]));
    return enriched.map((e) =>
      statusMap.has(e.id) ? { ...e, registrationStatus: statusMap.get(e.id) } : e,
    );
  }

  return enriched;
}

/**
 * List all events for Admin (`GET /events/all`).
 */
async function listAllEvents() {
  const events = await Event.find().sort({ startDate: -1, id: -1 }).lean();
  return enrichEventsWithVouchers(events);
}

/**
 * Admin creates a new Event (`POST /events/create`).
 */
async function createEvent(actor, payload, req = null) {
  const validated = await validateEventPayload(payload, { isUpdate: false });
  const created = await Event.create(validated);

  const voucher = created.voucherId
    ? await Voucher.findOne({ id: created.voucherId }).lean()
    : null;

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.EVENT_CREATE,
      targetType: 'Event',
      targetId: created.id,
      reason: 'Admin tạo sự kiện mới',
      changes: { before: null, after: sanitizeSnapshot(created) },
      req,
    });
  }

  return serializeEvent(created, voucher);
}

/**
 * Admin updates an existing Event (`PUT /events/update/:id`).
 */
async function updateEvent(actor, id, payload, req = null) {
  const query = buildEventIdQuery(id, 'eventId');
  const event = await Event.findOne(query);
  if (!event) {
    throw new ApiError(404, 'Không tìm thấy sự kiện');
  }

  const beforeSnap = sanitizeSnapshot(event);
  const validated = await validateEventPayload(
    { ...event.toJSON(), ...payload },
    { isUpdate: true },
  );

  if (validated.title !== undefined) event.title = validated.title;
  if (validated.description !== undefined) event.description = validated.description;
  if (validated.location !== undefined) event.location = validated.location;
  if (validated.startDate !== undefined) event.startDate = validated.startDate;
  if (validated.endDate !== undefined) event.endDate = validated.endDate;
  if (validated.isEnabled !== undefined) event.isEnabled = validated.isEnabled;
  if (validated.voucherId !== undefined) event.voucherId = validated.voucherId;

  await event.save();

  const voucher = event.voucherId
    ? await Voucher.findOne({ id: event.voucherId }).lean()
    : null;

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.EVENT_UPDATE,
      targetType: 'Event',
      targetId: event.id,
      reason: 'Admin cập nhật sự kiện',
      changes: buildAuditDiff(beforeSnap, event),
      req,
    });
  }

  return serializeEvent(event, voucher);
}

/**
 * Admin deletes an Event (`DELETE /events/delete/:id`).
 */
async function deleteEvent(actor, id, req = null) {
  const query = buildEventIdQuery(id, 'eventId');
  const event = await Event.findOne(query);
  if (!event) {
    throw new ApiError(404, 'Không tìm thấy sự kiện');
  }

  const beforeSnap = sanitizeSnapshot(event);
  await Promise.all([
    Event.deleteOne({ id: event.id }),
    UserEvent.deleteMany({ eventId: event.id }),
  ]);

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.EVENT_DELETE,
      targetType: 'Event',
      targetId: event.id,
      reason: 'Admin xóa sự kiện',
      changes: { before: beforeSnap, after: null },
      req,
    });
  }

  return { deleted: true, id: event.id };
}

/**
 * Patient registers for an Event (`POST /events/:eventId/register`).
 */
async function registerForEvent(actor, eventId, req = null) {
  if (!actor || actor.userType !== ROLES.PATIENT) {
    throw new ApiError(403, 'Chỉ tài khoản bệnh nhân mới có thể đăng ký tham gia sự kiện');
  }

  const query = buildEventIdQuery(eventId, 'eventId');
  const event = await Event.findOne(query).lean();
  if (!event) {
    throw new ApiError(404, 'Sự kiện không tồn tại');
  }
  if (!event.isEnabled) {
    throw new ApiError(400, 'Sự kiện này hiện đã đóng hoặc bị ẩn');
  }

  const now = clock.now();
  if (event.endDate && new Date(event.endDate) < now) {
    throw new ApiError(400, 'Sự kiện này đã kết thúc');
  }

  const existing = await UserEvent.findOne({
    eventId: event.id,
    userId: actor.id,
  });

  if (existing) {
    throw new ApiError(409, 'Bạn đã đăng ký tham gia sự kiện này rồi');
  }

  let created;
  try {
    created = await UserEvent.create({
      eventId: event.id,
      userId: actor.id,
      status: EVENT_REGISTRATION_STATUSES.PENDING,
      registeredAt: now,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'Bạn đã đăng ký tham gia sự kiện này rồi');
    }
    throw err;
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.EVENT_REGISTER,
    targetType: 'UserEvent',
    targetId: created.id,
    reason: 'Bệnh nhân đăng ký tham gia sự kiện',
    changes: {
      eventId: event.id,
      eventTitle: event.title,
      userId: actor.id,
      status: created.status,
    },
    req,
  });

  return {
    id: created.id,
    eventId: event.id,
    userId: actor.id,
    status: created.status,
    registeredAt: toIsoOrNull(created.registeredAt),
  };
}

/**
 * Patient views their registered events (`GET /events/my`).
 * Matches `patientEvents.ts` (`fetchMyEvents` & `fetchRegisteredEventIds`):
 * `{ id, eventId, eventName, title, eventDescription, eventLocation, eventStart, eventEnd, status, registeredAt }`.
 */
async function getMyRegisteredEvents(actor) {
  if (!actor) {
    throw new ApiError(401, 'Vui lòng đăng nhập để xem sự kiện của bạn');
  }

  const userEvents = await UserEvent.find({ userId: actor.id })
    .sort({ registeredAt: -1, id: -1 })
    .lean();

  if (!userEvents.length) return [];

  const eventIds = [...new Set(userEvents.map((ue) => ue.eventId))];
  const events = await Event.find({ id: { $in: eventIds } }).lean();
  const eventMap = new Map(events.map((e) => [e.id, e]));

  return userEvents
    .filter((ue) => eventMap.has(ue.eventId))
    .map((ue) => {
      const ev = eventMap.get(ue.eventId);
      const startIso = toIsoOrNull(ev.startDate);
      const endIso = toIsoOrNull(ev.endDate);
      return {
        id: ue.id,
        eventId: ev.id,
        title: ev.title,
        eventName: ev.title,
        description: ev.description ?? null,
        eventDescription: ev.description ?? null,
        location: ev.location ?? null,
        eventLocation: ev.location ?? null,
        startDate: startIso,
        eventStart: startIso,
        endDate: endIso,
        eventEnd: endIso,
        status: ue.status || EVENT_REGISTRATION_STATUSES.PENDING,
        registeredAt: toIsoOrNull(ue.registeredAt),
      };
    });
}

/**
 * Receptionist / Admin lists all events with their participant registrations (`GET /reception/events`).
 * Matches `receptionist.ts` (`normalizeReceptionEvent` & `normalizeParticipant`).
 */
async function listEventsForReception() {
  const events = await Event.find().sort({ startDate: -1, id: -1 }).lean();
  if (!events.length) return [];

  const eventIds = events.map((e) => e.id);
  const voucherIds = [
    ...new Set(events.map((e) => e.voucherId).filter((id) => Number.isInteger(id) && id > 0)),
  ];

  const [userEvents, vouchers] = await Promise.all([
    UserEvent.find({ eventId: { $in: eventIds } }).sort({ registeredAt: 1, id: 1 }).lean(),
    voucherIds.length ? Voucher.find({ id: { $in: voucherIds } }).lean() : Promise.resolve([]),
  ]);

  const userIds = [...new Set(userEvents.map((ue) => ue.userId))];
  const users = userIds.length
    ? await User.find({ id: { $in: userIds } })
        .select('id fullName email phoneNumber')
        .lean()
    : [];

  const userMap = new Map(users.map((u) => [u.id, u]));
  const voucherMap = new Map(vouchers.map((v) => [v.id, v]));

  const registrationsByEvent = new Map();
  for (const ue of userEvents) {
    const u = userMap.get(ue.userId);
    const participant = {
      id: ue.id,
      userId: ue.userId,
      userFullName: u?.fullName ?? null,
      userEmail: u?.email ?? null,
      userPhone: u?.phoneNumber ?? null,
      status: ue.status || EVENT_REGISTRATION_STATUSES.PENDING,
      registeredAt: toIsoOrNull(ue.registeredAt),
    };
    if (!registrationsByEvent.has(ue.eventId)) {
      registrationsByEvent.set(ue.eventId, []);
    }
    registrationsByEvent.get(ue.eventId).push(participant);
  }

  return events.map((e) =>
    serializeEvent(e, voucherMap.get(e.voucherId) || null, {
      registrations: registrationsByEvent.get(e.id) || [],
    }),
  );
}

/**
 * Receptionist / Admin confirms participant attendance at an event (`POST /reception/events/:eventId/confirm/:userId`).
 * Automatically issues the event's attached Voucher (`UserVoucher`) to the participant if configured!
 */
async function confirmEventAttendance(actor, eventId, userId, req = null) {
  const eId = parsePositiveInt(eventId, 'eventId');
  const uId = parsePositiveInt(userId, 'userId');

  const [event, user] = await Promise.all([
    Event.findOne({ id: eId }).lean(),
    User.findOne({ id: uId }).select('id fullName email phoneNumber').lean(),
  ]);

  if (!event) {
    throw new ApiError(404, 'Không tìm thấy sự kiện');
  }
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng đăng ký');
  }

  const registration = await UserEvent.findOne({ eventId: eId, userId: uId });
  if (!registration) {
    throw new ApiError(404, 'Người dùng chưa đăng ký tham gia sự kiện này');
  }

  const now = clock.now();
  if (registration.status !== EVENT_REGISTRATION_STATUSES.CONFIRMED) {
    registration.status = EVENT_REGISTRATION_STATUSES.CONFIRMED;
    registration.confirmedAt = now;
    registration.confirmedBy = actor ? actor.id : null;
    await registration.save();
  }

  // If the event has an attached voucher, automatically issue UserVoucher to the participant
  let issuedVoucher = null;
  if (event.voucherId) {
    try {
      const voucher = await Voucher.findOne({ id: event.voucherId }).lean();
      if (voucher && voucher.enable && (!voucher.expiryDate || new Date(voucher.expiryDate) > now)) {
        issuedVoucher = await voucherService.issueVoucherToUser(uId, event.voucherId, {
          actor,
          req,
          reason: `Tặng voucher khi check-in sự kiện: ${event.title}`,
        });
      }
    } catch (voucherErr) {
      // Do not fail check-in if voucher is expired or disabled
      console.warn('[confirmEventAttendance] Could not auto-issue voucher:', voucherErr.message);
    }
  }

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.EVENT_CHECKIN,
      targetType: 'UserEvent',
      targetId: registration.id,
      reason: 'Lễ tân xác nhận check-in sự kiện cho bệnh nhân',
      changes: {
        eventId: eId,
        eventTitle: event.title,
        userId: uId,
        status: EVENT_REGISTRATION_STATUSES.CONFIRMED,
        issuedVoucherId: issuedVoucher?.voucherId ?? null,
      },
      req,
    });
  }

  return {
    id: registration.id,
    userId: uId,
    userFullName: user.fullName ?? null,
    userEmail: user.email ?? null,
    userPhone: user.phoneNumber ?? null,
    status: registration.status,
    registeredAt: toIsoOrNull(registration.registeredAt),
    issuedVoucher,
  };
}

module.exports = {
  listPublicAvailableEvents,
  listAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  registerForEvent,
  getMyRegisteredEvents,
  listEventsForReception,
  confirmEventAttendance,
  serializeEvent,
};

