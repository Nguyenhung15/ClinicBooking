const receptionistEventService = require('../services/receptionistEvent.service');
const { getPrincipal } = require('../middlewares/auth.middleware');
const { sendSuccess } = require('../utils/response');

/**
 * GET /reception/events
 * Fetch all events with their participant registrations for receptionist view
 */
const getEvents = async (req, res, next) => {
  try {
    const events = await receptionistEventService.getReceptionEvents();
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Lấy danh sách sự kiện và người đăng ký thành công',
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /reception/events/:eventId/confirm/:userId
 * Receptionist / Admin confirms attendee's event participation
 */
const confirmAttendance = async (req, res, next) => {
  try {
    const actor = getPrincipal(req);
    const { eventId, userId } = req.params;
    const result = await receptionistEventService.confirmEventAttendance(actor, eventId, userId);
    return sendSuccess(res, {
      statusCode: 200,
      message: result.message,
      data: result.data,
      idempotent: result.idempotent,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEvents,
  confirmAttendance,
};
