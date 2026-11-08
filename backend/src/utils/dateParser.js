const ApiError = require('./ApiError');
const { parseClinicDateTimeToUtc, DEFAULT_TIMEZONE } = require('./timezone');

const DD_MM_YYYY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/;

/**
 * Parse date input sent by Frontend ("dd/MM/yyyy HH:mm", ISO-8601 string, or Date object).
 * AdminVouchers.tsx and AdminEvents.tsx send "dd/MM/yyyy HH:mm" in clinic local time,
 * while reading expects standard ISO-8601 UTC Date.
 *
 * @param {string|Date|number|null|undefined} input
 * @param {object} [options]
 * @param {string} [options.fieldName='Ngày giờ']
 * @param {boolean} [options.required=false]
 * @param {string} [options.timeZone=DEFAULT_TIMEZONE]
 * @returns {Date|null}
 */
function parseFlexibleDate(input, options = {}) {
  const {
    fieldName = 'Ngày giờ',
    required = false,
    timeZone = DEFAULT_TIMEZONE,
  } = options;

  if (input === undefined || input === null || String(input).trim() === '') {
    if (required) {
      throw new ApiError(400, `${fieldName} không được để trống`);
    }
    return null;
  }

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new ApiError(400, `${fieldName} không hợp lệ`);
    }
    return input;
  }

  const str = String(input).trim();
  const match = str.match(DD_MM_YYYY_REGEX);
  if (match) {
    const [, ddStr, mmStr, yyyyStr, hhStr = '23', minStr = '59'] = match;
    const day = Number(ddStr);
    const month = Number(mmStr);
    const year = Number(yyyyStr);
    const hour = Number(hhStr);
    const minute = Number(minStr);

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      throw new ApiError(400, `${fieldName} không hợp lệ`);
    }

    // Verify calendar day validity (e.g. reject 31/02/2026)
    const testUtc = new Date(Date.UTC(year, month - 1, day));
    if (
      testUtc.getUTCFullYear() !== year ||
      testUtc.getUTCMonth() + 1 !== month ||
      testUtc.getUTCDate() !== day
    ) {
      throw new ApiError(400, `${fieldName} không tồn tại trên lịch`);
    }

    const dateString = `${yyyyStr}-${mmStr}-${ddStr}`;
    const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return parseClinicDateTimeToUtc(dateString, timeString, timeZone);
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `${fieldName} không đúng định dạng (hỗ trợ dd/MM/yyyy HH:mm hoặc ISO-8601)`);
  }
  return parsed;
}

module.exports = {
  parseFlexibleDate,
};

