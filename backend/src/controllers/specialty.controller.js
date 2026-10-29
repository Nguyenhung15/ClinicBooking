const specialtyService = require('../services/specialty.service');
const { sendSuccess } = require('../utils/response');

const getAllSpecialties = async (_req, res) => {
  const specialties = await specialtyService.listSpecialties();
  return sendSuccess(res, { data: specialties });
};

const createSpecialty = async (req, res) => {
  const created = await specialtyService.createSpecialty(req.user, req.body, req);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Tạo chuyên khoa thành công',
    data: created,
  });
};

const updateSpecialty = async (req, res) => {
  const updated = await specialtyService.updateSpecialty(
    req.user,
    req.params.id,
    req.body,
    req,
  );
  return sendSuccess(res, {
    message: 'Cập nhật chuyên khoa thành công',
    data: updated,
  });
};

module.exports = {
  getAllSpecialties,
  createSpecialty,
  updateSpecialty,
};

