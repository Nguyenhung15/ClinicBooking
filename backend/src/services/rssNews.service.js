const { RssSource, News } = require('../models');
const { AUDIT_ACTIONS, RSS_SOURCE_STATUSES } = require('../constants/enums');
const { DEFAULT_CONTENT_POLICY } = require('../middlewares/contentPolicy.middleware');
const { buildAuditDiff, recordAudit } = require('./audit.service');
const { validateExternalFeedUrl, fetchRssFeedSafely } = require('../utils/rssSecurity');
const { parseRssOrAtomXml } = require('../utils/rssFeedParser');
const ApiError = require('../utils/ApiError');

const MAX_PUBLIC_NEWS_LIMIT = 50;
const MAX_ADMIN_NEWS_LIMIT = 100;

// Injectable network hooks (default = hardened production DNS + pinned HTTP client)
let customNetworkDeps = null;

function setNetworkDependencies(deps) {
  customNetworkDeps = deps || null;
}

function resetNetworkDependencies() {
  customNetworkDeps = null;
}

function getEffectiveNetworkDeps() {
  return customNetworkDeps || {};
}

function parsePositiveInt(value, label = 'ID') {
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num < 1) {
    throw new ApiError(400, `${label} không hợp lệ`);
  }
  return num;
}

function clampLimit(rawLimit, defaultLimit, maxLimit) {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return defaultLimit;
  }
  const parsed = Number(rawLimit);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxLimit) {
    throw new ApiError(
      400,
      `Tham số limit phải là số nguyên từ 1 đến ${maxLimit}`,
    );
  }
  return parsed;
}

function resolveDesiredStatus(payload = {}, fallbackStatus = RSS_SOURCE_STATUSES.ACTIVE) {
  if (payload.status !== undefined && payload.status !== null && payload.status !== '') {
    const normalized = String(payload.status).trim().toLowerCase();
    if (normalized === 'active' || normalized === 'enabled') {
      return RSS_SOURCE_STATUSES.ACTIVE;
    }
    if (normalized === 'inactive' || normalized === 'disabled') {
      return RSS_SOURCE_STATUSES.INACTIVE;
    }
    throw new ApiError(400, 'Trạng thái nguồn tin (status) phải là active hoặc inactive');
  }

  const boolVal =
    payload.isEnabled !== undefined ? payload.isEnabled : payload.enabled;
  if (boolVal !== undefined) {
    if (typeof boolVal !== 'boolean') {
      throw new ApiError(400, 'Trường enabled/isEnabled phải là kiểu boolean');
    }
    return boolVal ? RSS_SOURCE_STATUSES.ACTIVE : RSS_SOURCE_STATUSES.INACTIVE;
  }

  return fallbackStatus;
}

function validateSourceMetadata({ name, category }, { partial = false } = {}) {
  const cleaned = {};

  if (!partial || name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'Tên nguồn tin RSS (name) không được để trống');
    }
    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      throw new ApiError(400, 'Tên nguồn tin RSS không được vượt quá 100 ký tự');
    }
    cleaned.name = trimmedName;
  }

  if (!partial || category !== undefined) {
    if (category === null || category === undefined) {
      cleaned.category = '';
    } else if (typeof category !== 'string') {
      throw new ApiError(400, 'Danh mục nguồn tin (category) phải là chuỗi ký tự');
    } else {
      const trimmedCategory = category.trim();
      if (trimmedCategory.length > 50) {
        throw new ApiError(400, 'Danh mục nguồn tin không được vượt quá 50 ký tự');
      }
      cleaned.category = trimmedCategory;
    }
  }

  return cleaned;
}

