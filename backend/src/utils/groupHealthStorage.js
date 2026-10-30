const mongoose = require('mongoose');
const ApiError = require('./ApiError');

const GROUP_HEALTH_BUCKET_NAME = 'group_health_files';

const GROUP_HEALTH_FILE_PURPOSES = Object.freeze({
  SOURCE: 'GROUP_HEALTH_SOURCE',
  RESULT: 'GROUP_HEALTH_RESULT',
});

const SAFE_INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function getGroupHealthBucket() {
  if (!mongoose.connection.db) {
    throw new ApiError(503, 'Hệ thống lưu trữ file chưa sẵn sàng');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: GROUP_HEALTH_BUCKET_NAME,
  });
}

async function findGridFsFileById(fileId) {
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    return null;
  }
  const objectId =
    fileId instanceof mongoose.Types.ObjectId
      ? fileId
      : new mongoose.Types.ObjectId(String(fileId));
  const [gridFsFile] = await getGroupHealthBucket().find({ _id: objectId }).toArray();
  return gridFsFile || null;
}

async function verifyResultFileInStorage(fileId, assignmentId) {
  const gridFsFile = await findGridFsFileById(fileId);
  if (!gridFsFile || Number(gridFsFile.length || 0) < 1) {
    return { exists: false, gridFsFile: null };
  }
  const metadata = gridFsFile.metadata || {};
  const matchesAssignment =
    metadata.purpose === GROUP_HEALTH_FILE_PURPOSES.RESULT &&
    String(metadata.assignmentId) === String(assignmentId);
  return {
    exists: matchesAssignment,
    gridFsFile: matchesAssignment ? gridFsFile : null,
  };
}

async function verifySourceFileInStorage(fileId, requestId) {
  const gridFsFile = await findGridFsFileById(fileId);
  if (!gridFsFile || Number(gridFsFile.length || 0) < 1) {
    return { exists: false, gridFsFile: null };
  }
  const metadata = gridFsFile.metadata || {};
  const matchesRequest =
    metadata.purpose === GROUP_HEALTH_FILE_PURPOSES.SOURCE &&
    String(metadata.requestId) === String(requestId);
  return {
    exists: matchesRequest,
    gridFsFile: matchesRequest ? gridFsFile : null,
  };
}

function openGridFsDownloadStream(fileId) {
  const objectId =
    fileId instanceof mongoose.Types.ObjectId
      ? fileId
      : new mongoose.Types.ObjectId(String(fileId));
  return getGroupHealthBucket().openDownloadStream(objectId);
}

function encodeRfc5987FileName(fileName) {
  return encodeURIComponent(fileName || 'group-health-file').replace(
    /['()]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function streamFileToResponse(res, { fileId, originalName, mimeType, size, disposition = 'attachment' }, next) {
  const normalizedDisposition = disposition === 'inline' ? 'inline' : 'attachment';
  const resolvedMimeType =
    normalizedDisposition === 'inline' && SAFE_INLINE_MIME_TYPES.has(mimeType)
      ? mimeType
      : SAFE_INLINE_MIME_TYPES.has(mimeType)
        ? mimeType
        : 'application/octet-stream';

  const headers = {
    'Content-Type': resolvedMimeType,
    'Content-Disposition': `${normalizedDisposition}; filename*=UTF-8''${encodeRfc5987FileName(originalName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  };
  if (Number.isFinite(size) && size > 0) {
    headers['Content-Length'] = String(size);
  }

  res.set(headers);
  const stream = openGridFsDownloadStream(fileId);
  stream.once('error', (error) => {
    if (res.headersSent) {
      res.destroy(error);
    } else {
      next(error);
    }
  });
  stream.pipe(res);
}

module.exports = {
  GROUP_HEALTH_BUCKET_NAME,
  GROUP_HEALTH_FILE_PURPOSES,
  getGroupHealthBucket,
  findGridFsFileById,
  verifyResultFileInStorage,
  verifySourceFileInStorage,
  openGridFsDownloadStream,
  streamFileToResponse,
};

