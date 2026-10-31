function getDefaultCode(statusCode) {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR';
  }
}

class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {string} [code]
   * @param {any[]} [details=[]]
   */
  constructor(statusCode, message, code = null, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || getDefaultCode(statusCode);
    this.details = Array.isArray(details) ? details : (details ? [details] : []);
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Dữ liệu yêu cầu không hợp lệ', code = 'BAD_REQUEST', details = []) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Vui lòng đăng nhập để tiếp tục', code = 'UNAUTHORIZED', details = []) {
    return new ApiError(401, message, code, details);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này', code = 'FORBIDDEN', details = []) {
    return new ApiError(403, message, code, details);
  }

  static notFound(message = 'Không tìm thấy tài nguyên yêu cầu', code = 'NOT_FOUND', details = []) {
    return new ApiError(404, message, code, details);
  }

  static conflict(message = 'Xung đột trạng thái dữ liệu', code = 'CONFLICT', details = []) {
    return new ApiError(409, message, code, details);
  }

  static tooManyRequests(message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau', code = 'RATE_LIMIT_EXCEEDED', details = []) {
    return new ApiError(429, message, code, details);
  }

  static internal(message = 'Đã xảy ra lỗi hệ thống nội bộ', code = 'INTERNAL_SERVER_ERROR', details = []) {
    return new ApiError(500, message, code, details);
  }
}

module.exports = ApiError;
