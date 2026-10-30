const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_adm_09_test_secret';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI_ADM09 ||
  'mongodb://127.0.0.1:27017/clinic_booking_test_uc_adm_09';

const app = require('../src/app');
const { User, RssSource, News, AuditLog } = require('../src/models');
const { ROLES, AUDIT_ACTIONS } = require('../src/constants/enums');
const rssNewsService = require('../src/services/rssNews.service');
const ApiError = require('../src/utils/ApiError');

let server;
let baseUrl;
let adminToken;
let doctorToken;
let receptionistToken;
let patientToken;

let sourceVnExpress;
let sourceSkds;

// Controlled DNS table & mock upstream feed responses (keeps tests 100% offline & deterministic)
const MOCK_DNS_TABLE = new Map([
  ['vnexpress.example.org', [{ address: '111.65.250.2', family: 4 }]],
  ['skds.example.org', [{ address: '103.21.148.10', family: 4 }]],
  ['redirect-safe.example.org', [{ address: '93.184.216.34', family: 4 }]],
  ['redirect-ssrf.example.org', [{ address: '93.184.216.35', family: 4 }]],
  ['redirect-downgrade.example.org', [{ address: '93.184.216.36', family: 4 }]],
  ['redirect-loop.example.org', [{ address: '93.184.216.37', family: 4 }]],
  ['slow-feed.example.org', [{ address: '93.184.216.38', family: 4 }]],
  ['xxe-feed.example.org', [{ address: '93.184.216.39', family: 4 }]],
  // Malicious DNS rebinding host resolving to internal loopback!
  ['evil-rebind.example.org', [{ address: '127.0.0.1', family: 4 }]],
]);

let vnExpressFeedVersion = 1;
let internalMetadataTouched = false;

const RSS_FEED_V1 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>VnExpress Sức Khỏe</title>
    <item>
      <title><![CDATA[Phòng ngừa đột quỵ mùa lạnh đúng cách]]></title>
      <link>https://vnexpress.example.org/phong-ngua-dot-quy-101.html#box_comment</link>
      <description><![CDATA[<img src="https://vnexpress.example.org/img/dot-quy.jpg" /><script>alert('xss')</script><p>Kiểm soát huyết áp &amp; giữ ấm cơ thể buổi sáng.</p>]]></description>
      <pubDate>Thu, 29 Oct 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Duplicate Link Trong Cùng Một Feed</title>
      <link>https://vnexpress.example.org/phong-ngua-dot-quy-101.html</link>
      <description>Bản ghi trùng link cần bị bỏ qua</description>
      <pubDate>Thu, 29 Oct 2026 08:05:00 GMT</pubDate>
    </item>
    <item>
      <title>Chế độ dinh dưỡng cho người tiểu đường tuýp 2</title>
      <link>https://vnexpress.example.org/dinh-duong-tieu-duong-102.html</link>
      <enclosure url="https://vnexpress.example.org/img/tieu-duong.jpg" type="image/jpeg" />
      <description>Ưu tiên rau xanh, ngũ cốc nguyên hạt và khám định kỳ.</description>
      <pubDate>Fri, 30 Oct 2026 07:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Bài viết chứa link XSS không hợp lệ</title>
      <link>javascript:alert(document.cookie)</link>
      <description>Phải bị loại bỏ</description>
    </item>
  </channel>
