const shiftCancellationService = require('../services/shiftCancellation.service');
const { getPrincipal } = require('../middlewares/auth.middleware');
const { sendSuccess } = require('../utils/response');

const create = async (req, res, next) => {
  try {
    const actor = getPrincipal(req);
    const request = await shiftCancellationService.create(actor, req.params.shiftId, req.body || {});
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Gửi yêu cầu hủy ca trực thành công',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

const getMine = async (req, res, next) => {
  try {
    const actor = getPrincipal(req);
    const requests = await shiftCancellationService.getMine(actor);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Danh sách yêu cầu hủy ca trực của bạn',
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

const getPending = async (req, res, next) => {
  try {
    const result = await shiftCancellationService.getPending(req.query);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Danh sách yêu cầu hủy ca trực đang chờ duyệt',
      data: result.items,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error) {
    next(error);
  }
};

const approve = async (req, res, next) => {
  try {
    const actor = getPrincipal(req);
    const id = req.params.id;
    const { note, policy } = req.body || {};
    const result = await shiftCancellationService.approveRequest(actor, id, { note, policy });
    return sendSuccess(res, {
      statusCode: 200,
      message: result.message,
      data: result.request,
      idempotent: result.idempotent,
    });
  } catch (error) {
    next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    const actor = getPrincipal(req);
    const id = req.params.id;
    const { note } = req.body || {};
    const result = await shiftCancellationService.rejectRequest(actor, id, { note });
    return sendSuccess(res, {
      statusCode: 200,
      message: result.message,
      data: result.request,
      idempotent: result.idempotent,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getMine,
  getPending,
  approve,
  reject,
};
