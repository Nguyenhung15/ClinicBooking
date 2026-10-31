const { Appointment, DoctorShift, User, Specialty } = require('../models');
const { ROLES, APPOINTMENT_STATUSES, AUDIT_ACTIONS } = require('../constants/enums');
const { appointmentStateService } = require('./appointmentState.service');
const { clock } = require('./clock.service');
const ApiError = require('../utils/ApiError');

/**
 * Build flexible query for Appointment identifier.
 * @param {string|number} identifier
 * @returns {Record<string, any>}
 */
function buildAppointmentQuery(identifier) {
  if (identifier === null || identifier === undefined) {
    throw new ApiError(400, 'Mã lịch hẹn không được để trống');
  }

  const str = String(identifier).trim();
  const num = Number(str);
  const conditions = [];

  if (Number.isSafeInteger(num) && num > 0) {
    conditions.push({ id: num });
  }
  if (str.length === 24 && /^[0-9a-fA-F]{24}$/.test(str)) {
    conditions.push({ _id: str });
  }
  conditions.push({ appointmentNo: str });

  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

/**
 * Check if the appointment's scheduled date and time is already in the past.
 * @param {string} appointmentDate "YYYY-MM-DD"
 * @param {string} appointmentTime "HH:mm"
 * @returns {boolean}
 */
function isAppointmentExpired(appointmentDate, appointmentTime) {
  const today = clock.today();
  if (appointmentDate < today) {
    return true;
  }
  if (appointmentDate === today && appointmentTime) {
    const currentTime = clock.currentTime();
    if (appointmentTime < currentTime) {
      return true;
    }
  }
  return false;
}

/**
 * UC-REC-03: Receptionist / Admin confirms an appointment.
 * 
 * Rules:
 * - Allowed roles: RECEPTIONIST, ADMIN.
 * - Only PENDING_CONFIRMATION -> CONFIRMED via AppointmentStateService.
 * - Records confirmedBy = userId from JWT (or authPrincipal) and confirmedAt (UTC).
 * - If already CONFIRMED: returns current state, HTTP 200 (idempotent).
 * - If in CANCELLED / EXPIRED / COMPLETED / etc.: HTTP 409 INVALID_STATE.
 * - Validates appointment is still valid (not expired, shift still ACTIVE); otherwise 409.
 * - If appointment does not exist: 404 APPOINTMENT_NOT_FOUND.
 * - Records Outbox event to notify patient via email.
 * - Records Audit log CONFIRM_APPOINTMENT.
 * - Concurrent requests: only one writes state change, both receive CONFIRMED.
 *
 * @param {object} actor - Authenticated user principal { userId, role, email, fullName }
 * @param {string|number} appointmentId - Numeric id, ObjectId string, or appointmentNo
 * @returns {Promise<object>} Result containing appointment and status
 */
async function confirmAppointment(actor, appointmentId) {
  // 1. Role verification (defense-in-depth, service layer)
  const allowedRoles = [ROLES.RECEPTIONIST, ROLES.ADMIN];
  const actorRole = actor?.role || actor?.userType;
  if (!actor || !allowedRoles.includes(actorRole)) {
    throw new ApiError(403, 'Chỉ Lễ tân hoặc Quản trị viên mới có quyền xác nhận lịch hẹn', 'FORBIDDEN_ROLE');
  }

  // 2. Fetch appointment to inspect current state & validity
  const query = buildAppointmentQuery(appointmentId);
  const appointment = await Appointment.findOne(query);

  if (!appointment) {
    throw new ApiError(404, `Không tìm thấy lịch hẹn với định danh: ${appointmentId}`, 'APPOINTMENT_NOT_FOUND');
  }

  // 3. Idempotency fast check: if already CONFIRMED, return current state directly (HTTP 200)
  if (appointment.status === APPOINTMENT_STATUSES.CONFIRMED) {
    return {
      appointment: appointment.toJSON ? appointment.toJSON() : appointment,
      status: APPOINTMENT_STATUSES.CONFIRMED,
      idempotent: true,
      message: 'Lịch hẹn đã được xác nhận trước đó',
    };
  }

  // 4. State validation: only PENDING_CONFIRMATION can be transitioned to CONFIRMED
  if (appointment.status !== APPOINTMENT_STATUSES.PENDING_CONFIRMATION) {
    throw new ApiError(
      409,
      `Không thể xác nhận lịch hẹn ở trạng thái '${appointment.status}'. Chỉ chấp nhận lịch đang ở trạng thái 'PENDING_CONFIRMATION'`,
      'INVALID_STATE',
    );
  }

  // 5. Validity check: Check if appointment date/time is expired
  if (isAppointmentExpired(appointment.appointmentDate, appointment.appointmentTime)) {
    throw new ApiError(
      409,
      `Lịch hẹn ngày ${appointment.appointmentDate} lúc ${appointment.appointmentTime} đã quá hạn, không thể xác nhận`,
      'APPOINTMENT_EXPIRED',
    );
  }

  // 6. Validity check: Check if shift still exists and is ACTIVE
  const shift = await DoctorShift.findOne({ id: appointment.shiftId });
  if (!shift || shift.status !== 'ACTIVE') {
    throw new ApiError(
      409,
      'Ca trực tương ứng của bác sĩ không còn tồn tại hoặc không ở trạng thái hoạt động (ACTIVE)',
      'SHIFT_NOT_ACTIVE',
    );
  }

  // 7. Fetch patient info for outbox email notification payload
  let patientEmail = null;
  let patientName = null;
  try {
    const patientUser = await User.findOne({ id: appointment.patientId }).select('email fullName').lean();
    if (patientUser) {
      patientEmail = patientUser.email;
      patientName = patientUser.fullName;
    }
  } catch (err) {
    // Non-critical: outbox will still be created with patientId
  }

  // 8. Execute atomic state transition via AppointmentStateService
  // State machine guarantees:
  // - Conditional atomic update { _id, status: 'PENDING_CONFIRMATION' } -> 'CONFIRMED'
  // - Sets confirmedBy = actor.userId, confirmedAt = nowUtc
  // - Idempotent concurrent resolution (second racer gets fresh CONFIRMED document)
  // - Creates Outbox event and Audit log
  const transitionResult = await appointmentStateService.transition({
    appointmentId: appointment.id || appointment._id,
    fromStatus: [APPOINTMENT_STATUSES.PENDING_CONFIRMATION],
    toStatus: APPOINTMENT_STATUSES.CONFIRMED,
    actor: {
      userId: String(actor.userId || actor.id),
      role: actorRole,
      email: actor.email,
    },
    extraFields: {
      confirmedBy: Number(actor.userId) || actor.userId,
    },
    options: {
      auditAction: AUDIT_ACTIONS.CONFIRM_APPOINTMENT,
      outboxEventType: 'APPOINTMENT_CONFIRMED',
      outboxChannel: 'EMAIL',
      outboxPayload: {
        recipientEmail: patientEmail,
        recipientName: patientName,
        appointmentNo: appointment.appointmentNo,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        type: appointment.type,
      },
    },
  });

  return {
    appointment: transitionResult.appointment,
    status: transitionResult.status,
    idempotent: transitionResult.idempotent,
    message: transitionResult.idempotent
      ? 'Lịch hẹn đã được xác nhận trước đó'
      : 'Xác nhận lịch hẹn thành công',
  };
}

module.exports = {
  buildAppointmentQuery,
  isAppointmentExpired,
  confirmAppointment,
};
