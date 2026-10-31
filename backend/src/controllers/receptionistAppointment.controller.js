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

/**
 * Controller for checking in an appointment (UC-REC-04).
 * Route: PUT /appointments/checkin/:id
 * Allowed roles: RECEPTIONIST, ADMIN
 */
const checkinAppointment = async (req, res, next) => {
  try {
    const actor = getPrincipal(req);
    const appointmentId = req.params.id;

    // Support verification info from body or query
    const verificationPayload = {
      verifyPhoneLast4: req.body?.verifyPhoneLast4 || req.query?.verifyPhoneLast4,
      identityVerified: req.body?.identityVerified !== undefined
        ? req.body.identityVerified
        : (req.query?.identityVerified !== undefined
          ? req.query.identityVerified
          : (!req.body?.verifyPhoneLast4 && !req.query?.verifyPhoneLast4 ? true : false)), // default true if FE sends empty body
    };

    const result = await receptionistAppointmentService.checkinAppointment(
      actor,
      appointmentId,
      verificationPayload,
    );

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
  checkinAppointment,
};

