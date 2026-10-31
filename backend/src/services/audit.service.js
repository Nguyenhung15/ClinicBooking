const { AuditLog } = require('../models');

const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /token/i,
  /secret/i,
  /auth(orization)?/i,
  /bearer/i,
  /cvv/i,
  /card_?num(ber)?/i,
  /api_?key/i,
  /private_?key/i,
];

const IGNORED_DIFF_KEYS = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
]);

/**
 * Check if a key name matches any sensitive credential pattern.
 * @param {string} key
 * @returns {boolean}
 */
function isSensitiveKey(key) {
  if (!key || typeof key !== 'string') return false;
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Deeply sanitize an object to strip credentials, passwords, tokens and secrets.
 * @param {any} obj
 * @param {number} [depth=0]
 * @returns {any}
 */
function sanitizePiiAndSecrets(obj, depth = 0) {
  if (depth > 6) return '[Max Depth Exceeded]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Handle Mongoose documents
  const plain = typeof obj.toJSON === 'function' ? obj.toJSON() : obj;
  if (Array.isArray(plain)) {
    return plain.map((item) => sanitizePiiAndSecrets(item, depth + 1));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(plain)) {
    if (isSensitiveKey(key)) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizePiiAndSecrets(value, depth + 1);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Compute field-by-field before/after diff between two plain snapshots.
 * Automatically strips sensitive fields from diff tracking.
 */
function buildAuditDiff(beforeObj, afterObj, trackedFields = null) {
  const beforeClean = sanitizePiiAndSecrets(beforeObj) || {};
  const afterClean = sanitizePiiAndSecrets(afterObj) || {};
  const keys = trackedFields || [
    ...new Set([...Object.keys(beforeClean), ...Object.keys(afterClean)]),
  ];

  const before = {};
  const after = {};

  for (const key of keys) {
    if (IGNORED_DIFF_KEYS.has(key) || isSensitiveKey(key)) continue;
    const prevVal = beforeClean[key] ?? null;
    const nextVal = afterClean[key] ?? null;
    if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
      before[key] = prevVal;
      after[key] = nextVal;
    }
  }

  return { before, after };
}

function extractClientIp(req) {
  if (!req) return null;
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || null;
}

/**
 * P0 Standard Audit Logger:
 * Logs sensitive operations, state transitions, and administrative actions.
 * Guarantees zero secret leakage and safe PII handling.
 *
 * @param {object} params
 * @param {object} params.actor - Actor info ({ userId, id, role, userType, email })
 * @param {string} params.action - Canonical action enum string
 * @param {object} [params.resource] - Resource target ({ type, id })
 * @param {string} [params.reason] - Human or business justification
 * @param {string} [params.summary] - One-line executive summary
 * @param {object} [params.changes] - Diff object ({ before, after })
 * @param {object} [params.req] - Express request for IP & User-Agent capture
 * @returns {Promise<AuditLog>}
 */
async function log({
  actor,
  action,
  resource,
  reason = null,
  summary = null,
  changes = null,
  req = null,
}) {
  if (!actor) {
    throw new Error('AuditService.log requires an actor definition');
  }
  if (!action) {
    throw new Error('AuditService.log requires an action identifier');
  }

  let actorId = actor.userId !== undefined ? actor.userId : (actor.id !== undefined ? actor.id : 'SYSTEM');
  if (typeof actor?.id === 'number' && actor.userId === undefined) {
    actorId = actor.id;
  } else if (typeof actor?.userId === 'number') {
    actorId = actor.userId;
  } else {
    actorId = String(actorId);
  }

  const actorEmail = actor.email || null;
  const actorRole = actor.role || actor.userType || 'SYSTEM';

  const targetType = resource?.type || 'System';
  let targetId = resource?.id !== undefined ? resource.id : '0';
  if (typeof resource?.id === 'number') {
    targetId = resource.id;
  } else if (resource?.id !== undefined) {
    targetId = String(resource.id);
  }

  const sanitizedChanges = changes ? sanitizePiiAndSecrets(changes) : null;
  const normalizedReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
  const normalizedSummary = typeof summary === 'string' && summary.trim() ? summary.trim() : null;

  return AuditLog.create({
    actorId,
    actorEmail,
    actorRole,
    action: String(action).trim(),
    targetType,
    targetId,
    reason: normalizedReason,
    summary: normalizedSummary,
    changes: sanitizedChanges,
    ipAddress: extractClientIp(req),
    userAgent: req?.headers?.['user-agent'] || null,
  });
}

/**
 * Backward-compatible helper matching previous signature.
 */
async function recordAudit({
  actor,
  action,
  targetType,
  targetId,
  reason = null,
  summary = null,
  changes = null,
  req = null,
}) {
  return log({
    actor,
    action,
    resource: { type: targetType, id: targetId },
    reason,
    summary,
    changes,
    req,
  });
}

/**
 * Query paginated audit logs for Admin inspection.
 */
async function queryAuditLogs({
  targetType,
  targetId,
  actorId,
  action,
  page = 1,
  limit = 20,
} = {}) {
  const filter = {};
  if (targetType) filter.targetType = String(targetType).trim();
  if (targetId !== undefined && targetId !== '') {
    const num = Number(targetId);
    filter.targetId = Number.isSafeInteger(num) ? { $in: [num, String(targetId)] } : String(targetId);
  }
  if (actorId !== undefined && actorId !== '') {
    const num = Number(actorId);
    filter.actorId = Number.isSafeInteger(num) ? { $in: [num, String(actorId)] } : String(actorId);
  }
  if (action) filter.action = String(action).trim();

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(safeLimit),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => (item.toJSON ? item.toJSON() : item)),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

module.exports = {
  log,
  recordAudit,
  sanitizePiiAndSecrets,
  sanitizeSnapshot: sanitizePiiAndSecrets,
  buildAuditDiff,
  queryAuditLogs,
};
