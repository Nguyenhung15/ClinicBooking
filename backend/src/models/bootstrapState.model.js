const mongoose = require('mongoose');

const bootstrapStateSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['IDLE', 'CLAIMING', 'LOCKED'],
      default: 'IDLE',
    },
    locked: {
      type: Boolean,
      default: false,
    },
    claimToken: {
      type: String,
      default: null,
    },
    claimExpiresAt: {
      type: Date,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    bootstrappedAdminId: {
      type: Number,
      default: null,
    },
    bootstrapMode: {
      type: String,
      enum: ['INITIAL_ZERO_ADMIN', 'BOOTSTRAP_SECRET', null],
      default: null,
    },
    consumedSecretHashes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const BootstrapState = mongoose.model(
  'BootstrapState',
  bootstrapStateSchema,
  'system_bootstrap_locks',
);

module.exports = BootstrapState;

