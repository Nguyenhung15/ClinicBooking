const { Appointment, DoctorShift, ShiftCancellationRequest, User } = require('../models');
const ApiError = require('../utils/ApiError');
const idOf = (value) => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, 'Invalid numeric ID'); return id; };
const serialize = (request, doctorName) => ({ id: request.id, shiftId: request.shiftId, doctorId: request.doctorId, doctorName, shiftDate: request.shiftDate, shift: request.shiftType, reason: request.reason, affectedAppointmentCount: request.affectedAppointmentCount, status: request.status, decisionNote: request.decisionNote || '', requestedAt: request.createdAt?.toISOString(), decidedAt: request.decidedAt?.toISOString() });
const create = async (doctor, shiftId, input) => {
  const reason = typeof input?.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new ApiError(400, 'A reason is required to request shift cancellation');
  if (reason.length > 500) throw new ApiError(400, 'reason must be at most 500 characters');
  const shift = await DoctorShift.findOne({ id: idOf(shiftId), doctorId: doctor.id }).lean();
  if (!shift) throw new ApiError(404, 'Shift not found');
  if (shift.status !== 'ACTIVE') throw new ApiError(409, 'Only an active shift can be submitted for cancellation');
  const count = await Appointment.countDocuments({ doctorId: doctor.id, shiftId: shift.id, status: { $in: ['PENDING_CONFIRMATION', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] } });
  try {
    const request = await ShiftCancellationRequest.create({ shiftId: shift.id, doctorId: doctor.id, shiftDate: shift.date, shiftType: shift.shift, reason, affectedAppointmentCount: count, status: 'PENDING' });
    return serialize(request);
  } catch (error) { if (error.code === 11000) throw new ApiError(409, 'A pending cancellation request already exists for this shift'); throw error; }
};
const getMine = async (doctor) => (await ShiftCancellationRequest.find({ doctorId: doctor.id }).sort({ createdAt: -1 }).lean()).map(serialize);
const getPending = async () => {
  const requests = await ShiftCancellationRequest.find({ status: 'PENDING' }).sort({ createdAt: 1 }).lean();
  const doctors = await User.find({ id: { $in: [...new Set(requests.map((r) => r.doctorId))] } }).select('id fullName').lean();
  const names = new Map(doctors.map((doctor) => [doctor.id, doctor.fullName]));
  return requests.map((request) => serialize(request, names.get(request.doctorId) || 'Doctor'));
};
module.exports = { create, getMine, getPending };
