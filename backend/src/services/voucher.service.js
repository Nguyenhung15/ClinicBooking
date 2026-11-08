const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { parsePositiveInt, escapeRegex } = require('../utils/normalizers');
const { parseFlexibleDate } = require('../utils/dateParser');
const {
  ROLES,
  VOUCHER_TYPES,
  VOUCHER_TYPE_VALUES,
  AUDIT_ACTIONS,
} = require('../constants/enums');
const { Voucher, UserVoucher, User } = require('../models');
const { clock } = require('./clock.service');
const { recordAudit, buildAuditDiff, sanitizeSnapshot } = require('./audit.service');

/**
 * Build flexible query to find a Voucher by numeric ID, ObjectId, or code.
 */
function buildVoucherIdQuery(rawId, fieldName = 'voucherId') {
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

/**
 * Normalize a Voucher document into the frontend VoucherItem contract.
 */
function serializeVoucher(doc) {
  if (!doc) return null;
  const plain = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
  return {
    id: plain.id,
    code: plain.code,
    name: plain.name ?? null,
    discountValue: plain.discountValue ?? null,
    type: plain.type === VOUCHER_TYPES.DISCOUNT ? VOUCHER_TYPES.DISCOUNT : VOUCHER_TYPES.SERVICE_TICKET,
    enable: Boolean(plain.enable),
    expiryDate: plain.expiryDate
      ? (plain.expiryDate instanceof Date ? plain.expiryDate.toISOString() : String(plain.expiryDate))
      : null,
  };
}

/**
 * Normalize a UserVoucher record enriched with Voucher and User info.
 */
function serializeUserVoucher(userVoucherDoc, voucherDoc, userDoc = null) {
  const uv = typeof userVoucherDoc.toJSON === 'function' ? userVoucherDoc.toJSON() : userVoucherDoc;
  const v = voucherDoc
    ? (typeof voucherDoc.toJSON === 'function' ? voucherDoc.toJSON() : voucherDoc)
    : {};

  return {
    id: uv.id,
    voucherId: uv.voucherId ?? v.id,
    voucherCode: v.code || '',
    voucherName: v.name ?? null,
    discountValue: v.discountValue ?? null,
    type: v.type === VOUCHER_TYPES.DISCOUNT ? VOUCHER_TYPES.DISCOUNT : VOUCHER_TYPES.SERVICE_TICKET,
    expiryDate: v.expiryDate
      ? (v.expiryDate instanceof Date ? v.expiryDate.toISOString() : String(v.expiryDate))
      : null,
    issuedAt: uv.issuedAt
      ? (uv.issuedAt instanceof Date ? uv.issuedAt.toISOString() : String(uv.issuedAt))
      : null,
    used: Boolean(uv.used),
    usedAt: uv.usedAt
      ? (uv.usedAt instanceof Date ? uv.usedAt.toISOString() : String(uv.usedAt))
      : null,
    userId: uv.userId ?? (userDoc ? userDoc.id : null),
    userFullName: userDoc ? userDoc.fullName : undefined,
  };
}

/**
 * Validate and normalize payload for creating or updating a Voucher.
 */
function validateVoucherPayload(payload = {}, { isUpdate = false } = {}) {
  const result = {};

  if (!isUpdate || payload.code !== undefined) {
    const rawCode = typeof payload.code === 'string' ? payload.code.trim().toUpperCase() : '';
    if (!rawCode) {
      throw new ApiError(400, 'Mã voucher không được để trống');
    }
    if (rawCode.length > 64) {
      throw new ApiError(400, 'Mã voucher không được vượt quá 64 ký tự');
    }
    result.code = rawCode;
  }

  if (!isUpdate || payload.name !== undefined) {
    const rawName = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!rawName) {
      throw new ApiError(400, 'Tên voucher không được để trống');
    }
    if (rawName.length > 255) {
      throw new ApiError(400, 'Tên voucher không được vượt quá 255 ký tự');
    }
    result.name = rawName;
  }

  if (!isUpdate || payload.type !== undefined) {
    const rawType = typeof payload.type === 'string' ? payload.type.trim().toUpperCase() : '';
    if (!VOUCHER_TYPE_VALUES.includes(rawType)) {
      throw new ApiError(
        400,
        `Loại voucher không hợp lệ. Chỉ chấp nhận: ${VOUCHER_TYPE_VALUES.join(', ')}`,
      );
    }
    result.type = rawType;
  }

  const effectiveType = result.type || payload.type;

  if (!isUpdate || payload.discountValue !== undefined) {
    if (
      payload.discountValue === null ||
      payload.discountValue === undefined ||
      String(payload.discountValue).trim() === ''
    ) {
      if (effectiveType === VOUCHER_TYPES.DISCOUNT) {
        throw new ApiError(400, 'Voucher giảm giá bắt buộc phải có giá trị giảm (1-100%)');
      }
      result.discountValue = null;
    } else {
      const numVal = Number(payload.discountValue);
      if (!Number.isFinite(numVal) || numVal <= 0) {
        throw new ApiError(400, 'Giá trị ưu đãi phải là số dương');
      }
      if (effectiveType === VOUCHER_TYPES.DISCOUNT && (numVal <= 0 || numVal > 100)) {
        throw new ApiError(400, 'Giá trị giảm phần trăm phải nằm trong khoảng 1-100%');
      }
      result.discountValue = numVal;
    }
  }

  if (!isUpdate || payload.enable !== undefined) {
    result.enable = payload.enable === undefined ? true : Boolean(payload.enable);
  }

  if (!isUpdate || payload.expiryDate !== undefined) {
    result.expiryDate = parseFlexibleDate(payload.expiryDate, {
      fieldName: 'Hạn sử dụng (expiryDate)',
      required: !isUpdate,
    });
  }

  return result;
}

