const ApiError = require('../utils/ApiError');
const { CONTENT_MANAGER_ROLES, ROLE_VALUES } = require('../constants/enums');

const DEFAULT_CONTENT_POLICY = Object.freeze({
  policyCode: 'CLINIC_RSS_CONTENT_POLICY_V1',
  allowedSchemes: Object.freeze(['http:', 'https:']),
  allowedPorts: Object.freeze(['', '80', '443', '8080', '8443']),
  maxRedirects: 3,
  fetchTimeoutMs: 5000,
  maxFeedBytes: 1024 * 1024, // 1 MB
  maxItemsPerSync: 100,
});

function resolveAllowedContentRoles() {
  const rawEnv = process.env.CONTENT_MANAGER_ROLES;
  if (!rawEnv || typeof rawEnv !== 'string' || !rawEnv.trim()) {
    return CONTENT_MANAGER_ROLES;
  }
  const configured = rawEnv
    .split(',')
    .map((item) => item.trim())
    .filter((role) => ROLE_VALUES.includes(role));
  return configured.length > 0 ? configured : CONTENT_MANAGER_ROLES;
}

/**
 * UC-ADM-09 Precondition Guard:
 * Ensures the authenticated user belongs to an approved Content Management Role
 * and attaches the active content security policy onto `req.contentPolicy`.
 */
function requireContentPolicy(req, _res, next) {
  if (!req.user) {
    throw new ApiError(401, 'Vui lòng đăng nhập để tiếp tục');
  }

  if (!req.user.isEnable) {
    throw new ApiError(403, 'Tài khoản của bạn đã bị vô hiệu hóa');
  }

  const allowedRoles = resolveAllowedContentRoles();
  if (!allowedRoles.includes(req.user.userType)) {
    throw new ApiError(
      403,
      'Tài khoản chưa được cấp quyền chính sách quản lý nội dung (Content Policy)',
    );
  }

  req.contentPolicy = {
    ...DEFAULT_CONTENT_POLICY,
    allowedRoles,
    grantedRole: req.user.userType,
  };

  return next();
}

module.exports = {
  DEFAULT_CONTENT_POLICY,
  resolveAllowedContentRoles,
  requireContentPolicy,
};

