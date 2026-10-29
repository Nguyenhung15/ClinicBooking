const path = require('node:path');
const multer = require('multer');
const { Router } = require('express');
const {
  downloadResultFile,
  downloadSourceFile,
  getMyAssignments,
  uploadResult,
} = require('../controllers/doctorGroupHealth.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/enums');
const ApiError = require('../utils/ApiError');
const { MAX_FILE_SIZE } = require('../services/doctorGroupHealth.service');

const ACCEPTED_EXTENSIONS = new Set(['.csv', '.pdf', '.xls', '.xlsx']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!ACCEPTED_EXTENSIONS.has(extension)) {
      callback(new ApiError(400, 'Upload a CSV, XLS, XLSX, or PDF file'));
      return;
    }
    callback(null, true);
  },
});

const router = Router();
router.use(authenticate, authorize(ROLES.DOCTOR));
router.get('/assignments/my', getMyAssignments);
router.get('/assignments/:assignmentId/source', downloadSourceFile);
router.get('/assignments/:assignmentId/results/:version', downloadResultFile);
router.post('/assignments/:assignmentId/result', (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'File size must not exceed 15 MB'
        : 'Upload exactly one result file';
      return next(new ApiError(statusCode, message));
    }
    return next(error);
  });
}, uploadResult);

module.exports = router;
