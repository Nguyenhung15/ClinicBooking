const { toClinicDateString, toClinicTimeString, DEFAULT_TIMEZONE } = require('../utils/timezone');

class RealClock {
  constructor(timeZone = DEFAULT_TIMEZONE) {
    this.timeZone = timeZone;
  }

  /**
   * Return current UTC Date object
   * @returns {Date}
   */
  now() {
    return new Date();
  }

  /**
   * Return current date in clinic timezone ("YYYY-MM-DD")
   * @returns {string}
   */
  today() {
    return toClinicDateString(this.now(), this.timeZone);
  }

  /**
   * Return current time in clinic timezone ("HH:mm")
   * @returns {string}
   */
  currentTime() {
    return toClinicTimeString(this.now(), this.timeZone);
  }

  /**
   * Return current ISO string in UTC
   * @returns {string}
   */
  toISOString() {
    return this.now().toISOString();
  }
}

class FakeClock {
  constructor(initialDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
    this.timeZone = timeZone;
    this.currentTimeMs = (initialDate instanceof Date ? initialDate : new Date(initialDate)).getTime();
  }

  /**
   * Set the fake clock time
   * @param {Date|string|number} date
   */
  setNow(date) {
    this.currentTimeMs = (date instanceof Date ? date : new Date(date)).getTime();
  }

  /**
   * Advance fake clock by milliseconds
   * @param {number} ms
   */
  advanceByMs(ms) {
    this.currentTimeMs += ms;
  }

  /**
   * Advance fake clock by hours
   * @param {number} hours
   */
  advanceByHours(hours) {
    this.currentTimeMs += hours * 60 * 60 * 1000;
  }

  /**
   * Reset fake clock to real time
   */
  reset() {
    this.currentTimeMs = Date.now();
  }

  now() {
    return new Date(this.currentTimeMs);
  }

  today() {
    return toClinicDateString(this.now(), this.timeZone);
  }

  currentTime() {
    return toClinicTimeString(this.now(), this.timeZone);
  }

  toISOString() {
    return this.now().toISOString();
  }
}

// Global active clock (injectable / replaceable in tests)
let activeClock = new RealClock();

function getClock() {
  return activeClock;
}

function setClock(clockInstance) {
  activeClock = clockInstance;
  return activeClock;
}

function createFakeClock(initialDate, timeZone) {
  return new FakeClock(initialDate, timeZone);
}

module.exports = {
  RealClock,
  FakeClock,
  getClock,
  setClock,
  createFakeClock,
  clock: {
    now: () => activeClock.now(),
    today: () => activeClock.today(),
    currentTime: () => activeClock.currentTime(),
    toISOString: () => activeClock.toISOString(),
  },
};
