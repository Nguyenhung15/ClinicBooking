const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { parsePositiveInt } = require('../utils/normalizers');
const { ROLES, AUDIT_ACTIONS } = require('../constants/enums');
const { Image, User } = require('../models');
const { recordAudit } = require('./audit.service');

function removeUploadedFileSafely(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) return;
  const relPath = imageUrl.replace(/^\/uploads\/+/, '');
  const fullPath = path.join(env.uploadsDir, relPath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // Ignore file unlink errors so DB update does not fail
    }
  }
}

async function ensureDoctorExists(doctorId) {
  const id = parsePositiveInt(doctorId, 'doctorId');
  const doctor = await User.findOne({ id, userType: ROLES.DOCTOR });
  if (!doctor) {
    throw new ApiError(404, `Không tìm thấy bác sĩ với ID #${id}`);
  }
  return doctor;
}

async function getDoctorImage(doctorId) {
  const id = parsePositiveInt(doctorId, 'doctorId');
  const image = await Image.findOne({ doctorId: id });
  if (!image) {
    throw new ApiError(404, `Doctor #${id} does not have an image`);
  }
  return image.toJSON();
}

async function saveDoctorImage(actor, doctorId, file, req) {
  if (!file) {
    throw new ApiError(400, 'Vui lòng chọn file ảnh để tải lên');
  }

  const doctor = await ensureDoctorExists(doctorId);
  const imageUrl = `/uploads/doctors/${file.filename}`;

  let image = await Image.findOne({ doctorId: doctor.id });
  const isUpdate = Boolean(image);

  if (image) {
    removeUploadedFileSafely(image.imageUrl);
    image.imageUrl = imageUrl;
    await image.save();
  } else {
    image = await Image.create({
      doctorId: doctor.id,
      imageUrl,
    });
  }

  doctor.avatarUrl = imageUrl;
  await doctor.save();

  if (actor) {
    await recordAudit({
      actor,
      action: isUpdate ? AUDIT_ACTIONS.DOCTOR_IMAGE_UPDATE : AUDIT_ACTIONS.DOCTOR_IMAGE_UPLOAD,
      targetType: 'User',
      targetId: doctor.id,
      reason: isUpdate ? 'Cập nhật ảnh đại diện bác sĩ' : 'Tải lên ảnh đại diện bác sĩ',
      changes: { after: { avatarUrl: imageUrl } },
      req,
    });
  }

  return image.toJSON();
}

async function deleteDoctorImage(actor, doctorId, req) {
  const doctor = await ensureDoctorExists(doctorId);
  const image = await Image.findOne({ doctorId: doctor.id });
  if (!image) {
    throw new ApiError(404, `Doctor #${doctor.id} does not have an image`);
  }

  const oldUrl = image.imageUrl;
  removeUploadedFileSafely(oldUrl);
  await Image.deleteOne({ id: image.id });

  doctor.avatarUrl = null;
  await doctor.save();

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.DOCTOR_IMAGE_DELETE,
      targetType: 'User',
      targetId: doctor.id,
      reason: 'Xóa ảnh đại diện bác sĩ',
      changes: { before: { avatarUrl: oldUrl }, after: { avatarUrl: null } },
      req,
    });
  }
}

module.exports = {
  getDoctorImage,
  saveDoctorImage,
  deleteDoctorImage,
};

