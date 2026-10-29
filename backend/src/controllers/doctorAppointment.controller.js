const doctorAppointmentService = require('../services/doctorAppointment.service');

const getMyByStatus = async (req, res) => {
  const appointments = await doctorAppointmentService.getMyByStatus(
    req.user,
    req.params.status,
    req.query.date,
  );
  res.json({ success: true, message: 'Your appointments', data: appointments });
};

const getByMyShift = async (req, res) => {
  const appointments = await doctorAppointmentService.getByMyShift(req.user, req.params.shiftId);
  res.json({ success: true, message: 'Appointments for your shift', data: appointments });
};

const getMyDetail = async (req, res) => {
  const appointment = await doctorAppointmentService.getMyDetail(req.user, req.params.appointmentId);
  res.json({ success: true, message: 'Appointment details', data: appointment });
};

const startAppointment = async (req, res) => {
  const appointment = await doctorAppointmentService.startAppointment(req.user, req.params.appointmentId);
  res.json({ success: true, message: 'Appointment started', data: appointment });
};

const completeAppointment = async (req, res) => {
  const appointment = await doctorAppointmentService.completeAppointment(req.user, req.params.appointmentId);
  res.json({ success: true, message: 'Appointment completed', data: appointment });
};

module.exports = { getMyByStatus, getByMyShift, getMyDetail, startAppointment, completeAppointment };
