const doctorGroupHealthService = require('../services/doctorGroupHealth.service');

const getMyAssignments = async (req, res) => {
  const assignments = await doctorGroupHealthService.listMine(req.user);
  res.json({ success: true, message: 'Your approved group health assignments', data: assignments });
};

const uploadResult = async (req, res) => {
  const assignment = await doctorGroupHealthService.uploadResult(req.user, req.params.assignmentId, req.file);
  res.status(201).json({ success: true, message: 'Result uploaded for Admin review', data: assignment });
};

const sendDownload = async (res, file, stream, next) => {
  const safeName = encodeURIComponent(file.originalName).replace(/['()]/g, (character) =>
    '%' + character.charCodeAt(0).toString(16).toUpperCase(),
  );
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  stream.once('error', (error) => {
    if (res.headersSent) res.destroy(error);
    else next(error);
  });
  stream.pipe(res);
};

const downloadSourceFile = async (req, res, next) => {
  const file = await doctorGroupHealthService.getFileForDownload(
    req.user,
    req.params.assignmentId,
    'source',
  );
  return sendDownload(res, file, doctorGroupHealthService.openFileStream(file.fileId), next);
};

const downloadResultFile = async (req, res, next) => {
  const file = await doctorGroupHealthService.getFileForDownload(
    req.user,
    req.params.assignmentId,
    'result',
    req.params.version,
  );
  return sendDownload(res, file, doctorGroupHealthService.openFileStream(file.fileId), next);
};

module.exports = { getMyAssignments, uploadResult, downloadSourceFile, downloadResultFile };