/**
 * List all vouchers (Admin, Receptionist).
 */
async function listAllVouchers() {
  const vouchers = await Voucher.find().sort({ expiryDate: 1, id: 1 }).lean();
  return vouchers.map(serializeVoucher);
}

/**
 * List active, non-expired public vouchers for Home page (Guest & Patient).
 */
async function listActivePublicVouchers() {
  const now = clock.now();
  const vouchers = await Voucher.find({
    enable: true,
    $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
  })
    .sort({ expiryDate: 1, id: -1 })
    .lean();

  return vouchers.map(serializeVoucher);
}

/**
 * Get a single voucher by ID.
 */
async function getVoucherById(id) {
  const query = buildVoucherIdQuery(id, 'voucherId');
  const voucher = await Voucher.findOne(query);
  if (!voucher) {
    throw new ApiError(404, 'Không tìm thấy voucher');
  }
  return serializeVoucher(voucher);
}

/**
 * Admin creates a new Voucher.
 */
async function createVoucher(actor, payload, req = null) {
  const validated = validateVoucherPayload(payload, { isUpdate: false });

  const existing = await Voucher.findOne({
    code: { $regex: `^${escapeRegex(validated.code)}$`, $options: 'i' },
  }).lean();

  if (existing) {
    throw new ApiError(409, `Mã voucher '${validated.code}' đã tồn tại`);
  }

  const created = await Voucher.create(validated);

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.VOUCHER_CREATE,
      targetType: 'Voucher',
      targetId: created.id,
      reason: 'Admin tạo voucher mới',
      changes: { before: null, after: sanitizeSnapshot(created) },
      req,
    });
  }

  return serializeVoucher(created);
}

/**
 * Admin updates an existing Voucher.
 */
async function updateVoucher(actor, id, payload, req = null) {
  const query = buildVoucherIdQuery(id, 'voucherId');
  const voucher = await Voucher.findOne(query);
  if (!voucher) {
    throw new ApiError(404, 'Không tìm thấy voucher');
  }

  const beforeSnap = sanitizeSnapshot(voucher);
  const validated = validateVoucherPayload(
    { ...voucher.toJSON(), ...payload },
    { isUpdate: true },
  );

  if (validated.code && validated.code !== voucher.code) {
    const conflict = await Voucher.findOne({
      id: { $ne: voucher.id },
      code: { $regex: `^${escapeRegex(validated.code)}$`, $options: 'i' },
    }).lean();
    if (conflict) {
      throw new ApiError(409, `Mã voucher '${validated.code}' đã tồn tại`);
    }
    voucher.code = validated.code;
  }

  if (validated.name !== undefined) voucher.name = validated.name;
  if (validated.type !== undefined) voucher.type = validated.type;
  if (validated.discountValue !== undefined) voucher.discountValue = validated.discountValue;
  if (validated.enable !== undefined) voucher.enable = validated.enable;
  if (validated.expiryDate !== undefined) voucher.expiryDate = validated.expiryDate;

  await voucher.save();

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.VOUCHER_UPDATE,
      targetType: 'Voucher',
      targetId: voucher.id,
      reason: 'Admin cập nhật voucher',
      changes: buildAuditDiff(beforeSnap, voucher),
      req,
    });
  }

  return serializeVoucher(voucher);
}

