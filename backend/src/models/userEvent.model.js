const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');
const {
  EVENT_REGISTRATION_STATUSES,
  EVENT_REGISTRATION_STATUS_VALUES,
} = require('../constants/enums');

const userEventSchema = new mongoose.Schema(
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
      enum: EVENT_REGISTRATION_STATUS_VALUES,
      default: EVENT_REGISTRATION_STATUSES.PENDING,
      required: true,
      index: true,
    },
    registeredAt: {
      type: Date,
      default: () => new Date(),
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    confirmedBy: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate event registration per user
userEventSchema.index({ eventId: 1, userId: 1 }, { unique: true });

userEventSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'user_events',
  extraTransform: (_doc, ret) => {
    if (ret.registeredAt instanceof Date) {
      ret.registeredAt = ret.registeredAt.toISOString();
    }
    if (ret.confirmedAt instanceof Date) {
      ret.confirmedAt = ret.confirmedAt.toISOString();
    }
    return ret;
  },
});

const UserEvent = mongoose.model('UserEvent', userEventSchema, 'user_events');

module.exports = UserEvent;

