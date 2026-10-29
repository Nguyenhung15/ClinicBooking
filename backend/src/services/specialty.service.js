const ApiError = require('../utils/ApiError');
const { parsePositiveInt } = require('../utils/normalizers');
const { AUDIT_ACTIONS } = require('../constants/enums');
const { Specialty } = require('../models');
const { recordAudit, buildAuditDiff, sanitizeSnapshot } = require('./audit.service');

async function listSpecialties() {
  const list = await Specialty.find().sort({ id: 1 });
  return list.map((s) => s.toJSON());
}

async function getSpecialtyById(id) {
  const specId = parsePositiveInt(id, 'specialtyId');
  const spec = await Specialty.findOne({ id: specId });
  if (!spec) {
    throw new ApiError(404, 'Không tìm thấy chuyên khoa');
  }
  return spec;
}

/**
 * Resolve specialty from either `specialtyId` (number) or `specialization` (name string).
 * Required because AdminCreateUser.tsx sends `specialization: sp.name` while UpdateDoctor sends `specialtyId`.
 */
async function resolveSpecialty({ specialtyId, specialization }) {
  if (specialtyId !== undefined && specialtyId !== null && specialtyId !== '' && Number(specialtyId) > 0) {
    const id = parsePositiveInt(specialtyId, 'specialtyId');
    const byId = await Specialty.findOne({ id });
    if (!byId) {
      throw new ApiError(400, `Chuyên khoa với ID #${id} không tồn tại`);
    }
    return byId;
  }

  if (typeof specialization === 'string' && specialization.trim()) {
    const trimmed = specialization.trim();
    const byName = await Specialty.findOne({
      name: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (!byName) {
      throw new ApiError(400, `Chuyên khoa '${trimmed}' không tồn tại`);
    }
    return byName;
  }

  throw new ApiError(400, 'Bác sĩ bắt buộc phải thuộc một chuyên khoa hợp lệ');
}

async function createSpecialty(actor, payload, req) {
  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
  const description = typeof payload?.description === 'string' ? payload.description.trim() : '';

  if (!name) {
    throw new ApiError(400, 'Tên chuyên khoa không được để trống');
  }

  const existing = await Specialty.findOne({
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  });
  if (existing) {
    throw new ApiError(409, 'Tên chuyên khoa đã tồn tại');
  }

  const created = await Specialty.create({ name, description });

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.SPECIALTY_CREATE,
      targetType: 'Specialty',
      targetId: created.id,
      reason: payload?.reason || 'Tạo chuyên khoa mới',
      changes: { before: null, after: sanitizeSnapshot(created) },
      req,
    });
  }

  return created.toJSON();
}

async function updateSpecialty(actor, id, payload, req) {
  const spec = await getSpecialtyById(id);
  const beforeSnap = sanitizeSnapshot(spec);

  if (payload?.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) {
      throw new ApiError(400, 'Tên chuyên khoa không được để trống');
    }
    const conflict = await Specialty.findOne({
      id: { $ne: spec.id },
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (conflict) {
      throw new ApiError(409, 'Tên chuyên khoa đã tồn tại');
    }
    spec.name = name;
  }

  if (payload?.description !== undefined) {
    spec.description = String(payload.description).trim();
  }

  await spec.save();

  if (actor) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.SPECIALTY_UPDATE,
      targetType: 'Specialty',
      targetId: spec.id,
      reason: payload?.reason || 'Cập nhật chuyên khoa',
      changes: buildAuditDiff(beforeSnap, spec),
      req,
    });
  }

  return spec.toJSON();
}

module.exports = {
  listSpecialties,
  getSpecialtyById,
  resolveSpecialty,
  createSpecialty,
  updateSpecialty,
};