/**
 * Admin deletes a Voucher.
 */
async function deleteVoucher(actor, id, req = null) {
  const query = buildVoucherIdQuery(id, 'voucherId');
  const voucher = await Voucher.findOne(query);
  if (!voucher) {
    throw new ApiError(404, 'Không tìm thấy voucher');
  }

  const beforeSnap = sanitizeSnapshot(voucher);
  await Voucher.deleteOne({ id: voucher.id });

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.VOUCHER_DELETE,
      targetType: 'Voucher',
      targetId: voucher.id,
      reason: 'Admin xóa voucher',
      changes: { before: beforeSnap, after: null },
      req,
    });
  }

  return { deleted: true, id: voucher.id };
}

/**
 * Issue/claim a voucher for a specific user (idempotent if already owned).
 */
async function issueVoucherToUser(userId, voucherId, { actor = null, req = null, reason = 'Nhận voucher ưu đãi' } = {}) {
  const parsedUserId = parsePositiveInt(userId, 'userId');
  const query = buildVoucherIdQuery(voucherId, 'voucherId');

  const [user, voucher] = await Promise.all([
    User.findOne({ id: parsedUserId }).lean(),
    Voucher.findOne(query).lean(),
  ]);

  if (!user) {
    throw new ApiError(404, 'Người dùng không tồn tại');
  }
  if (!voucher) {
    throw new ApiError(404, 'Voucher không tồn tại');
  }
  if (!voucher.enable) {
    throw new ApiError(400, 'Voucher này hiện đã bị vô hiệu hóa');
  }

  const now = clock.now();
  if (voucher.expiryDate && new Date(voucher.expiryDate) <= now) {
    throw new ApiError(400, 'Voucher này đã hết hạn sử dụng');
  }

  // Idempotent upsert: if user already claimed this voucher, return existing UserVoucher
  let userVoucher = await UserVoucher.findOne({
    userId: parsedUserId,
    voucherId: voucher.id,
  });

  let isNewlyClaimed = false;
  if (!userVoucher) {
    try {
      userVoucher = await UserVoucher.create({
        userId: parsedUserId,
        voucherId: voucher.id,
        issuedAt: now,
        used: false,
      });
      isNewlyClaimed = true;
    } catch (err) {
      if (err.code === 11000) {
        userVoucher = await UserVoucher.findOne({
          userId: parsedUserId,
          voucherId: voucher.id,
        });
      } else {
        throw err;
      }
    }
  }

  if (isNewlyClaimed && actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.VOUCHER_CLAIM,
      targetType: 'UserVoucher',
      targetId: userVoucher.id,
      reason,
      changes: {
        userId: parsedUserId,
        voucherId: voucher.id,
        voucherCode: voucher.code,
      },
      req,
    });
  }

  return serializeUserVoucher(userVoucher, voucher, user);
}

/**
 * Patient claims an active public voucher from Home page or Voucher page.
 */
async function claimVoucherForPatient(actor, voucherId, req = null) {
  if (!actor || actor.userType !== ROLES.PATIENT) {
    throw new ApiError(403, 'Chỉ tài khoản bệnh nhân mới có thể lưu và sử dụng voucher');
  }
  return issueVoucherToUser(actor.id, voucherId, {
    actor,
    req,
    reason: 'Bệnh nhân lưu voucher từ trang chủ',
  });
}

/**
 * Helper to enrich a list of UserVoucher documents with their Voucher and User metadata.
 */
