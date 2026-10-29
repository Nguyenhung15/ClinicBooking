const crypto = require('node:crypto');
const path = require('node:path');
const mongoose = require('mongoose');
const { DoctorShift, Specialty } = require('../models');
const GroupHealthAssignment = require('../models/GroupHealthAssignment');
const GroupHealthRequest = require('../models/GroupHealthRequest');
const ApiError = require('../utils/ApiError');

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const EXTENSIONS = { '.csv': 'text/csv', '.pdf': 'application/pdf', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
const BUCKET_NAME = 'group_health_files';
const getBucket = () => { if (!mongoose.connection.db) throw new ApiError(503, 'File storage is not connected'); return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME }); };
const idOf = (value) => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, 'Invalid numeric ID'); return id; };
const loadAssignment = async (doctor, assignmentId) => {
  const assignment = await GroupHealthAssignment.findOne({ id: idOf(assignmentId), doctorId: doctor.id }).lean();
  if (!assignment) throw new ApiError(404, 'Assignment not found');
  const request = await GroupHealthRequest.findOne({ id: assignment.requestId }).lean();
  if (!request || !['APPROVED', 'COMPLETED'].includes(request.status)) throw new ApiError(404, 'Approved group health assignment not found');
  const [shift, specialty] = await Promise.all([
    assignment.shiftId ? DoctorShift.findOne({ id: assignment.shiftId }).lean() : null,
    assignment.specialtyId ? Specialty.findOne({ id: assignment.specialtyId }).lean() : null,
  ]);
  return { assignment, request, shift, specialty };
};
const serialize = ({ assignment, request, shift, specialty }) => ({
  id: assignment.id, groupName: request.groupName, departments: request.departments || '', preferredDate: request.preferredDate || null,
  shiftDate: shift?.date || null, shift: shift?.shift || null, specialtyName: specialty?.name || '', capacityAllocated: assignment.capacityAllocated,
  note: assignment.note || '', sourceFileAvailable: Boolean(request.sourceFileId), sourceFileName: request.sourceFileName || '',
  resultStatus: assignment.resultStatus, resultFiles: (assignment.resultFiles || []).map((file) => ({ version: file.version, originalName: file.originalName, size: file.size, uploadedAt: file.uploadedAt?.toISOString(), reviewStatus: file.reviewStatus, reviewedAt: file.reviewedAt?.toISOString(), reviewNote: file.reviewNote || '' })),
});
const listMine = async (doctor) => {
  const assignments = await GroupHealthAssignment.find({ doctorId: doctor.id }).sort({ createdAt: -1 }).lean();
  const rows = await Promise.all(assignments.map(async (assignment) => {
    try { return serialize(await loadAssignment(doctor, assignment.id)); } catch (error) { if (error.statusCode === 404) return null; throw error; }
  }));
  return rows.filter(Boolean);
};
const validateFile = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) throw new ApiError(400, 'A file is required');
  if (file.size < 1 || file.size > MAX_FILE_SIZE) throw new ApiError(413, 'File size must be between 1 byte and 15 MB');
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!EXTENSIONS[extension]) throw new ApiError(400, 'Upload a CSV, XLS, XLSX, or PDF file');
  const buffer = file.buffer;
  const isPdf = extension === '.pdf' && buffer.subarray(0, 5).toString() === '%PDF-';
  const isXls = extension === '.xls' && buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
  const isXlsx = extension === '.xlsx' && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  let isCsv = false;
  if (extension === '.csv' && !buffer.includes(0)) { try { new TextDecoder('utf-8', { fatal: true }).decode(buffer); isCsv = true; } catch {} }
  if (!isPdf && !isXls && !isXlsx && !isCsv) throw new ApiError(400, 'File contents do not match the selected file type');
  return { extension, originalName: path.basename(file.originalname).replace(/[\\/\0-\x1f]/g, '_').slice(0, 255) || `group-health-result${extension}`, mimeType: EXTENSIONS[extension] };
};
const uploadToGridFs = (file, assignment, doctor) => new Promise((resolve, reject) => {
  const fileId = new mongoose.Types.ObjectId();
  const upload = getBucket().openUploadStream(`${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`, { id: fileId, metadata: { purpose: 'GROUP_HEALTH_RESULT', assignmentId: assignment.id, doctorId: doctor.id, contentType: file.mimetype } });
  upload.once('error', reject); upload.once('finish', () => resolve(fileId)); upload.end(file.buffer);
});
const deleteFile = async (fileId) => { try { await getBucket().delete(fileId); } catch {} };
const uploadResult = async (doctor, assignmentId, file) => {
  const info = validateFile(file); const { assignment, request } = await loadAssignment(doctor, assignmentId);
  if (request.status !== 'APPROVED') throw new ApiError(409, 'Results can only be uploaded while the group health request is APPROVED');
  const fileId = await uploadToGridFs(file, assignment, doctor);
  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const current = await GroupHealthAssignment.findOne({ id: assignment.id, doctorId: doctor.id }).lean();
      if (!current) throw new ApiError(404, 'Assignment not found');
      const nextVersion = Number(current.resultVersion || 0) + 1;
      const updated = await GroupHealthAssignment.findOneAndUpdate({ id: assignment.id, doctorId: doctor.id, resultVersion: current.resultVersion }, { $set: { resultVersion: nextVersion, resultStatus: 'UPLOADED' }, $push: { resultFiles: { fileId, version: nextVersion, originalName: info.originalName, mimeType: info.mimeType, size: file.size, uploadedBy: doctor.id, uploadedAt: new Date(), reviewStatus: 'PENDING_ADMIN_REVIEW' } } }, { new: true, runValidators: true }).lean();
      if (updated) return serialize({ ...await loadAssignment(doctor, assignment.id), assignment: updated });
    }
    throw new ApiError(409, 'Could not allocate a result file version; please retry');
  } catch (error) { await deleteFile(fileId); throw error; }
};
const getFileForDownload = async (doctor, assignmentId, kind, version) => {
  const { assignment, request } = await loadAssignment(doctor, assignmentId); let fileId; let originalName;
  if (kind === 'source') { fileId = request.sourceFileId; originalName = request.sourceFileName; }
  else { const found = (assignment.resultFiles || []).find((f) => f.version === Number(version)); if (!found) throw new ApiError(404, 'Result file version not found'); fileId = found.fileId; originalName = found.originalName; }
  if (!fileId) throw new ApiError(404, 'File not found');
  const [file] = await getBucket().find({ _id: fileId }).toArray();
  const matches = kind === 'source'
    ? String(file?.metadata?.requestId) === String(request.id) && file?.metadata?.purpose === 'GROUP_HEALTH_SOURCE'
    : String(file?.metadata?.assignmentId) === String(assignment.id) && Number(file?.metadata?.doctorId) === doctor.id && file?.metadata?.purpose === 'GROUP_HEALTH_RESULT';
  if (!file || !matches) throw new ApiError(404, 'File not found');
  return { fileId, originalName: originalName || file.filename };
};
const openFileStream = (fileId) => getBucket().openDownloadStream(fileId);
module.exports = { listMine, uploadResult, getFileForDownload, openFileStream, MAX_FILE_SIZE };