</rss>`;

const RSS_FEED_V2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>VnExpress Sức Khỏe</title>
    <item>
      <title>Chế độ dinh dưỡng cho người tiểu đường tuýp 2</title>
      <link>https://vnexpress.example.org/dinh-duong-tieu-duong-102.html</link>
      <description>Đã có ở lần sync trước -> bỏ qua</description>
      <pubDate>Fri, 30 Oct 2026 07:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Tầm soát tim mạch sớm ở người trẻ</title>
      <link>https://vnexpress.example.org/tam-soat-tim-mach-103.html</link>
      <description>Khám chuyên khoa Tim mạch định kỳ mỗi năm.</description>
      <pubDate>Fri, 30 Oct 2026 09:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_FEED_SKDS = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Sức Khỏe &amp; Đời Sống</title>
  <entry>
    <title>Hướng dẫn chăm sóc răng miệng cho trẻ nhỏ</title>
    <link rel="alternate" href="https://skds.example.org/cham-soc-rang-mieng-201.html" />
    <summary>Khám nha khoa định kỳ 6 tháng/lần.</summary>
    <updated>2026-10-30T10:00:00Z</updated>
  </entry>
  <entry>
    <title>Bảo vệ thị lực khi làm việc với máy tính</title>
    <link href="https://skds.example.org/bao-ve-thi-luc-202.html" />
    <summary>Áp dụng quy tắc 20-20-20 giảm mỏi mắt.</summary>
    <published>2026-10-30T11:00:00Z</published>
  </entry>
</feed>`;

async function mockLookupFn(hostname) {
  if (MOCK_DNS_TABLE.has(hostname)) {
    return MOCK_DNS_TABLE.get(hostname);
  }
  throw new Error(`ENOTFOUND ${hostname}`);
}

async function mockRequestFn({ parsedUrl, timeoutMs }) {
  const urlStr = parsedUrl.toString();

  if (parsedUrl.hostname === '169.254.169.254' || parsedUrl.hostname === '127.0.0.1') {
    internalMetadataTouched = true;
  }

  if (urlStr === 'https://vnexpress.example.org/rss/suc-khoe.rss') {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/rss+xml' },
      body: vnExpressFeedVersion === 1 ? RSS_FEED_V1 : RSS_FEED_V2,
    };
  }

  if (urlStr === 'https://skds.example.org/rss/y-te.atom') {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/atom+xml' },
      body: ATOM_FEED_SKDS,
    };
  }

  if (urlStr === 'https://redirect-safe.example.org/old-feed.xml') {
    return {
      statusCode: 301,
      headers: { location: 'https://skds.example.org/rss/y-te.atom' },
      body: '',
    };
  }

  if (urlStr === 'https://redirect-ssrf.example.org/feed.xml') {
    return {
      statusCode: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
      body: '',
    };
  }

  if (urlStr === 'https://redirect-downgrade.example.org/feed.xml') {
    return {
      statusCode: 302,
      headers: { location: 'http://skds.example.org/rss/y-te.atom' },
      body: '',
    };
  }

  if (urlStr.startsWith('https://redirect-loop.example.org/step')) {
    const step = Number(urlStr.slice(-1)) || 1;
    return {
      statusCode: 302,
      headers: { location: `https://redirect-loop.example.org/step${step + 1}` },
      body: '',
    };
  }

  if (urlStr === 'https://slow-feed.example.org/slow.xml') {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, timeoutMs + 100);
      setTimeout(() => {
        clearTimeout(timer);
        reject(new ApiError(504, 'Quá thời gian chờ khi tải nguồn tin RSS (timeout)'));
      }, Math.min(timeoutMs, 60));
    });
  }

  if (urlStr === 'https://xxe-feed.example.org/xxe.xml') {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss><channel><item><title>&xxe;</title><link>https://xxe-feed.example.org/1</link></item></channel></rss>`,
    };
  }

  return { statusCode: 404, headers: {}, body: 'Not Found' };
}

