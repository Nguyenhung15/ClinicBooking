const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const resultFileSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    version: { type: Number, required: true, min: 1 },
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 127 },
    size: { type: Number, required: true, min: 1 },
    uploadedBy: { type: Number, required: true },
    uploadedAt: { type: Date, required: true },
    reviewStatus: {
      type: String,
      enum: ['PENDING_ADMIN_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING_ADMIN_REVIEW',
    },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '', maxlength: 500 },
  },
  { _id: false },
);

const groupHealthAssignmentSchema = new mongoose.Schema(
  {
    doctorId: { type: Number, required: true, index: true },
    requestId: { type: Number, required: true, index: true },
    shiftId: { type: Number, default: null },
    specialtyId: { type: Number, default: null },
    capacityAllocated: { type: Number, default: null, min: 0 },
    note: { type: String, default: '', maxlength: 500 },
    resultStatus: {
      type: String,
      enum: ['NONE', 'UPLOADED', 'APPROVED', 'REJECTED'],
      default: 'NONE',
      index: true,
    },
    resultVersion: { type: Number, default: 0, min: 0 },
    resultFiles: { type: [resultFileSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

groupHealthAssignmentSchema.index({ doctorId: 1, requestId: 1 });
groupHealthAssignmentSchema.plugin(baseSchemaPlugin, { sequenceName: 'group_health_assignments' });
groupHealthAssignmentSchema.index(
  { requestId: 1, doctorId: 1, shiftId: 1, specialtyId: 1 },
  {
    unique: true,
    name: 'unique_group_health_assignment',
    partialFilterExpression: {
      shiftId: { $type: 'number' },
      specialtyId: { $type: 'number' },
    },
  },
);

module.exports = mongoose.model('GroupHealthAssignment', groupHealthAssignmentSchema);
