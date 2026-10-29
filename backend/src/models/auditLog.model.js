const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: Number,
      required: true,
      index: true,
    },
    actorEmail: {
      type: String,
      default: null,
    },
    actorRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      index: true,
    },
    targetId: {
      type: Number,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: null,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

auditLogSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'audit_logs',
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');

module.exports = AuditLog;

