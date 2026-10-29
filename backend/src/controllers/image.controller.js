const imageService = require('../services/image.service');

// Note: web/src/api/image.ts reads `res.data as Image` directly at top-level.
const getDoctorImage = async (req, res) => {
  const image = await imageService.getDoctorImage(req.params.doctorId);
  return res.status(200).json(image);
};

const uploadDoctorImage = async (req, res) => {
  const image = await imageService.saveDoctorImage(
    req.user,
    req.params.doctorId,
    req.file,
    req,
  );
  return res.status(201).json(image);
};

const updateDoctorImage = async (req, res) => {
  const image = await imageService.saveDoctorImage(
    req.user,
    req.params.doctorId,
    req.file,
    req,
  );
  return res.status(200).json(image);
};

const deleteDoctorImage = async (req, res) => {
  await imageService.deleteDoctorImage(req.user, req.params.doctorId, req);
  return res.status(200).json({ success: true, message: 'Xóa ảnh bác sĩ thành công' });
};

module.exports = {
  getDoctorImage,
  uploadDoctorImage,
  updateDoctorImage,
  deleteDoctorImage,
};

