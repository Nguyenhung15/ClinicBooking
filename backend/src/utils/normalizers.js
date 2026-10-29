const ApiError = require('./ApiError');
const { GENDERS, ROLE_VALUES } = require('../constants/enums');

/**
 * Normalize gender variants ('MALE' | 'Male' | 'Nam' | ...) -> 'Male' | 'Female' | 'Other'
 */
function normalizeGender(value) {
  if (typeof value !== 'string') return GENDERS.OTHER;
  const normalized = value.trim().toLowerCase();
  if (['male', 'nam', 'm'].includes(normalized)) return GENDERS.MALE;
  if (['female', 'nu', 'nữ', 'f'].includes(normalized)) return GENDERS.FEMALE;
  return GENDERS.OTHER;
}

/**
 * Normalize email to lowercase & trimmed string.
 */
function normalizeEmail(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'Email không hợp lệ');
  }
  const email = value.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, 'Định dạng email không hợp lệ');
  }
  return email;
}

/**
 * Normalize user role case-insensitively to canonical 'Patient' | 'Doctor' | 'Receptionist' | 'Admin'.
 */
function normalizeRole(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'Vai trò người dùng (userType) không hợp lệ');
  }
  const lower = value.trim().toLowerCase();
  const matched = ROLE_VALUES.find((role) => role.toLowerCase() === lower);
  if (!matched) {
    throw new ApiError(
      400,
      `Vai trò '${value}' không hợp lệ. Chỉ chấp nhận: ${ROLE_VALUES.join(', ')}`,
    );
  }
  return matched;
}

/**
 * Parse and validate a positive integer ID from route params or query.
 */
function parsePositiveInt(value, fieldName = 'ID') {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ApiError(400, `${fieldName} không hợp lệ`);
  }
  return num;
}

/**
 * Escape special regex characters to prevent ReDoS on keyword search.
 */
function escapeRegex(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  normalizeGender,
  normalizeEmail,
  normalizeRole,
  parsePositiveInt,
  escapeRegex,
};

