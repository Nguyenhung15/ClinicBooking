const eventService = require('../services/event.service');
const { sendSuccess } = require('../utils/response');

const getAvailableEvents = async (req, res) => {
  const events = await eventService.listPublicAvailableEvents(req.user || null);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy danh sách sự kiện đang mở thành công',
    data: events,
  });
};

const getAllEvents = async (_req, res) => {
  const events = await eventService.listAllEvents();
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy danh sách tất cả sự kiện thành công',
    data: events,
  });
};

const createEvent = async (req, res) => {
  const created = await eventService.createEvent(req.user, req.body, req);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Tạo sự kiện thành công',
    data: created,
  });
};

const updateEvent = async (req, res) => {
  const updated = await eventService.updateEvent(
    req.user,
    req.params.id,
    req.body,
    req,
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Cập nhật sự kiện thành công',
    data: updated,
  });
};

const deleteEvent = async (req, res) => {
  const result = await eventService.deleteEvent(req.user, req.params.id, req);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Xóa sự kiện thành công',
    data: result,
  });
};

const registerForEvent = async (req, res) => {
  const registration = await eventService.registerForEvent(
    req.user,
    req.params.eventId,
    req,
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Đăng ký tham gia sự kiện thành công',
    data: registration,
  });
};

const getMyEvents = async (req, res) => {
  const list = await eventService.getMyRegisteredEvents(req.user);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy danh sách sự kiện của tôi thành công',
    data: list,
  });
};

const getReceptionEvents = async (_req, res) => {
  const events = await eventService.listEventsForReception();
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy danh sách sự kiện và người tham dự thành công',
    data: events,
  });
};

const confirmEventAttendance = async (req, res) => {
  const confirmed = await eventService.confirmEventAttendance(
    req.user,
    req.params.eventId,
    req.params.userId,
    req,
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Xác nhận tham gia sự kiện thành công',
    data: confirmed,
  });
};

module.exports = {
  getAvailableEvents,
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  registerForEvent,
  getMyEvents,
  getReceptionEvents,
  confirmEventAttendance,
};

