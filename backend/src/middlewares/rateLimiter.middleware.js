const ApiError = require('../utils/ApiError');
const env = require('../config/env');

class MemoryRateLimitStore {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.hits = new Map();
    // Periodic sweep to prevent memory leak
    this.cleanupTimer = setInterval(() => this.cleanup(), Math.max(10000, windowMs));
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  increment(key, now) {
    const record = this.hits.get(key);
    if (!record || now > record.resetTime) {
      const resetTime = now + this.windowMs;
      this.hits.set(key, { count: 1, resetTime });
      return { count: 1, resetTime };
    }
    record.count += 1;
    return record;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now > record.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  reset() {
    this.hits.clear();
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.reset();
  }
}

/**
 * Reusable Rate Limiter Factory:
 * Enforces per-user (or fallback per-IP) request rate limits.
 *
 * @param {object} [options={}]
 * @param {number} [options.windowMs=60000] - Window duration in ms
 * @param {number} [options.max=100] - Max requests permitted in window
 * @param {string} [options.message] - Custom rate limit message
 * @param {(req: import('express').Request) => string} [options.keyGenerator] - Key extraction function
 * @returns {import('express').RequestHandler & { store: MemoryRateLimitStore, reset: () => void }}
 */
function createRateLimiter({
  windowMs = env.rateLimitWindowMs || 60000,
  max = env.rateLimitMax || 100,
  message = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau',
  keyGenerator = null,
} = {}) {
  const store = new MemoryRateLimitStore(windowMs);

  const defaultKeyGen = (req) => {
    if (req.user?.id || req.user?._id || req.authPrincipal?.userId) {
      const uid = String(req.authPrincipal?.userId || req.user?.id || req.user?._id);
      return `usr:${uid}`;
    }
    const forwarded = req.headers?.['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip) || '127.0.0.1';
    return `ip:${ip}`;
  };

  const keyGen = typeof keyGenerator === 'function' ? keyGenerator : defaultKeyGen;

  const limiterMiddleware = (req, res, next) => {
    // In test environment, skip limiting unless specifically testing rate limiter
    if (process.env.NODE_ENV === 'test' && !req.headers?.['x-test-rate-limit']) {
      return next();
    }

    const key = keyGen(req);
    const now = Date.now();
    const { count, resetTime } = store.increment(key, now);
    const remaining = Math.max(0, max - count);
    const resetSeconds = Math.ceil((resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (count > max) {
      res.setHeader('Retry-After', resetSeconds);
      throw ApiError.tooManyRequests(message, 'RATE_LIMIT_EXCEEDED', {
        limit: max,
        current: count,
        retryAfterSeconds: resetSeconds,
      });
    }

    next();
  };

  limiterMiddleware.store = store;
  limiterMiddleware.reset = () => store.reset();

  return limiterMiddleware;
}

const defaultRateLimiter = createRateLimiter();

module.exports = {
  createRateLimiter,
  defaultRateLimiter,
  MemoryRateLimitStore,
};
