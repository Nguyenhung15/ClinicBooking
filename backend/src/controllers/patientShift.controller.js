const patientShiftService = require('../services/patientShift.service');
const { sendSuccess } = require('../utils/response');

const getShiftsByDoctor = async (req, res) => {
  const shifts = await patientShiftService.getShiftsByDoctorAndDate(
    req.params.doctorId,
    req.query.date,
  );
  return sendSuccess(res, { data: shifts });
};

module.exports = {
  getShiftsByDoctor,
};
