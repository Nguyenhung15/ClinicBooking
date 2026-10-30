const patientAppointmentService = require('../services/patientAppointment.service');
const { sendSuccess } = require('../utils/response');

const createAppointment = async (req, res) => {
  const result = await patientAppointmentService.bookAppointment(
    req.user,
    req.query,
    req.body,
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Đặt lịch khám thành công',
    data: result,
  });
};

module.exports = {
  createAppointment,
};

