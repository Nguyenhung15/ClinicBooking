const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const shiftCancellationRequestSchema = new mongoose.Schema(
  {
    shiftId: {
      type: Number,
      required: true,
      index: true,
    },
    doctorId: {
      type: Number,
      required: true,
      index: true,
    },
    shiftDate: { type: String, required: true },
    shiftType: { type: String, enum: ['MORNING', 'AFTERNOON', 'EVENING'], required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    affectedAppointmentCount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    decisionNote: { type: String, default: '', maxlength: 500 },
    decidedBy: { type: Number, default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

shiftCancellationRequestSchema.index(
  { doctorId: 1, shiftId: 1 },
  {
    unique: true,
    name: 'one_pending_cancellation_per_doctor_shift',
    partialFilterExpression: { status: 'PENDING' },
  },
);
shiftCancellationRequestSchema.index({ status: 1, createdAt: 1 });
shiftCancellationRequestSchema.plugin(baseSchemaPlugin, { sequenceName: 'shift_cancellation_requests' });

module.exports = mongoose.model('ShiftCancellationRequest', shiftCancellationRequestSchema);
