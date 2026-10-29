const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/response');

const getMe = async (req, res) => {
  const profile = await userService.getUserById(req.user.id);
  return sendSuccess(res, { data: profile });
};

const updateMe = async (req, res) => {
  const updated = await userService.updateOwnProfile(req.user, req.body, req);
  return sendSuccess(res, {
    message: 'Cập nhật hồ sơ thành công',
    data: updated,
  });
};

const searchUsers = async (req, res) => {
  const results = await userService.searchUsers(req.query.keyword);
  return sendSuccess(res, { data: results });
};

module.exports = {
  getMe,
  updateMe,
  searchUsers,
};

