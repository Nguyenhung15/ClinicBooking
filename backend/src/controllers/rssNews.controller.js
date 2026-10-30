const rssNewsService = require('../services/rssNews.service');
const { resolveAllowedContentRoles } = require('../middlewares/contentPolicy.middleware');
const { sendSuccess } = require('../utils/response');
const ApiError = require('../utils/ApiError');

async function getLatestNews(req, res) {
  const data = await rssNewsService.getLatestNews({
    limit: req.query.limit,
  });
  return sendSuccess(res, {
    message: 'Lấy danh sách tin tức mới nhất thành công',
    data,
  });
}

async function getNewsBySource(req, res) {
  const allowedRoles = resolveAllowedContentRoles();
  const hasContentPolicy =
    Boolean(req.user) &&
    Boolean(req.user.isEnable) &&
    allowedRoles.includes(req.user.userType);

  const includeInactive =
    hasContentPolicy &&
    (req.query.includeInactive === 'true' || req.query.includeInactive === '1');

  const data = await rssNewsService.getNewsBySource(req.params.id, {
    limit: req.query.limit,
    includeInactive,
  });
  return sendSuccess(res, {
    message: 'Lấy danh sách tin tức theo nguồn thành công',
    data,
  });
}

function getContentPolicyInfo(req, res) {
  return sendSuccess(res, {
    message: 'Thông tin chính sách quản lý nội dung RSS/News',
    data: req.contentPolicy,
  });
}

async function listSources(req, res) {
  const data = await rssNewsService.listSources({
    status: req.query.status,
    category: req.query.category,
  });
  return sendSuccess(res, {
    message: 'Lấy danh sách nguồn tin RSS thành công',
    data,
  });
}

async function getSourceDetail(req, res) {
  const data = await rssNewsService.getSourceDetail(req.params.id);
  return sendSuccess(res, {
    message: 'Lấy chi tiết nguồn tin RSS thành công',
    data,
  });
}

async function createSource(req, res) {
  const data = await rssNewsService.createSource(req.user, req.body || {}, req);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Tạo nguồn tin RSS thành công',
    data,
  });
}

async function updateSource(req, res) {
  const data = await rssNewsService.updateSource(
    req.user,
    req.params.id,
    req.body || {},
    req,
  );
  return sendSuccess(res, {
    message: 'Cập nhật nguồn tin RSS thành công',
    data,
  });
}

async function disableSource(req, res) {
  const data = await rssNewsService.setSourceEnabledStatus(
    req.user,
    req.params.id,
    false,
    req.body || {},
    req,
  );
  return sendSuccess(res, {
    message: 'Đã vô hiệu hóa nguồn tin RSS',
    data,
  });
}

async function enableSource(req, res) {
  const data = await rssNewsService.setSourceEnabledStatus(
    req.user,
    req.params.id,
    true,
    req.body || {},
    req,
  );
  return sendSuccess(res, {
    message: 'Đã kích hoạt nguồn tin RSS',
    data,
  });
}

async function setSourceStatus(req, res) {
  const body = req.body || {};
  let enableFlag;
  if (typeof body.enabled === 'boolean') {
    enableFlag = body.enabled;
  } else if (typeof body.isEnabled === 'boolean') {
    enableFlag = body.isEnabled;
  } else if (typeof body.status === 'string') {
    const normalized = body.status.trim().toLowerCase();
    if (normalized === 'active') enableFlag = true;
    else if (normalized === 'inactive') enableFlag = false;
  }

  if (enableFlag === undefined) {
    throw new ApiError(
      400,
      'Vui lòng truyền status ("active" | "inactive") hoặc enabled (boolean)',
    );
  }

  const data = await rssNewsService.setSourceEnabledStatus(
    req.user,
    req.params.id,
    enableFlag,
    body,
    req,
  );
  return sendSuccess(res, {
    message: 'Cập nhật trạng thái nguồn tin RSS thành công',
    data,
  });
}

async function syncSourceFeed(req, res) {
  const data = await rssNewsService.syncSourceFeed(
    req.user,
    req.params.id,
    req.body || {},
    req,
  );
  return sendSuccess(res, {
    message: 'Đồng bộ và lưu bài viết từ nguồn RSS thành công',
    data,
  });
}

async function queryManagedNews(req, res) {
  const data = await rssNewsService.queryManagedNews({
    sourceId: req.query.sourceId,
    status: req.query.status,
    keyword: req.query.keyword,
    page: req.query.page,
    limit: req.query.limit,
  });
  return sendSuccess(res, {
    message: 'Lọc danh sách bài viết tin tức thành công',
    data,
  });
}

module.exports = {
  getLatestNews,
  getNewsBySource,
  getContentPolicyInfo,
  listSources,
  getSourceDetail,
  createSource,
  updateSource,
  disableSource,
  enableSource,
  setSourceStatus,
  syncSourceFeed,
  queryManagedNews,
};