async function apiRequest(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

describe('UC-ADM-09: Quản lý RSS/news an toàn', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();

    rssNewsService.setNetworkDependencies({
      lookupFn: mockLookupFn,
      requestFn: mockRequestFn,
    });

    const passwordHash = await bcrypt.hash('RssTest@123', 10);

    await User.create([
      {
        email: 'admin.rss@clinicbooking.com',
        password: passwordHash,
        fullName: 'Admin Nội Dung',
        userType: ROLES.ADMIN,
        isEnable: true,
      },
      {
        email: 'doctor.rss@clinicbooking.com',
        password: passwordHash,
        fullName: 'BS Nội Khoa',
        userType: ROLES.DOCTOR,
        isEnable: true,
      },
      {
        email: 'recep.rss@clinicbooking.com',
        password: passwordHash,
        fullName: 'Lễ Tân',
        userType: ROLES.RECEPTIONIST,
        isEnable: true,
      },
      {
        email: 'patient.rss@clinicbooking.com',
        password: passwordHash,
        fullName: 'Bệnh Nhân',
        userType: ROLES.PATIENT,
        isEnable: true,
      },
    ]);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const loginAs = async (email) => {
      const res = await apiRequest('POST', '/auth/login', {
        body: { email, password: 'RssTest@123' },
      });
      assert.equal(res.status, 200);
      return res.body.data.token;
    };

    adminToken = await loginAs('admin.rss@clinicbooking.com');
    doctorToken = await loginAs('doctor.rss@clinicbooking.com');
    receptionistToken = await loginAs('recep.rss@clinicbooking.com');
    patientToken = await loginAs('patient.rss@clinicbooking.com');
  });

  after(async () => {
    rssNewsService.resetNetworkDependencies();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('1. Điều kiện trước — Policy nội dung: chỉ role được cấp Content Policy mới quản lý được RSS, trong khi Guest đọc được tin public', async () => {
    // Public news endpoint works without JWT
    const publicLatest = await apiRequest('GET', '/rss-sources/news/latest?limit=6');
    assert.equal(publicLatest.status, 200);
    assert.deepEqual(publicLatest.body.data, []);

    // Unauthenticated management call -> 401
    const unauthCreate = await apiRequest('POST', '/rss-sources', {
      body: { name: 'Test', url: 'https://vnexpress.example.org/rss/suc-khoe.rss' },
    });
    assert.equal(unauthCreate.status, 401);

    // Doctor, Receptionist, Patient lack Content Policy -> 403
    for (const token of [doctorToken, receptionistToken, patientToken]) {
      const forbiddenRes = await apiRequest('POST', '/rss-sources', {
        token,
        body: { name: 'Test', url: 'https://vnexpress.example.org/rss/suc-khoe.rss' },
      });
      assert.equal(forbiddenRes.status, 403);
    }

    // Admin has Content Policy -> 200
    const policyRes = await apiRequest('GET', '/rss-sources/policy', {
      token: adminToken,
    });
    assert.equal(policyRes.status, 200);
    assert.equal(policyRes.body.data.policyCode, 'CLINIC_RSS_CONTENT_POLICY_V1');
    assert.equal(policyRes.body.data.grantedRole, ROLES.ADMIN);
  });

  it('2. Ngoại lệ bảo mật — Chặn SSRF toàn diện (loopback, RFC1918, cloud metadata, IPv6 mapped, scheme lạ, cổng DB, DNS rebinding)', async () => {
    const ssrfPayloads = [
      'file:///etc/passwd',
      'ftp://vnexpress.example.org/feed.xml',
      'javascript:alert(1)',
      'http://localhost/rss.xml',
      'http://sub.localhost/rss.xml',
      'http://127.0.0.1:8080/rss.xml',
      'http://0177.0.0.1/rss.xml', // Octal loopback
      'http://2130706433/rss.xml', // Integer loopback
      'http://[::1]/rss.xml',
      'http://[::ffff:127.0.0.1]/rss.xml',
      'http://169.254.169.254/latest/meta-data/', // Cloud Instance Metadata
      'http://10.0.0.15/internal.xml',
      'http://172.16.10.5/internal.xml',
      'http://192.168.1.1/router.xml',
      'http://vnexpress.example.org:27017/mongodb', // Disallowed internal DB port
      'http://admin:secret@vnexpress.example.org/rss.xml', // Embedded credentials
      'https://evil-rebind.example.org/rss.xml', // Domain resolving to 127.0.0.1
    ];

    for (const badUrl of ssrfPayloads) {
      const res = await apiRequest('POST', '/rss-sources', {
        token: adminToken,
        body: { name: 'Malicious Source', url: badUrl, category: 'Test' },
      });
      assert.equal(
        res.status,
        400,
        `Expected SSRF guard to block URL with 400: ${badUrl} (got ${res.status})`,
      );
    }
  });

  it('3. Luồng chính — Tạo, sửa nguồn tin RSS và chống trùng URL nguồn', async () => {
    const create1 = await apiRequest('POST', '/rss-sources', {
      token: adminToken,
      body: {
        name: 'VnExpress Sức Khỏe',
        url: 'https://vnexpress.example.org/rss/suc-khoe.rss',
        category: 'Sức khỏe',
      },
    });
    assert.equal(create1.status, 201);
    sourceVnExpress = create1.body.data;
    assert.equal(sourceVnExpress.status, 'active');
    assert.equal(sourceVnExpress.isEnabled, true);

    // Duplicate source URL -> 409 Conflict
    const dupCreate = await apiRequest('POST', '/rss-sources', {
      token: adminToken,
      body: {
        name: 'VnExpress Bản Sao',
        url: 'https://vnexpress.example.org/rss/suc-khoe.rss',
      },
    });
    assert.equal(dupCreate.status, 409);

    const create2 = await apiRequest('POST', '/admin/rss-sources', {
      token: adminToken,
      body: {
        name: 'Báo Sức Khỏe & Đời Sống',
        url: 'https://skds.example.org/rss/y-te.atom',
        category: 'Phòng bệnh',
      },
    });
    assert.equal(create2.status, 201);
    sourceSkds = create2.body.data;

    // Update source metadata (and verify SSRF guard also protects update!)
    const badUpdate = await apiRequest('PUT', `/rss-sources/${sourceVnExpress.id}`, {
      token: adminToken,
      body: { url: 'http://127.0.0.1/internal.xml' },
    });
    assert.equal(badUpdate.status, 400);

    const validUpdate = await apiRequest('PUT', `/rss-sources/${sourceVnExpress.id}`, {
      token: adminToken,
      body: {
        name: 'VnExpress Y Tế & Sức Khỏe',
        category: 'Y khoa chuyên sâu',
      },
    });
    assert.equal(validUpdate.status, 200);
    assert.equal(validUpdate.body.data.name, 'VnExpress Y Tế & Sức Khỏe');
    assert.equal(validUpdate.body.data.category, 'Y khoa chuyên sâu');
  });

  it('4. Luồng chính — Nhập feed RSS 2.0 & Atom 1.0, làm sạch HTML/XSS và tự động bỏ qua link trùng', async () => {
    // First sync of VnExpress (RSS_FEED_V1: 4 items -> 2 valid unique, 1 intra-feed duplicate link, 1 invalid javascript: link)
    vnExpressFeedVersion = 1;
    const sync1 = await apiRequest('POST', `/rss-sources/${sourceVnExpress.id}/sync`, {
      token: adminToken,
    });
    assert.equal(sync1.status, 200);
    assert.deepEqual(sync1.body.data.summary, {
      sourceId: sourceVnExpress.id,
      fetchedItemsCount: 4,
      insertedCount: 2,
      skippedDuplicateCount: 1,
      skippedInvalidCount: 1,
      redirectCount: 0,
    });

    // Verify XSS <script> stripped & image extracted properly
    const firstBatchArticles = sync1.body.data.insertedArticles;
    const strokeArticle = firstBatchArticles.find((a) =>
      a.link.includes('phong-ngua-dot-quy-101.html'),
    );
    assert.ok(strokeArticle);
    assert.equal(strokeArticle.summary.includes('<script>'), false);
    assert.equal(
      strokeArticle.summary,
      'Kiểm soát huyết áp & giữ ấm cơ thể buổi sáng.',
    );
    assert.equal(
      strokeArticle.imageUrl,
      'https://vnexpress.example.org/img/dot-quy.jpg',
    );

    // Second sync of VnExpress (RSS_FEED_V2: 1 existing link + 1 new link -> skips existing, inserts 1 new!)
    vnExpressFeedVersion = 2;
    const sync2 = await apiRequest('POST', `/rss-sources/${sourceVnExpress.id}/sync`, {
      token: adminToken,
    });
    assert.equal(sync2.status, 200);
    assert.equal(sync2.body.data.summary.insertedCount, 1);
    assert.equal(sync2.body.data.summary.skippedDuplicateCount, 1);
    assert.equal(sync2.body.data.source.articleCount, 3);

    // Sync Atom 1.0 source (SKDS -> 2 new articles)
    const syncAtom = await apiRequest('POST', `/rss-sources/${sourceSkds.id}/sync`, {
      token: adminToken,
    });
    assert.equal(syncAtom.status, 200);
    assert.equal(syncAtom.body.data.summary.insertedCount, 2);
  });

  it('5. Luồng chính — Lọc tin theo nguồn, tương thích Frontend NewsSection và hiệu lực khi Disable source', async () => {
    // Public latest news returns all 5 articles across both active sources
    const latestAll = await apiRequest('GET', '/rss-sources/news/latest?limit=10');
    assert.equal(latestAll.status, 200);
    assert.equal(latestAll.body.data.length, 5);
    assert.ok(latestAll.body.data[0].source.name);

    // Public filter by source 1 -> 3 articles; source 2 -> 2 articles
    const bySource1 = await apiRequest(
      'GET',
      `/rss-sources/news/source/${sourceVnExpress.id}?limit=20`,
    );
    assert.equal(bySource1.status, 200);
    assert.equal(bySource1.body.data.length, 3);

    const adminFilterBySource2 = await apiRequest(
      'GET',
      `/rss-sources/news?sourceId=${sourceSkds.id}`,
      { token: adminToken },
    );
    assert.equal(adminFilterBySource2.status, 200);
    assert.equal(adminFilterBySource2.body.data.items.length, 2);

    // Disable Source 1
    const disableRes = await apiRequest(
      'PATCH',
      `/rss-sources/${sourceVnExpress.id}/disable`,
      { token: adminToken, body: { reason: 'Tạm ngưng bảo trì nguồn tin' } },
    );
    assert.equal(disableRes.status, 200);
    assert.equal(disableRes.body.data.status, 'inactive');
    assert.equal(disableRes.body.data.isEnabled, false);

    // Syncing a disabled source is rejected (409)
    const syncDisabled = await apiRequest(
      'POST',
      `/rss-sources/${sourceVnExpress.id}/sync`,
      { token: adminToken },
    );
    assert.equal(syncDisabled.status, 409);

    // Public latest news immediately excludes disabled Source 1 (returns only 2 articles of Source 2)
    const latestAfterDisable = await apiRequest(
      'GET',
      '/rss-sources/news/latest?limit=10',
    );
    assert.equal(latestAfterDisable.status, 200);
    assert.equal(latestAfterDisable.body.data.length, 2);
    assert.ok(
      latestAfterDisable.body.data.every((item) => item.sourceId === sourceSkds.id),
    );

    // Public source-specific endpoint returns [] for disabled source, while Admin with includeInactive=true sees 3
    const publicDisabledSource = await apiRequest(
      'GET',
      `/rss-sources/news/source/${sourceVnExpress.id}`,
    );
    assert.equal(publicDisabledSource.body.data.length, 0);

    const adminInspectDisabled = await apiRequest(
      'GET',
      `/rss-sources/news/source/${sourceVnExpress.id}?includeInactive=true`,
      { token: adminToken },
    );
    assert.equal(adminInspectDisabled.body.data.length, 3);

    // Re-enable Source 1
    const enableRes = await apiRequest(
      'PATCH',
      `/rss-sources/${sourceVnExpress.id}/enable`,
      { token: adminToken },
    );
    assert.equal(enableRes.status, 200);
    assert.equal(enableRes.body.data.status, 'active');
  });

  it('6. Ngoại lệ nâng cao — Chặn redirect nguy hiểm (SSRF / hạ cấp HTTPS->HTTP / quá số lần), timeout 504 và XXE', async () => {
    const createAndSync = async (name, url, syncBody = {}) => {
      const created = await apiRequest('POST', '/rss-sources', {
        token: adminToken,
        body: { name, url },
      });
      assert.equal(created.status, 201);
      const syncRes = await apiRequest(
        'POST',
        `/rss-sources/${created.body.data.id}/sync`,
        { token: adminToken, body: syncBody },
      );
      return { sourceId: created.body.data.id, syncRes };
    };

    // 6a. Safe HTTPS -> HTTPS redirect succeeds (skips duplicates already imported from SKDS!)
    const safeRedirect = await createAndSync(
      'Safe Redirect Feed',
      'https://redirect-safe.example.org/old-feed.xml',
    );
    assert.equal(safeRedirect.syncRes.status, 200);
    assert.equal(safeRedirect.syncRes.body.data.summary.redirectCount, 1);
    assert.equal(safeRedirect.syncRes.body.data.summary.skippedDuplicateCount, 2);

    // 6b. Dangerous 302 redirect to AWS Cloud Metadata 169.254.169.254 -> BLOCKED before touching internal IP!
    internalMetadataTouched = false;
    const ssrfRedirect = await createAndSync(
      'SSRF Redirect Trap',
      'https://redirect-ssrf.example.org/feed.xml',
    );
    assert.equal(ssrfRedirect.syncRes.status, 400);
    assert.equal(internalMetadataTouched, false);

    const failedSourceDoc = await RssSource.findOne({
      id: ssrfRedirect.sourceId,
    }).lean();
    assert.equal(failedSourceDoc.lastSyncStatus, 'FAILED');
    assert.ok(failedSourceDoc.lastSyncError);

    // 6c. Dangerous HTTPS -> HTTP downgrade redirect -> BLOCKED (400)
    const downgradeRedirect = await createAndSync(
      'HTTPS Downgrade Trap',
      'https://redirect-downgrade.example.org/feed.xml',
    );
    assert.equal(downgradeRedirect.syncRes.status, 400);

    // 6d. Excessive redirect hops (> 3) -> BLOCKED (502)
    const tooManyRedirects = await createAndSync(
      'Excessive Redirects',
      'https://redirect-loop.example.org/step1',
    );
    assert.equal(tooManyRedirects.syncRes.status, 502);

    // 6e. Upstream feed timeout -> 504 Gateway Timeout
    const timeoutFeed = await createAndSync(
      'Slow Upstream Feed',
      'https://slow-feed.example.org/slow.xml',
      { timeoutMs: 120 },
    );
    assert.equal(timeoutFeed.syncRes.status, 504);

    // 6f. XML External Entity (XXE) payload -> BLOCKED (400)
    const xxeFeed = await createAndSync(
      'XXE Payload Feed',
      'https://xxe-feed.example.org/xxe.xml',
    );
    assert.equal(xxeFeed.syncRes.status, 400);

    // Verify AuditLog recorded RSS lifecycle actions
    const rssAudits = await AuditLog.find({
      targetType: 'RssSource',
    }).lean();
    const recordedActions = new Set(rssAudits.map((a) => a.action));
    assert.ok(recordedActions.has(AUDIT_ACTIONS.RSS_SOURCE_CREATE));
    assert.ok(recordedActions.has(AUDIT_ACTIONS.RSS_SOURCE_UPDATE));
    assert.ok(recordedActions.has(AUDIT_ACTIONS.RSS_SOURCE_DISABLE));
    assert.ok(recordedActions.has(AUDIT_ACTIONS.RSS_SOURCE_ENABLE));
    assert.ok(recordedActions.has(AUDIT_ACTIONS.RSS_FEED_IMPORT));
  });
});

