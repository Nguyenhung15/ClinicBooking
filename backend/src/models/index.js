const { Counter, getNextSequence, syncSequenceFloor } = require('./counter.model');
const User = require('./user.model');
const AuditLog = require('./auditLog.model');
const Specialty = require('./specialty.model');
const Image = require('./image.model');
const DoctorShift = require('./doctorShift.model');
const Appointment = require('./appointment.model');
const Prescription = require('./prescription.model');
const PaymentTransaction = require('./paymentTransaction.model');

module.exports = {
  Counter,
  getNextSequence,
  syncSequenceFloor,
  User,
  AuditLog,
  Specialty,
  Image,
  DoctorShift,
  Appointment,
  Prescription,
  PaymentTransaction,
};

