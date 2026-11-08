const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');
const { VOUCHER_TYPES, VOUCHER_TYPE_VALUES } = require('../constants/enums');

const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      default: null,
      trim: true,
    },
    discountValue: {
      type: Number,
      default: null,
    },
    type: {
      type: String,
      enum: VOUCHER_TYPE_VALUES,
      default: VOUCHER_TYPES.SERVICE_TICKET,
      required: true,
    },
    enable: {
      type: Boolean,
      default: true,
      required: true,
      index: true,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

voucherSchema.index({ enable: 1, expiryDate: 1 });

voucherSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'vouchers',
  extraTransform: (_doc, ret) => {
    if (ret.expiryDate instanceof Date) {
      ret.expiryDate = ret.expiryDate.toISOString();
    }
    return ret;
  },
});

const Voucher = mongoose.model('Voucher', voucherSchema, 'vouchers');

module.exports = Voucher;