async function enrichUserVouchers(userVouchers, includeUserFullName = false) {
  if (!userVouchers.length) return [];

  const voucherIds = [...new Set(userVouchers.map((uv) => uv.voucherId))];
  const userIds = includeUserFullName
    ? [...new Set(userVouchers.map((uv) => uv.userId))]
    : [];

  const [vouchers, users] = await Promise.all([
    Voucher.find({ id: { $in: voucherIds } }).lean(),
    includeUserFullName
      ? User.find({ id: { $in: userIds } }).select('id fullName').lean()
      : Promise.resolve([]),
  ]);

  const voucherMap = new Map(vouchers.map((v) => [v.id, v]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  return userVouchers
    .filter((uv) => voucherMap.has(uv.voucherId))
    .map((uv) =>
      serializeUserVoucher(
        uv,
        voucherMap.get(uv.voucherId),
        userMap.get(uv.userId) || null,
      ),
    );
}

/**
 * Get all vouchers owned by the current authenticated Patient (`GET /vouchers/my`).
 */
async function getMyVouchers(actor) {
  if (!actor) {
    throw new ApiError(401, 'Vui lòng đăng nhập để xem danh sách voucher');
  }
  const userVouchers = await UserVoucher.find({ userId: actor.id })
    .sort({ used: 1, issuedAt: -1, id: -1 })
    .lean();

  return enrichUserVouchers(userVouchers, true);
}

/**
 * Get all owners of a specific voucher (`GET /vouchers/:voucherId/owners`).
 */
async function getVoucherOwners(voucherId) {
  const vId = parsePositiveInt(voucherId, 'voucherId');
  const voucher = await Voucher.findOne({ id: vId }).lean();
  if (!voucher) {
    throw new ApiError(404, 'Không tìm thấy voucher');
  }

  const userVouchers = await UserVoucher.find({ voucherId: vId })
    .sort({ issuedAt: -1, id: -1 })
    .lean();

  return enrichUserVouchers(userVouchers, true);
}

/**
 * Get all vouchers owned by a specific userId (`GET /vouchers/user/:userId`) for Receptionist/Admin.
 */
async function getUserVouchers(userId) {
  const uId = parsePositiveInt(userId, 'userId');
  const user = await User.findOne({ id: uId }).select('id fullName').lean();
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  const userVouchers = await UserVoucher.find({ userId: uId })
    .sort({ used: 1, issuedAt: -1, id: -1 })
    .lean();

  return enrichUserVouchers(userVouchers, true);
}

/**
 * Mark a user's voucher as used (`POST /vouchers/:voucherId/use?userId=...`).
 * Note: `RecepVouchers.tsx` passes `owner.id` (which is `userVoucher.id`) as `:voucherId`,
 * whereas some callers may pass `voucher.id`. We support both seamlessly!
 */
async function markVoucherUsedForUser(actor, voucherOrUserVoucherId, queryUserId, req = null) {
  const targetId = parsePositiveInt(voucherOrUserVoucherId, 'voucherId');
  const userId = parsePositiveInt(queryUserId, 'userId');

  const user = await User.findOne({ id: userId }).select('id fullName').lean();
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng sở hữu voucher');
  }

  // First try matching by UserVoucher.id + userId (as sent by RecepVouchers.tsx L115),
  // fallback to matching by voucherId + userId.
  let userVoucher = await UserVoucher.findOne({ id: targetId, userId });
  if (!userVoucher) {
    userVoucher = await UserVoucher.findOne({ voucherId: targetId, userId });
  }

  if (!userVoucher) {
    throw new ApiError(404, 'Người dùng không sở hữu voucher này');
  }

  const voucher = await Voucher.findOne({ id: userVoucher.voucherId }).lean();
  if (!voucher) {
    throw new ApiError(404, 'Thông tin gốc của voucher không tồn tại');
  }

  if (userVoucher.used) {
    throw new ApiError(409, 'Voucher này đã được sử dụng trước đó');
  }

  if (!voucher.enable) {
    throw new ApiError(400, 'Voucher đã bị vô hiệu hóa, không thể áp dụng');
  }

  const now = clock.now();
  if (voucher.expiryDate && new Date(voucher.expiryDate) <= now) {
    throw new ApiError(400, 'Voucher đã hết hạn sử dụng');
  }

  const updated = await UserVoucher.findOneAndUpdate(
    { id: userVoucher.id, used: false },
    { $set: { used: true, usedAt: now } },
    { returnDocument: 'after' },
  );

  if (!updated) {
    throw new ApiError(409, 'Voucher đã được sử dụng bởi một yêu cầu khác');
  }

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.VOUCHER_USE,
      targetType: 'UserVoucher',
      targetId: updated.id,
      reason: 'Đánh dấu sử dụng voucher cho bệnh nhân',
      changes: {
        userId,
        voucherId: voucher.id,
        voucherCode: voucher.code,
        used: true,
        usedAt: now,
      },
      req,
    });
  }

  return serializeUserVoucher(updated, voucher, user);
}

/**
 * Calculate discount amount for an appointment total given a Voucher.
 * - DISCOUNT: percentage (1-100%) of totalAmount
 * - SERVICE_TICKET: fixed amount (in VND; if value <= 1000, e.g. 50 points, or direct VND;
 *   if value <= 1000 we treat 1 point = 1,000 VND, otherwise direct VND amount, capped at totalAmount).
 */
