const patientProfileService = require('../services/patientProfile.service');
const { sendSuccess } = require('../utils/response');

const getMyProfiles = async (req, res) => {
  const profiles = await patientProfileService.getMyProfiles(req.user.id);
  return sendSuccess(res, { data: profiles });
};

const getProfileById = async (req, res) => {
  const profile = await patientProfileService.getProfileById(req.user, req.params.id);
  return sendSuccess(res, { data: profile });
};

const createProfile = async (req, res) => {
  const created = await patientProfileService.createProfile(req.user, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Tạo hồ sơ bệnh nhân thành công',
    data: created,
  });
};

const updateProfile = async (req, res) => {
  const updated = await patientProfileService.updateProfile(
    req.user,
    req.params.id,
    req.body,
  );
  return sendSuccess(res, {
    message: 'Cập nhật hồ sơ bệnh nhân thành công',
    data: updated,
  });
};

const deleteProfile = async (req, res) => {
  const result = await patientProfileService.deleteProfile(req.user, req.params.id);
  return sendSuccess(res, {
    message: result.message,
  });
};

module.exports = {
  getMyProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
};
