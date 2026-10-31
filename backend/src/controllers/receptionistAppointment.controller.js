const receptionistAppointmentService = require('../services/receptionistAppointment.service');
const { getPrincipal } = require('../middlewares/auth.middleware');
const { sendSuccess } = require('../utils/response');

/**
 * Controller for confirming an appointment (UC-REC-03).
 * Route: PUT /appointments/confirm/:id
 * Allowed roles: RECEPTIONIST, ADMIN
 */
const confirmAppointment = async (req, res, next) => {
  try {
    const actor = getPrincipal(req);
    const appointmentId = req.params.id;

    const result = await receptionistAppointmentService.confirmAppointment(actor, appointmentId);

    return sendSuccess(res, {
      statusCode: 200,
      message: result.message,
      data: result.appointment,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  confirmAppointment,
};
