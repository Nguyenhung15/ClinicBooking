const env = require('../config/env');

const DEFAULT_TIMEZONE = env.clinicTimeZone || 'Asia/Ho_Chi_Minh';

/**
 * Format a Date object or ISO string into a localized parts map in the specified timezone.
 * @param {Date|string|number} date
 * @param {string} [timeZone]
 * @returns {Record<string, string>}
 */
function getTzParts(date, timeZone = DEFAULT_TIMEZONE) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date passed to timezone formatter: ${date}`);
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  // Some locales or engines format 24:00 for midnight
  if (map.hour === '24') map.hour = '00';
  return map;
}

/**
 * Return date string in "YYYY-MM-DD" formatted according to clinic timezone.
 * @param {Date|string|number} [date=new Date()]
 * @param {string} [timeZone]
 * @returns {string} e.g. "2026-10-31"
 */
function toClinicDateString(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getTzParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Return time string in "HH:mm" formatted according to clinic timezone.
 * @param {Date|string|number} [date=new Date()]
 * @param {string} [timeZone]
 * @returns {string} e.g. "08:30"
 */
function toClinicTimeString(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getTzParts(date, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

/**
 * Convert a clinic date string ("YYYY-MM-DD") and optional time string ("HH:mm") into a UTC Date object.
 * @param {string} dateString e.g. "2026-10-31"
 * @param {string} [timeString="00:00"] e.g. "08:30"
 * @param {string} [timeZone]
 * @returns {Date} UTC Date object
 */
function parseClinicDateTimeToUtc(dateString, timeString = '00:00', timeZone = DEFAULT_TIMEZONE) {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error(`Invalid dateString: ${dateString}`);
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const [hour, minute] = (timeString || '00:00').split(':').map(Number);

  if (!year || !month || !day) {
    throw new Error(`dateString must be in YYYY-MM-DD format, received: ${dateString}`);
  }

  // Treat input as wall-clock time in the given timezone, convert to UTC
  // We approximate by computing offset or using ISO with offset
  // Asia/Ho_Chi_Minh is fixed at UTC+07:00 without DST.
  let offset = '+07:00';
  if (timeZone === 'Asia/Ho_Chi_Minh') {
    offset = '+07:00';
  } else if (timeZone === 'UTC') {
    offset = 'Z';
  } else {
    // Dynamic offset detection
    const testDate = new Date(Date.UTC(year, month - 1, day, hour || 0, minute || 0));
    const parts = getTzParts(testDate, timeZone);
    const tzDate = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute));
    const diffMs = tzDate.getTime() - testDate.getTime();
    const sign = diffMs >= 0 ? '+' : '-';
    const absDiff = Math.abs(diffMs);
    const offsetH = String(Math.floor(absDiff / (3600000))).padStart(2, '0');
    const offsetM = String(Math.floor((absDiff % 3600000) / 60000)).padStart(2, '0');
    offset = `${sign}${offsetH}:${offsetM}`;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour || 0).padStart(2, '0');
  const min = String(minute || 0).padStart(2, '0');
  const isoStr = `${year}-${mm}-${dd}T${hh}:${min}:00${offset === 'Z' ? 'Z' : offset}`;
  return new Date(isoStr);
}

/**
 * Difference in floating hours between two dates (dateA - dateB).
 * @param {Date|string|number} dateA
 * @param {Date|string|number} dateB
 * @returns {number} hours
 */
function diffHours(dateA, dateB) {
  const a = (dateA instanceof Date ? dateA : new Date(dateA)).getTime();
  const b = (dateB instanceof Date ? dateB : new Date(dateB)).getTime();
  return (a - b) / (1000 * 60 * 60);
}

module.exports = {
  DEFAULT_TIMEZONE,
  getTzParts,
  toClinicDateString,
  toClinicTimeString,
  parseClinicDateTimeToUtc,
  diffHours,
};
