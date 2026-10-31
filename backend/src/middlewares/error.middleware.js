const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

/**
 * Generate or retrieve trace ID for request correlation.
 * @param {import('express').Request} req
 * @returns {string}
 */
function getTraceId(req) {
  if (req?.traceId) return req.traceId;
  const headerTrace = req?.headers?.['x-request-id'] || req?.headers?.['x-trace-id'];
  if (typeof headerTrace === 'string' && headerTrace.trim()) {
    req.traceId = headerTrace.trim();
    return req.traceId;
  }
  req.traceId = `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  return req.traceId;
}

const notFound = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const traceId = getTraceId(req);
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Đã xảy ra lỗi hệ thống nội bộ';
  let details = Array.isArray(err.details) ? err.details : (err.details ? [err.details] : []);

  // Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    const dupField = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (dupField === 'email') {
      message = 'Email đã tồn tại trong hệ thống';
    } else if (dupField === 'name') {
      message = 'Tên đã tồn tại trong hệ thống';
    } else if (dupField === 'appointmentNo') {
      message = 'Mã lịch hẹn đã tồn tại';
    } else {
      message = `Dữ liệu bị trùng lặp trên trường '${dupField || 'unique constraint'}'`;
    }
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = details.length ? details.map((d) => d.message).join('; ') : 'Dữ liệu đầu vào không hợp lệ';
  } else if (err instanceof multer.MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR';
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Kích thước file vượt quá giới hạn cho phép'
        : `Lỗi tải file: ${err.message}`;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Định danh tài nguyên không hợp lệ: ${err.value}`;
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Token xác thực không hợp lệ';
  }

  // Fallback status code mapping if still default
  if (statusCode === 500 && err instanceof ApiError) {
    code = err.code || 'INTERNAL_SERVER_ERROR';
  }

  if (statusCode >= 500 && env.nodeEnv !== 'test') {
    console.error(`[ErrorHandler][${traceId}]`, err);
  }

  res.setHeader('X-Trace-Id', traceId);

  // Unified error envelope: { code, message, details, traceId }
  // Keeps top-level `message` for 100% compatibility with frontend Axios error handling
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
      traceId,
    },
    message,
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
};

module.exports = {
  getTraceId,
  notFound,
  errorHandler,
};
