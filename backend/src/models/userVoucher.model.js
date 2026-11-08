const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const userVoucherSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      index: true,
    },
    voucherId: {
      type: Number,
      required: true,
      index: true,
    },
    issuedAt: {
      type: Date,
      default: () => new Date(),
    },
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    appointmentId: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate voucher claims per user while tracking usage
userVoucherSchema.index({ userId: 1, voucherId: 1 }, { unique: true });

userVoucherSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'user_vouchers',
  extraTransform: (_doc, ret) => {
    if (ret.issuedAt instanceof Date) {
      ret.issuedAt = ret.issuedAt.toISOString();
    }
    if (ret.usedAt instanceof Date) {
      ret.usedAt = ret.usedAt.toISOString();
    }
    return ret;
  },
});

const UserVoucher = mongoose.model('UserVoucher', userVoucherSchema, 'user_vouchers');

module.exports = UserVoucher;

