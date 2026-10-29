const doctorPrescriptionService = require('../services/doctorPrescription.service');

const getByAppointment = async (req, res) => {
  const prescriptions = await doctorPrescriptionService.getByAppointment(req.user, req.params.appointmentId);
  res.json({ success: true, message: 'Appointment prescriptions', data: prescriptions });
};

const createBatch = async (req, res) => {
  const prescriptions = await doctorPrescriptionService.create(req.user, req.params.appointmentId, req.body);
  res.status(201).json({ success: true, message: 'Prescriptions created', data: prescriptions });
};

const createSingle = async (req, res) => {
  const prescriptions = await doctorPrescriptionService.create(req.user, req.params.appointmentId, [req.body]);
  res.status(201).json({ success: true, message: 'Prescription created', data: prescriptions[0] });
};

const updateBatch = async (req, res) => {
  const prescriptions = await doctorPrescriptionService.update(req.user, req.params.appointmentId, req.body);
  res.json({ success: true, message: 'Prescriptions updated', data: prescriptions });
};

module.exports = { createBatch, createSingle, getByAppointment, updateBatch };