function serializeSource(sourceDoc, articleCount = undefined) {
  const plain = typeof sourceDoc.toJSON === 'function' ? sourceDoc.toJSON() : { ...sourceDoc };
  delete plain._id;
  delete plain.__v;
  const isEnabled = plain.status === RSS_SOURCE_STATUSES.ACTIVE;

  const result = {
    id: plain.id,
    name: plain.name,
    url: plain.url,
    category: plain.category || '',
    status: plain.status,
    isEnabled,
    enabled: isEnabled,
    createdBy: plain.createdBy ?? null,
    updatedBy: plain.updatedBy ?? null,
    lastSyncedAt: plain.lastSyncedAt ? new Date(plain.lastSyncedAt).toISOString() : null,
    lastSyncStatus: plain.lastSyncStatus || 'IDLE',
    lastSyncError: plain.lastSyncError || null,
    createdAt: plain.createdAt ? new Date(plain.createdAt).toISOString() : null,
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
  };

  if (articleCount !== undefined) {
    result.articleCount = articleCount;
  }

  return result;
}

function serializeNewsArticle(newsDoc, sourceDoc = null) {
  const summary = newsDoc.summary || '';
  const image = newsDoc.image || undefined;

  return {
    id: newsDoc.id,
    title: newsDoc.title,
    link: newsDoc.link,
    summary,
    description: summary,
    pubDate: newsDoc.pubDate ? new Date(newsDoc.pubDate).toISOString() : undefined,
    image,
    imageUrl: image,
    sourceId: newsDoc.sourceId,
    source: sourceDoc
      ? {
          id: sourceDoc.id,
          name: sourceDoc.name,
          category: sourceDoc.category || undefined,
          status: sourceDoc.status,
        }
      : undefined,
    createdAt: newsDoc.createdAt ? new Date(newsDoc.createdAt).toISOString() : undefined,
  };
}