function calculateVoucherDiscount(voucher, totalAmount) {
  if (!voucher || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { discountAmount: 0, finalAmount: Math.max(0, totalAmount || 0) };
  }

  const rawVal = Number(voucher.discountValue) || 0;
  if (rawVal <= 0) {
    return { discountAmount: 0, finalAmount: totalAmount };
  }

  let discountAmount = 0;
  if (voucher.type === VOUCHER_TYPES.DISCOUNT) {
    const pct = Math.min(100, Math.max(0, rawVal));
    discountAmount = Math.round((totalAmount * pct) / 100);
  } else {
    // SERVICE_TICKET: if value is small (e.g. 50 or 100 points), convert 1 point = 1,000 VND; if >= 1000, treat as VND
    const monetaryValue = rawVal < 1000 ? rawVal * 1000 : rawVal;
    discountAmount = Math.min(totalAmount, Math.round(monetaryValue));
  }

  const finalAmount = Math.max(0, totalAmount - discountAmount);
  return { discountAmount, finalAmount };
}

/**
 * Validate and atomically consume a voucher during patient appointment booking.
 * If the patient hasn't claimed the public active voucher yet, auto-issues and consumes it atomically!
 */
async function consumeVoucherForBooking({
  userId,
  voucherId,
  voucherCode,
  totalAmount,
}) {
  if (!voucherId && !voucherCode) {
    return null;
  }

  const now = clock.now();
  let voucher = null;

  if (voucherId) {
    const vId = parsePositiveInt(voucherId, 'voucherId');
    voucher = await Voucher.findOne({ id: vId }).lean();
  } else if (typeof voucherCode === 'string' && voucherCode.trim()) {
    const cleanCode = voucherCode.trim().toUpperCase();
    voucher = await Voucher.findOne({
      code: { $regex: `^${escapeRegex(cleanCode)}$`, $options: 'i' },
    }).lean();
  }

  if (!voucher) {
    throw new ApiError(404, 'Mã voucher không tồn tại');
  }
  if (!voucher.enable) {
    throw new ApiError(400, 'Voucher này hiện không còn hoạt động');
  }
  if (voucher.expiryDate && new Date(voucher.expiryDate) <= now) {
    throw new ApiError(400, 'Voucher này đã hết hạn sử dụng');
  }

  // Ensure UserVoucher exists for this patient (auto-claim if selecting directly from active vouchers)
  let userVoucher = await UserVoucher.findOne({
    userId,
    voucherId: voucher.id,
  });

  if (userVoucher && userVoucher.used) {
    throw new ApiError(409, `Bạn đã sử dụng mã voucher '${voucher.code}' trước đó`);
  }

  if (!userVoucher) {
    try {
      userVoucher = await UserVoucher.create({
        userId,
        voucherId: voucher.id,
        issuedAt: now,
        used: true,
        usedAt: now,
      });
    } catch (err) {
      if (err.code === 11000) {
        const consumed = await UserVoucher.findOneAndUpdate(
          { userId, voucherId: voucher.id, used: false },
          { $set: { used: true, usedAt: now } },
          { returnDocument: 'after' },
        );
        if (!consumed) {
          throw new ApiError(409, `Mã voucher '${voucher.code}' đã được sử dụng`);
        }
        userVoucher = consumed;
      } else {
        throw err;
      }
    }
  } else {
    const consumed = await UserVoucher.findOneAndUpdate(
      { id: userVoucher.id, used: false },
      { $set: { used: true, usedAt: now } },
      { returnDocument: 'after' },
    );
    if (!consumed) {
      throw new ApiError(409, `Mã voucher '${voucher.code}' đã được sử dụng`);
    }
    userVoucher = consumed;
  }

  const { discountAmount, finalAmount } = calculateVoucherDiscount(voucher, totalAmount);

  return {
    voucher,
    userVoucher,
    discountAmount,
    originalAmount: totalAmount,
    finalAmount,
  };
}

/**
 * Rollback a consumed UserVoucher if appointment creation fails or is cancelled.
 */
async function releaseConsumedUserVoucher(userVoucherId) {
  if (!userVoucherId) return;
  try {
    await UserVoucher.updateOne(
      { id: userVoucherId },
      { $set: { used: false, usedAt: null, appointmentId: null } },
    );
  } catch (err) {
    console.error('[releaseConsumedUserVoucher] Failed to rollback userVoucher:', err);
  }
}

module.exports = {
  listAllVouchers,
  listActivePublicVouchers,
  getVoucherById,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  issueVoucherToUser,
  claimVoucherForPatient,
  getMyVouchers,
  getVoucherOwners,
  getUserVouchers,
  markVoucherUsedForUser,
  calculateVoucherDiscount,
  consumeVoucherForBooking,
  releaseConsumedUserVoucher,
  serializeVoucher,
  serializeUserVoucher,
};
