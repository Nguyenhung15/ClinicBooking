const { AuditLog } = require('../models');

const SENSITIVE_KEYS = new Set([
  'password',
  'temporaryPassword',
  'temporaryPasswordExpiresAt',
  '_id',
  '__v',
]);

function sanitizeSnapshot(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const raw = typeof obj.toJSON === 'function' ? obj.toJSON() : { ...obj };
  const cleaned = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!SENSITIVE_KEYS.has(key)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Compute field-by-field before/after diff between two plain snapshots.
 */
function buildAuditDiff(beforeObj, afterObj, trackedFields = null) {
  const beforeClean = sanitizeSnapshot(beforeObj) || {};
  const afterClean = sanitizeSnapshot(afterObj) || {};
  const keys = trackedFields || [
    ...new Set([...Object.keys(beforeClean), ...Object.keys(afterClean)]),
  ];

  const before = {};
  const after = {};

  for (const key of keys) {
    if (SENSITIVE_KEYS.has(key) || key === 'updatedAt' || key === 'createdAt') continue;
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
 * Persist an audit trail entry (`actor`, `createdAt` time, `reason`, `changes`).
 */
async function recordAudit({
  actor,
  action,
  targetType,
  targetId,
  reason = null,
  changes = null,
  req = null,
}) {
  if (!actor || !actor.id) {
    throw new Error('recordAudit requires an authenticated actor with numeric id');
  }

  const normalizedReason =
    typeof reason === 'string' && reason.trim() ? reason.trim() : null;

  return AuditLog.create({
    actorId: actor.id,
    actorEmail: actor.email || null,
    actorRole: actor.userType || 'Unknown',
    action,
    targetType,
    targetId,
    reason: normalizedReason,
    changes,
    ipAddress: extractClientIp(req),
    userAgent: req?.headers?.['user-agent'] || null,
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
  if (targetId !== undefined && targetId !== '') filter.targetId = Number(targetId);
  if (actorId !== undefined && actorId !== '') filter.actorId = Number(actorId);
  if (action) filter.action = String(action).trim();

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1, id: -1 }).skip(skip).limit(safeLimit),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => item.toJSON()),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

module.exports = {
  sanitizeSnapshot,
  buildAuditDiff,
  recordAudit,
  queryAuditLogs,
};

