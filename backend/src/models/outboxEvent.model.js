const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const outboxEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['EMAIL', 'WEBSOCKET', 'PUSH', 'ALL'],
      default: 'ALL',
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    retries: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 5,
    },
    nextRetryAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastError: {
      type: String,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

outboxEventSchema.index({ status: 1, nextRetryAt: 1 });

outboxEventSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'outbox_events',
});

const OutboxEvent = mongoose.model('OutboxEvent', outboxEventSchema, 'outbox_events');

module.exports = OutboxEvent;
