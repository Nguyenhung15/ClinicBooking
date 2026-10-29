const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const paymentTransactionSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: Number,
      required: true,
      index: true,
    },
    amount: {
      type: String,
      default: null,
    },
    bankCode: {
      type: String,
      default: null,
    },
    orderInfo: {
      type: String,
      default: null,
    },
    payDate: {
      type: Date,
      default: null,
    },
    responseCode: {
      type: String,
      default: null,
    },
    transactionNo: {
      type: String,
      default: null,
    },
    transactionStatus: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

paymentTransactionSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'payment_transactions',
});

const PaymentTransaction = mongoose.model(
  'PaymentTransaction',
  paymentTransactionSchema,
  'payment_transactions',
);

module.exports = PaymentTransaction;

