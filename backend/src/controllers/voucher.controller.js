const voucherService = require('../services/voucher.service');
const { sendSuccess } = require('../utils/response');

const getPublicActiveVouchers = async (_req, res) => {
  const vouchers = await voucherService.listActivePublicVouchers();
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy danh sách voucher đang hoạt động thành công',
    data: vouchers,
  });
};

const getAllVouchers = async (_req, res) => {
  const vouchers = await voucherService.listAllVouchers();
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy danh sách tất cả voucher thành công',
    data: vouchers,
  });
};

const getVoucherById = async (req, res) => {
  const voucher = await voucherService.getVoucherById(req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy thông tin chi tiết voucher thành công',
    data: voucher,
  });
};

const createVoucher = async (req, res) => {
  const created = await voucherService.createVoucher(req.user, req.body, req);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Tạo voucher thành công',
    data: created,
  });
};

const updateVoucher = async (req, res) => {
  const updated = await voucherService.updateVoucher(
    req.user,
    req.params.id,
    req.body,
    req,
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Cập nhật voucher thành công',
    data: updated,
  });
};

const deleteVoucher = async (req, res) => {
  const result = await voucherService.deleteVoucher(req.user, req.params.id, req);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Xóa voucher thành công',
    data: result,
  });
};

const getMyVouchers = async (req, res) => {
  const list = await voucherService.getMyVouchers(req.user);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy danh sách voucher của tôi thành công',
    data: list,
  });
};

const claimVoucher = async (req, res) => {
  const claimed = await voucherService.claimVoucherForPatient(
    req.user,
    req.params.voucherId,
    req,
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lưu voucher ưu đãi thành công',
    data: claimed,
  });
};

const getVoucherOwners = async (req, res) => {
  const owners = await voucherService.getVoucherOwners(req.params.voucherId);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy danh sách người sở hữu voucher thành công',
    data: owners,
  });
};

const getUserVouchers = async (req, res) => {
  const vouchers = await voucherService.getUserVouchers(req.params.userId);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy danh sách voucher của người dùng thành công',
    data: vouchers,
  });
};

const useVoucherForUser = async (req, res) => {
  const userId = req.query.userId ?? req.body?.userId;
  const updated = await voucherService.markVoucherUsedForUser(
    req.user,
    req.params.voucherId,
    userId,
    req,
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Áp dụng voucher thành công',
    data: updated,
  });
};

module.exports = {
  getPublicActiveVouchers,
  getAllVouchers,
  getVoucherById,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  getMyVouchers,
  claimVoucher,
  getVoucherOwners,
  getUserVouchers,
  useVoucherForUser,
};

