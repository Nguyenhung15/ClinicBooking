const { DoctorShift, User } = require('../models');
const { ROLES } = require('../constants/enums');
const ApiError = require('../utils/ApiError');
const { parsePositiveInt } = require('../utils/normalizers');
const env = require('../config/env');

const getTodayString = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.clinicTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getCurrentTimeString = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: env.clinicTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

const isValidDateString = (date) =>
  typeof date === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
  new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

/**
 * UC-PUB-01 & UC-PAT-03: Fetch active shifts and available slots for a doctor on a specific date.
 * Enforces:
 * - Active Doctor account check (404 if not found or inactive)
 * - Strict date validation YYYY-MM-DD
 * - Only ACTIVE shifts returned
 * - Slots past current time on today's date are marked UNAVAILABLE and not counted in availableSlots
 * - Strips any patient/appointment PII from slots
 */
async function getShiftsByDoctorAndDate(doctorIdParam, dateParam) {
  const doctorId = parsePositiveInt(doctorIdParam, 'doctorId');

  if (!dateParam || !isValidDateString(dateParam)) {
    throw new ApiError(400, 'date must be a valid YYYY-MM-DD date');
  }
  const date = dateParam;

  const doctor = await User.findOne({
    id: doctorId,
    userType: ROLES.DOCTOR,
    isEnable: true,
  }).lean();

  if (!doctor) {
    throw new ApiError(404, 'Bác sĩ không tồn tại hoặc đã ngừng hoạt động');
  }

  const shifts = await DoctorShift.find({
    doctorId: doctor.id,
    date,
    status: 'ACTIVE',
  })
    .sort({ startTime: 1 })
    .lean();

  const today = getTodayString();
  const currentTime = getCurrentTimeString();
  const isToday = date === today;
  const isPastDate = date < today;

  return shifts.map((shift) => {
    const rawSlots = Array.isArray(shift.slots) ? shift.slots : [];

    const sanitizedSlots = rawSlots.map((slot) => {
      let effectiveStatus = slot.status || 'AVAILABLE';

      // If the shift is in the past, or today and slot has already started, mark as UNAVAILABLE
      if (isPastDate || (isToday && slot.startTime <= currentTime)) {
        if (effectiveStatus === 'AVAILABLE') {
          effectiveStatus = 'UNAVAILABLE';
        }
      }

      return {
        id: slot.id,
        slotNumber: slot.slotNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: effectiveStatus,
        slotStatus: effectiveStatus,
      };
    });

    const availableSlots = sanitizedSlots.filter((s) => s.status === 'AVAILABLE').length;

    return {
      id: shift.id,
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      date: shift.date,
      shift: shift.shift,
      shiftType: shift.shift,
      name: shift.shift,
      startTime: shift.startTime,
      start: shift.startTime,
      endTime: shift.endTime,
      end: shift.endTime,
      maxPatients: shift.maxPatients,
      note: shift.note || '',
      status: shift.status,
      availableSlots,
      slots: sanitizedSlots,
    };
  });
}

module.exports = {
  getShiftsByDoctorAndDate,
  getTodayString,
  getCurrentTimeString,
};

