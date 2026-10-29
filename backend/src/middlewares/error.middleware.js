const multer = require('multer');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

const notFound = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose duplicate key error (e.g. duplicate email or specialty name)
  if (err.code === 11000) {
    statusCode = 409;
    const dupField = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (dupField === 'email') {
      message = 'Email đã tồn tại trong hệ thống';
    } else if (dupField === 'name') {
      message = 'Tên đã tồn tại trong hệ thống';
    } else {
      message = `Dữ liệu bị trùng lặp (${dupField || 'unique constraint'})`;
    }
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    const details = Object.values(err.errors || {}).map((e) => e.message);
    message = details.length ? details.join('; ') : 'Dữ liệu đầu vào không hợp lệ';
  } else if (err instanceof multer.MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Kích thước file vượt quá giới hạn cho phép'
        : `Lỗi tải file: ${err.message}`;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier';
  }

  if (statusCode >= 500 && env.nodeEnv !== 'test') {
    console.error(err);
  }
  res.status(statusCode).json({
    success: false,
    message,
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