async function listSources({ status, category } = {}) {
  const filter = {};
  if (status !== undefined && status !== '') {
    const normalized = String(status).trim().toLowerCase();
    if (!Object.values(RSS_SOURCE_STATUSES).includes(normalized)) {
      throw new ApiError(400, 'Bộ lọc trạng thái (status) phải là active hoặc inactive');
    }
    filter.status = normalized;
  }
  if (category !== undefined && category !== '') {
    filter.category = String(category).trim();
  }

  const sources = await RssSource.find(filter).sort({ id: -1 }).lean();
  if (sources.length === 0) return [];

  const sourceIds = sources.map((s) => s.id);
  const articleCounts = await News.aggregate([
    { $match: { sourceId: { $in: sourceIds } } },
    { $group: { _id: '$sourceId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(articleCounts.map((row) => [row._id, row.count]));

  return sources.map((s) => serializeSource(s, countMap.get(s.id) || 0));
}

async function getSourceDetail(sourceId) {
  const numericId = parsePositiveInt(sourceId, 'Source ID');
  const source = await RssSource.findOne({ id: numericId }).lean();
  if (!source) {
    throw new ApiError(404, 'Không tìm thấy nguồn tin RSS');
  }
  const articleCount = await News.countDocuments({ sourceId: numericId });
  return serializeSource(source, articleCount);
}

async function createSource(actor, payload = {}, req = null) {
  const metadata = validateSourceMetadata(payload, { partial: false });
  const status = resolveDesiredStatus(payload, RSS_SOURCE_STATUSES.ACTIVE);

  const netDeps = getEffectiveNetworkDeps();
  const { canonicalUrl } = await validateExternalFeedUrl(payload.url, {
    lookupFn: netDeps.lookupFn,
    resolveDns: true,
  });

  if (canonicalUrl.length > 500) {
    throw new ApiError(400, 'URL nguồn tin RSS không được vượt quá 500 ký tự');
  }

  const existing = await RssSource.findOne({ url: canonicalUrl }).lean();
  if (existing) {
    throw new ApiError(409, 'URL nguồn tin RSS này đã tồn tại trong hệ thống');
  }

  let created;
  try {
    created = await RssSource.create({
      name: metadata.name,
      url: canonicalUrl,
      category: metadata.category,
      status,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(409, 'URL nguồn tin RSS này đã tồn tại trong hệ thống');
    }
    throw err;
  }

  const serialized = serializeSource(created, 0);
  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.RSS_SOURCE_CREATE,
    targetType: 'RssSource',
    targetId: created.id,
    reason: payload.reason || `Tạo nguồn tin RSS: ${created.name}`,
    changes: { after: serialized },
    req,
  });

  return serialized;
}

async function updateSource(actor, sourceId, payload = {}, req = null) {
  const numericId = parsePositiveInt(sourceId, 'Source ID');
  const source = await RssSource.findOne({ id: numericId });
  if (!source) {
    throw new ApiError(404, 'Không tìm thấy nguồn tin RSS');
  }

  const beforeSnapshot = serializeSource(source);
  const metadata = validateSourceMetadata(payload, { partial: true });

  if (metadata.name !== undefined) {
    source.name = metadata.name;
  }
  if (metadata.category !== undefined) {
    source.category = metadata.category;
  }

  if (payload.url !== undefined) {
    const netDeps = getEffectiveNetworkDeps();
    const { canonicalUrl } = await validateExternalFeedUrl(payload.url, {
      lookupFn: netDeps.lookupFn,
      resolveDns: true,
    });
    if (canonicalUrl.length > 500) {
      throw new ApiError(400, 'URL nguồn tin RSS không được vượt quá 500 ký tự');
    }

    const duplicate = await RssSource.findOne({
      url: canonicalUrl,
      id: { $ne: numericId },
    }).lean();
    if (duplicate) {
      throw new ApiError(409, 'URL nguồn tin RSS đã thuộc về một nguồn khác');
    }
    source.url = canonicalUrl;
  }

  if (
    payload.status !== undefined ||
    payload.isEnabled !== undefined ||
    payload.enabled !== undefined
  ) {
    source.status = resolveDesiredStatus(payload, source.status);
  }

  source.updatedBy = actor.id;
  await source.save();

  const articleCount = await News.countDocuments({ sourceId: numericId });
  const afterSnapshot = serializeSource(source, articleCount);

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.RSS_SOURCE_UPDATE,
    targetType: 'RssSource',
    targetId: source.id,
    reason: payload.reason || `Cập nhật nguồn tin RSS #${source.id}`,
    changes: buildAuditDiff(beforeSnapshot, afterSnapshot, [
      'name',
      'url',
      'category',
      'status',
    ]),
    req,
  });

  return afterSnapshot;
}

async function setSourceEnabledStatus(actor, sourceId, enableFlag, payload = {}, req = null) {
  const numericId = parsePositiveInt(sourceId, 'Source ID');
  const source = await RssSource.findOne({ id: numericId });
  if (!source) {
    throw new ApiError(404, 'Không tìm thấy nguồn tin RSS');
  }

  const targetStatus = enableFlag
    ? RSS_SOURCE_STATUSES.ACTIVE
    : RSS_SOURCE_STATUSES.INACTIVE;

  const articleCount = await News.countDocuments({ sourceId: numericId });
  if (source.status === targetStatus) {
    return serializeSource(source, articleCount);
  }

  const previousStatus = source.status;
  source.status = targetStatus;
  source.updatedBy = actor.id;
  await source.save();

  const serialized = serializeSource(source, articleCount);
  await recordAudit({
    actor,
    action: enableFlag
      ? AUDIT_ACTIONS.RSS_SOURCE_ENABLE
      : AUDIT_ACTIONS.RSS_SOURCE_DISABLE,
    targetType: 'RssSource',
    targetId: source.id,
    reason:
      payload.reason ||
      (enableFlag
        ? `Kích hoạt lại nguồn tin RSS: ${source.name}`
        : `Vô hiệu hóa nguồn tin RSS: ${source.name}`),
    changes: {
      before: { status: previousStatus },
      after: { status: targetStatus },
    },
    req,
  });

  return serialized;
}

/**
 * UC-ADM-09 Main Flow — Fetch external RSS/Atom feed safely, parse articles,
 * deduplicate links (both intra-feed and against stored News), and save new items.
 */
async function syncSourceFeed(actor, sourceId, options = {}, req = null) {
  const numericId = parsePositiveInt(sourceId, 'Source ID');
  const source = await RssSource.findOne({ id: numericId });
  if (!source) {
    throw new ApiError(404, 'Không tìm thấy nguồn tin RSS');
  }

  if (source.status !== RSS_SOURCE_STATUSES.ACTIVE) {
    throw new ApiError(
      409,
      'Nguồn tin RSS đang ở trạng thái vô hiệu hóa (inactive), không thể nhập feed',
    );
  }

  const policy = req?.contentPolicy || DEFAULT_CONTENT_POLICY;
  const netDeps = getEffectiveNetworkDeps();

  let fetched;
  let parsedFeed;
  try {
    fetched = await fetchRssFeedSafely(source.url, {
      lookupFn: netDeps.lookupFn,
      requestFn: netDeps.requestFn,
      timeoutMs: options.timeoutMs ?? policy.fetchTimeoutMs,
      maxRedirects: policy.maxRedirects,
      maxBytes: policy.maxFeedBytes,
    });

    parsedFeed = parseRssOrAtomXml(fetched.xmlBody, {
      feedBaseUrl: fetched.finalUrl,
      maxItems: policy.maxItemsPerSync,
    });
  } catch (error) {
    source.lastSyncedAt = new Date();
    source.lastSyncStatus = 'FAILED';
    source.lastSyncError = String(error.message || 'Lỗi đồng bộ RSS').slice(0, 500);
    source.updatedBy = actor.id;
    await source.save();
    throw error;
  }

  // Step 1: Intra-feed duplicate link filtering
  const uniqueBatchItems = [];
  const seenLinksInBatch = new Set();
  let skippedDuplicateCount = 0;

  for (const item of parsedFeed.validItems) {
    if (seenLinksInBatch.has(item.link)) {
      skippedDuplicateCount += 1;
      continue;
    }
    seenLinksInBatch.add(item.link);
    uniqueBatchItems.push(item);
  }

  // Step 2: Database duplicate link filtering
  let itemsToInsert = [];
  if (uniqueBatchItems.length > 0) {
    const candidateLinks = uniqueBatchItems.map((i) => i.link);
    const existingRows = await News.find({ link: { $in: candidateLinks } })
      .select('link')
      .lean();
    const existingLinkSet = new Set(existingRows.map((r) => r.link));

    for (const item of uniqueBatchItems) {
      if (existingLinkSet.has(item.link)) {
        skippedDuplicateCount += 1;
      } else {
        itemsToInsert.push(item);
      }
    }
  }

  // Step 3: Persist new articles sequentially/safely (handles concurrent duplicate key 11000)
  const insertedDocs = [];
  for (const item of itemsToInsert) {
    try {
      const createdArticle = await News.create({
        sourceId: source.id,
        title: item.title,
        link: item.link,
        summary: item.summary,
        image: item.image,
        pubDate: item.pubDate,
      });
      insertedDocs.push(createdArticle);
    } catch (err) {
      if (err?.code === 11000) {
        skippedDuplicateCount += 1;
      } else {
        throw err;
      }
    }
  }

  source.lastSyncedAt = new Date();
  source.lastSyncStatus = 'SUCCESS';
  source.lastSyncError = null;
  source.updatedBy = actor.id;
  await source.save();

  const totalArticles = await News.countDocuments({ sourceId: source.id });
  const serializedSource = serializeSource(source, totalArticles);

  const syncSummary = {
    sourceId: source.id,
    fetchedItemsCount: parsedFeed.totalExtractedBlocks,
    insertedCount: insertedDocs.length,
    skippedDuplicateCount,
    skippedInvalidCount: parsedFeed.skippedInvalidCount,
    redirectCount: fetched.redirectCount,
  };

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.RSS_FEED_IMPORT,
    targetType: 'RssSource',
    targetId: source.id,
    reason: `Nhập feed từ nguồn "${source.name}" (+${insertedDocs.length} bài mới, bỏ qua ${skippedDuplicateCount} link trùng)`,
    changes: { after: syncSummary },
    req,
  });

  return {
    source: serializedSource,
    summary: syncSummary,
    insertedArticles: insertedDocs.map((doc) =>
      serializeNewsArticle(doc.toJSON(), source),
    ),
  };
}

