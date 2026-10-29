const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Require a valid Bearer JWT and ensure the user exists and is enabled (`isEnable === true`).
 */
async function authenticate(req, _res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, 'Vui lòng đăng nhập để tiếp tục');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    }
    throw new ApiError(401, 'Token xác thực không hợp lệ');
  }

  const userId = Number(decoded.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError(401, 'Thông tin định danh trong token không hợp lệ');
  }

  const user = await User.findOne({ id: userId });
  if (!user) {
    throw new ApiError(401, 'Tài khoản không tồn tại');
  }

  if (!user.isEnable) {
    throw new ApiError(403, 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên');
  }

  req.user = user;
  next();
}

/**
 * Attach `req.user` if a valid Bearer token is provided; otherwise proceed as Guest.
 */
async function optionalAuthenticate(req, _res, next) {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    const userId = Number(decoded.userId);
    if (Number.isInteger(userId) && userId > 0) {
      const user = await User.findOne({ id: userId });
      if (user && user.isEnable) {
        req.user = user;
      }
    }
  } catch {
    // Ignore invalid optional tokens on public endpoints
  }
  return next();
}

/**
 * Authorize only specific `userType` roles (e.g. authorize(ROLES.ADMIN, ROLES.RECEPTIONIST)).
 */
function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Vui lòng đăng nhập để tiếp tục');
    }
    if (!allowedRoles.includes(req.user.userType)) {
      throw new ApiError(403, 'Bạn không có quyền thực hiện thao tác này');
    }
    next();
  };
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
};

