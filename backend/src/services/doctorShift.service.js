const { DoctorShift, getNextSequence } = require('../models');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

const SHIFT_TIMES = {
  MORNING: { startTime: '08:00', endTime: '12:00' },
  AFTERNOON: { startTime: '13:00', endTime: '17:00' },
  EVENING: { startTime: '18:00', endTime: '21:00' },
};
const SLOT_DURATION_MINUTES = 45;
const BUFFER_MINUTES = 15;
const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: env.clinicTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const currentTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: env.clinicTimeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const validDate = (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
const addDays = (date, days) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const minutes = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const formatTime = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const buildSlots = (start, end, maxPatients) => {
  const slots = [];
  for (let value = minutes(start); value + SLOT_DURATION_MINUTES <= minutes(end) && slots.length < maxPatients; value += SLOT_DURATION_MINUTES + BUFFER_MINUTES) {
    slots.push({ id: null, slotNumber: slots.length + 1, startTime: formatTime(value), endTime: formatTime(value + SLOT_DURATION_MINUTES), status: 'AVAILABLE' });
  }
  if (!slots.length) throw new ApiError(400, 'Shift is too short to contain an appointment slot');
  return slots;
};
const serialize = (shift, doctor) => ({
  id: shift.id, doctorId: shift.doctorId, doctorName: doctor?.fullName,
  date: shift.date, shift: shift.shift, shiftType: shift.shift, startTime: shift.startTime, endTime: shift.endTime,
  maxPatients: shift.maxPatients, note: shift.note, repeatWeekly: shift.repeatWeekly, repeatCount: shift.repeatCount,
  status: shift.status, availableSlots: shift.slots.filter((slot) => slot.status === 'AVAILABLE').length,
  slots: shift.slots.map((slot) => ({ ...(slot.toObject?.() || slot), slotStatus: slot.status })),
});

const createShift = async (doctor, payload) => {
  if (doctor.userType !== 'Doctor' || !doctor.id) throw new ApiError(403, 'A doctor account is required to create shifts');
  const date = payload.date;
  const shiftType = payload.shift;
  const maxPatients = payload.maxPatients === undefined ? 10 : Number(payload.maxPatients);
  const repeatWeekly = payload.repeatWeekly === undefined ? false : payload.repeatWeekly;
  const repeatCount = payload.repeatCount === undefined ? 0 : Number(payload.repeatCount);
  const note = payload.note == null ? '' : payload.note;
  if (!validDate(date)) throw new ApiError(400, 'date must be a valid YYYY-MM-DD date');
  if (date < today()) throw new ApiError(400, 'Cannot create a shift in the past');
  if (!SHIFT_TIMES[shiftType]) throw new ApiError(400, 'shift must be MORNING, AFTERNOON, or EVENING');
  if (date === today() && SHIFT_TIMES[shiftType].startTime <= currentTime()) throw new ApiError(400, 'Cannot create a shift that has already started');
  if (!Number.isInteger(maxPatients) || maxPatients < 1 || maxPatients > 100) throw new ApiError(400, 'maxPatients must be an integer between 1 and 100');
  if (typeof note !== 'string' || note.length > 255) throw new ApiError(400, 'note must be a string of at most 255 characters');
  if (typeof repeatWeekly !== 'boolean' || !Number.isInteger(repeatCount) || repeatCount < 0 || repeatCount > 3) throw new ApiError(400, 'Invalid weekly repeat settings');
  const dates = Array.from({ length: repeatWeekly ? repeatCount + 1 : 1 }, (_, index) => addDays(date, index * 7));
  if (await DoctorShift.exists({ doctorId: doctor.id, date: { $in: dates }, shift: shiftType })) throw new ApiError(409, 'A shift already exists for one or more selected weeks');
  const time = SHIFT_TIMES[shiftType];
  const created = [];
  for (const [index, shiftDate] of dates.entries()) {
    const slots = buildSlots(time.startTime, time.endTime, maxPatients);
    for (const slot of slots) slot.id = await getNextSequence('shift_slots');
    const shift = await DoctorShift.create({
      doctorId: doctor.id, date: shiftDate, shift: shiftType, startTime: time.startTime, endTime: time.endTime,
      slotDurationMinutes: SLOT_DURATION_MINUTES, bufferMinutes: BUFFER_MINUTES, maxPatients, note: note.trim(),
      repeatWeekly: index === 0 && repeatWeekly, repeatCount: index === 0 ? repeatCount : 0, status: 'ACTIVE', slots,
    });
    created.push(serialize(shift, doctor));
  }
  return created;
};

const getMyShifts = async (doctor, week, date) => {
  const query = { doctorId: doctor.id };
  if (date !== undefined) { if (!validDate(date)) throw new ApiError(400, 'date must be a valid YYYY-MM-DD date'); query.date = date; }
  if (week === 'current' || week === 'next') {
    const current = today(); const d = new Date(`${current}T00:00:00Z`).getUTCDay();
    let start = addDays(current, -((d + 6) % 7)); if (week === 'next') start = addDays(start, 7);
    query.date = { $gte: start, $lte: addDays(start, 6) };
  } else if (week !== undefined) throw new ApiError(400, 'week must be current or next');
  if (date !== undefined && week !== undefined) throw new ApiError(400, 'Use either date or week, not both');
  return (await DoctorShift.find(query).sort({ date: 1, startTime: 1 }).lean()).map((shift) => serialize(shift, doctor));
};

module.exports = { createShift, getMyShifts };