/**
 * Public endpoint backing `GET /api/rss-sources/news/latest?limit=6` in `web/src/api/news.ts`.
 * Returns articles strictly from ACTIVE RSS sources.
 */
async function getLatestNews({ limit } = {}) {
  const safeLimit = clampLimit(limit, 6, MAX_PUBLIC_NEWS_LIMIT);

  const activeSources = await RssSource.find({
    status: RSS_SOURCE_STATUSES.ACTIVE,
  }).lean();
  if (activeSources.length === 0) return [];

  const activeSourceIds = activeSources.map((s) => s.id);
  const sourceById = new Map(activeSources.map((s) => [s.id, s]));

  const articles = await News.find({ sourceId: { $in: activeSourceIds } })
    .sort({ pubDate: -1, id: -1 })
    .limit(safeLimit)
    .lean();

  return articles.map((article) =>
    serializeNewsArticle(article, sourceById.get(article.sourceId)),
  );
}

/**
 * Filter news by `sourceId` (`GET /api/rss-sources/news/source/:id?limit=20`).
 * Public callers only receive items when the source is `active`;
 * Content Managers / Admins passing `includeInactive = true` can inspect disabled sources too.
 */
async function getNewsBySource(sourceId, { limit, includeInactive = false } = {}) {
  const numericSourceId = parsePositiveInt(sourceId, 'Source ID');
  const safeLimit = clampLimit(limit, 20, MAX_ADMIN_NEWS_LIMIT);

  const source = await RssSource.findOne({ id: numericSourceId }).lean();
  if (!source) {
    throw new ApiError(404, 'Không tìm thấy nguồn tin RSS');
  }

  if (!includeInactive && source.status !== RSS_SOURCE_STATUSES.ACTIVE) {
    return [];
  }

  const articles = await News.find({ sourceId: numericSourceId })
    .sort({ pubDate: -1, id: -1 })
    .limit(safeLimit)
    .lean();

  return articles.map((article) => serializeNewsArticle(article, source));
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function queryManagedNews({
  sourceId,
  status,
  keyword,
  page = 1,
  limit = 20,
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = clampLimit(limit, 20, MAX_ADMIN_NEWS_LIMIT);
  const skip = (safePage - 1) * safeLimit;

  const sourceFilter = {};
  if (sourceId !== undefined && sourceId !== '') {
    sourceFilter.id = parsePositiveInt(sourceId, 'Source ID');
  }
  if (status !== undefined && status !== '') {
    const normalized = String(status).trim().toLowerCase();
    if (!Object.values(RSS_SOURCE_STATUSES).includes(normalized)) {
      throw new ApiError(400, 'Bộ lọc trạng thái nguồn (status) không hợp lệ');
    }
    sourceFilter.status = normalized;
  }

  const matchingSources = await RssSource.find(sourceFilter).lean();
  if (matchingSources.length === 0) {
    return {
      items: [],
      pagination: { page: safePage, limit: safeLimit, total: 0, totalPages: 1 },
    };
  }

  const sourceMap = new Map(matchingSources.map((s) => [s.id, s]));
  const newsFilter = {
    sourceId: { $in: matchingSources.map((s) => s.id) },
  };

  if (keyword !== undefined && String(keyword).trim() !== '') {
    const safePattern = escapeRegex(String(keyword).trim().slice(0, 100));
    newsFilter.title = { $regex: safePattern, $options: 'i' };
  }

  const [rows, total] = await Promise.all([
    News.find(newsFilter)
      .sort({ pubDate: -1, id: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    News.countDocuments(newsFilter),
  ]);

  return {
    items: rows.map((row) =>
      serializeNewsArticle(row, sourceMap.get(row.sourceId)),
    ),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

module.exports = {
  setNetworkDependencies,
  resetNetworkDependencies,
  listSources,
  getSourceDetail,
  createSource,
  updateSource,
  setSourceEnabledStatus,
  syncSourceFeed,
  getLatestNews,
  getNewsBySource,
  queryManagedNews,
};

