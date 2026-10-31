const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const eventRegistrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: Number,
      required: true,
      index: true,
    },
    userId: {
      type: Number,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.Mixed, // string/number userId from JWT
      default: null,
      index: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Unique index eventId + userId as explicitly required by UC-REC-07
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventRegistrationSchema.index({ eventId: 1, status: 1 });

eventRegistrationSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'event_registrations',
  extraTransform: (_doc, ret) => {
    ret.userEventId = ret.id;
    return ret;
  },
});

const EventRegistration = mongoose.model(
  'EventRegistration',
  eventRegistrationSchema,
  'event_registrations',
);

module.exports = EventRegistration;
