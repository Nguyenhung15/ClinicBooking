const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const ApiError = require('./ApiError');
const { DEFAULT_CONTENT_POLICY } = require('../middlewares/contentPolicy.middleware');

const ALLOWED_SCHEMES = new Set(DEFAULT_CONTENT_POLICY.allowedSchemes);
const ALLOWED_PORTS = new Set(DEFAULT_CONTENT_POLICY.allowedPorts);

const BLOCKED_EXACT_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  '0',
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.intranet',
  '.corp',
  '.lan',
];

function ipv4ToUint32(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    result = ((result << 8) | octet) >>> 0;
  }
  return result;
}

function inCidrV4(ipUint32, baseIp, prefixBits) {
  const baseUint32 = ipv4ToUint32(baseIp);
  const mask = prefixBits === 0 ? 0 : (~0 << (32 - prefixBits)) >>> 0;
  return (ipUint32 & mask) >>> 0 === (baseUint32 & mask) >>> 0;
}

function isPrivateOrReservedIpv4(ip) {
  const num = ipv4ToUint32(ip);
  if (num === null) return true;

  return (
    inCidrV4(num, '0.0.0.0', 8) || // Current network (0.0.0.0/8)
    inCidrV4(num, '10.0.0.0', 8) || // RFC 1918 Private
    inCidrV4(num, '100.64.0.0', 10) || // RFC 6598 Carrier-Grade NAT / internal mesh
    inCidrV4(num, '127.0.0.0', 8) || // Loopback
    inCidrV4(num, '169.254.0.0', 16) || // Link-local & Cloud Metadata (169.254.169.254)
    inCidrV4(num, '172.16.0.0', 12) || // RFC 1918 Private
    inCidrV4(num, '192.0.0.0', 24) || // IETF Protocol Assignments
    inCidrV4(num, '192.0.2.0', 24) || // TEST-NET-1
    inCidrV4(num, '192.168.0.0', 16) || // RFC 1918 Private
    inCidrV4(num, '198.18.0.0', 15) || // Benchmarking
    inCidrV4(num, '198.51.100.0', 24) || // TEST-NET-2
    inCidrV4(num, '203.0.113.0', 24) || // TEST-NET-3
    inCidrV4(num, '224.0.0.0', 4) || // Multicast
    inCidrV4(num, '240.0.0.0', 4) // Reserved & Broadcast
  );
}

function parseIpv6ToGroups(rawIp) {
  const ip = rawIp.split('%')[0].toLowerCase(); // Strip zone index if present
  let working = ip;

  // Convert trailing dotted IPv4 (e.g. ::ffff:127.0.0.1) into two 16-bit hex groups
  const lastColon = working.lastIndexOf(':');
  if (lastColon !== -1 && working.slice(lastColon + 1).includes('.')) {
    const v4Part = working.slice(lastColon + 1);
    const v4Num = ipv4ToUint32(v4Part);
    if (v4Num === null) return null;
    const hi = ((v4Num >>> 16) & 0xffff).toString(16);
    const lo = (v4Num & 0xffff).toString(16);
    working = `${working.slice(0, lastColon)}:${hi}:${lo}`;
  }

  const doubleColonParts = working.split('::');
  if (doubleColonParts.length > 2) return null;

  const parseSide = (segment) =>
    segment
      ? segment.split(':').map((g) => {
          if (!/^[0-9a-f]{1,4}$/.test(g)) return NaN;
          return parseInt(g, 16);
        })
      : [];

  let groups;
  if (doubleColonParts.length === 2) {
    const left = parseSide(doubleColonParts[0]);
    const right = parseSide(doubleColonParts[1]);
    if (left.some(Number.isNaN) || right.some(Number.isNaN)) return null;
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    groups = [...left, ...new Array(missing).fill(0), ...right];
  } else {
    groups = parseSide(working);
    if (groups.length !== 8 || groups.some(Number.isNaN)) return null;
  }

  return groups;
}

function extractEmbeddedIpv4FromGroups(hiGroup, loGroup) {
  const a = (hiGroup >>> 8) & 0xff;
  const b = hiGroup & 0xff;
  const c = (loGroup >>> 8) & 0xff;
  const d = loGroup & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

function isPrivateOrReservedIpv6(ip) {
  const groups = parseIpv6ToGroups(ip);
  if (!groups) return true;

  const allZeroPrefix6 = groups.slice(0, 6).every((g) => g === 0);
  // :: (unspecified) or ::1 (loopback)
  if (allZeroPrefix6 && groups[6] === 0 && (groups[7] === 0 || groups[7] === 1)) {
    return true;
  }
  // IPv4-compatible ::w.x.y.z
  if (allZeroPrefix6) {
    return isPrivateOrReservedIpv4(
      extractEmbeddedIpv4FromGroups(groups[6], groups[7]),
    );
  }
  // IPv4-mapped ::ffff:w.x.y.z
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return isPrivateOrReservedIpv4(
      extractEmbeddedIpv4FromGroups(groups[6], groups[7]),
    );
  }
  // NAT64 well-known prefix 64:ff9b::/96
  if (
    groups[0] === 0x0064 &&
    groups[1] === 0xff9b &&
    groups.slice(2, 6).every((g) => g === 0)
  ) {
    return isPrivateOrReservedIpv4(
      extractEmbeddedIpv4FromGroups(groups[6], groups[7]),
    );
  }

  // fc00::/7 Unique Local, fe80::/10 Link-Local, ff00::/8 Multicast, 2001:db8::/32 Documentation
  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  if ((groups[0] & 0xff00) === 0xff00) return true;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;

  return false;
}

function isPrivateOrReservedIp(ipString) {
  if (!ipString || typeof ipString !== 'string') return true;
  const cleaned = ipString.trim().replace(/^\[|\]$/g, '');
  const version = net.isIP(cleaned.split('%')[0]);
  if (version === 4) return isPrivateOrReservedIpv4(cleaned);
  if (version === 6) return isPrivateOrReservedIpv6(cleaned);
  return true;
}

function isBlockedHostname(hostname) {
  const lower = String(hostname || '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();

  if (!lower) return true;
  if (BLOCKED_EXACT_HOSTNAMES.has(lower)) return true;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return true;
  }
  return false;
}

function defaultDnsLookup(hostname) {
  return dns.promises.lookup(hostname, { all: true, verbatim: true });
}

/**
 * Validate URL syntax, protocol, port, hostname, and (optionally) DNS resolution
 * against SSRF attacks.
 */
async function validateExternalFeedUrl(
  rawUrl,
  { lookupFn = defaultDnsLookup, resolveDns = true } = {},
) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new ApiError(400, 'URL nguồn tin RSS không được để trống');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new ApiError(400, 'URL nguồn tin RSS không hợp lệ');
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new ApiError(
      400,
      `Giao thức không được phép (${parsed.protocol}). Chỉ chấp nhận HTTP hoặc HTTPS`,
    );
  }

  if (parsed.username || parsed.password) {
    throw new ApiError(
      400,
      'URL nguồn tin không được chứa thông tin xác thực nội bộ (username/password)',
    );
  }

  if (!ALLOWED_PORTS.has(parsed.port)) {
    throw new ApiError(
      400,
      `Cổng kết nối (${parsed.port}) không nằm trong danh sách an toàn cho phép`,
    );
  }

  const cleanHost = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (isBlockedHostname(cleanHost)) {
    throw new ApiError(
      400,
      'Chặn SSRF: tên miền nội bộ hoặc localhost không được phép truy cập',
    );
  }

  const ipVersion = net.isIP(cleanHost);
  if (ipVersion !== 0) {
    if (isPrivateOrReservedIp(cleanHost)) {
      throw new ApiError(
        400,
        'Chặn SSRF: địa chỉ IP nội bộ, loopback hoặc cloud metadata không được phép truy cập',
      );
    }
    parsed.hash = '';
    return {
      canonicalUrl: parsed.toString(),
      parsedUrl: parsed,
      resolvedAddress: cleanHost,
      resolvedFamily: ipVersion,
    };
  }

  if (!resolveDns) {
    parsed.hash = '';
    return {
      canonicalUrl: parsed.toString(),
      parsedUrl: parsed,
      resolvedAddress: null,
      resolvedFamily: null,
    };
  }

  let records;
  try {
    records = await lookupFn(cleanHost);
  } catch {
    throw new ApiError(
      400,
      `Không thể phân giải tên miền nguồn RSS (${cleanHost})`,
    );
  }

  const normalizedRecords = Array.isArray(records) ? records : [records];
  if (normalizedRecords.length === 0 || !normalizedRecords[0]?.address) {
    throw new ApiError(
      400,
      `Tên miền nguồn RSS (${cleanHost}) không có bản ghi địa chỉ IP hợp lệ`,
    );
  }

  for (const record of normalizedRecords) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new ApiError(
        400,
        `Chặn SSRF: tên miền ${cleanHost} phân giải về địa chỉ IP nội bộ/riêng tư không an toàn`,
      );
    }
  }

  parsed.hash = '';
  return {
    canonicalUrl: parsed.toString(),
    parsedUrl: parsed,
    resolvedAddress: normalizedRecords[0].address,
    resolvedFamily: normalizedRecords[0].family || net.isIP(normalizedRecords[0].address),
  };
}

/**
 * Default low-level single-hop HTTP/HTTPS request with pinned DNS address,
 * strict timeout, and streaming byte-size cap.
 */
function executePinnedHttpRequest({
  parsedUrl,
  resolvedAddress,
  resolvedFamily,
  timeoutMs,
  maxBytes,
}) {
  return new Promise((resolve, reject) => {
    const client = parsedUrl.protocol === 'https:' ? https : http;
    let settled = false;

    const finishError = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const req = client.request(
      parsedUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'ClinicBooking-RSS-Reader/1.0',
          Accept:
            'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
          Connection: 'close',
        },
        lookup: resolvedAddress
          ? (_hostname, opts, cb) => {
              if (opts && opts.all) {
                return cb(null, [{ address: resolvedAddress, family: resolvedFamily }]);
              }
              return cb(null, resolvedAddress, resolvedFamily);
            }
          : undefined,
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        const headers = res.headers || {};

        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          res.resume();
          settled = true;
          return resolve({
            statusCode,
            headers,
            body: '',
          });
        }

        const chunks = [];
        let totalBytes = 0;

        res.on('data', (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            req.destroy();
            finishError(
              new ApiError(
                413,
                `Nội dung nguồn RSS vượt quá giới hạn dung lượng an toàn (${Math.round(maxBytes / 1024)} KB)`,
              ),
            );
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (settled) return;
          settled = true;
          resolve({
            statusCode,
            headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });

        res.on('error', () => {
          finishError(new ApiError(502, 'Lỗi đọc dữ liệu phản hồi từ nguồn RSS'));
        });
      },
    );

    const timer = setTimeout(() => {
      req.destroy();
      finishError(
        new ApiError(504, 'Quá thời gian chờ khi tải nguồn tin RSS (timeout)'),
      );
    }, timeoutMs);

    req.once('close', () => clearTimeout(timer));
    req.on('error', (err) => {
      clearTimeout(timer);
      if (err instanceof ApiError) {
        return finishError(err);
      }
      return finishError(
        new ApiError(502, `Không thể kết nối tới nguồn tin RSS: ${err.message}`),
      );
    });

    req.end();
  });
}

/**
 * Fetch an external RSS/Atom XML feed while enforcing:
 * 1. Pre-connect SSRF validation + DNS IP pinning (prevents DNS rebinding)
 * 2. Manual redirect inspection (blocks HTTPS->HTTP downgrade, redirect loops, and SSRF redirects)
 * 3. Total wall-clock timeout and max response byte limit
 */
async function fetchRssFeedSafely(
  rawUrl,
  {
    lookupFn = defaultDnsLookup,
    requestFn = executePinnedHttpRequest,
    timeoutMs = DEFAULT_CONTENT_POLICY.fetchTimeoutMs,
    maxRedirects = DEFAULT_CONTENT_POLICY.maxRedirects,
    maxBytes = DEFAULT_CONTENT_POLICY.maxFeedBytes,
  } = {},
) {
  const deadlineMs = Date.now() + timeoutMs;
  let currentUrl = rawUrl;
  const visitedUrls = new Set();

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      throw new ApiError(504, 'Quá thời gian chờ khi tải nguồn tin RSS (timeout)');
    }

    const validated = await validateExternalFeedUrl(currentUrl, {
      lookupFn,
      resolveDns: true,
    });

    if (visitedUrls.has(validated.canonicalUrl)) {
      throw new ApiError(400, 'Phát hiện vòng lặp chuyển hướng (redirect loop) không hợp lệ');
    }
    visitedUrls.add(validated.canonicalUrl);

    const response = await requestFn({
      parsedUrl: validated.parsedUrl,
      resolvedAddress: validated.resolvedAddress,
      resolvedFamily: validated.resolvedFamily,
      timeoutMs: remainingMs,
      maxBytes,
    });

    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      if (hop >= maxRedirects) {
        throw new ApiError(
          502,
          `Nguồn RSS chuyển hướng vượt quá số lần cho phép (tối đa ${maxRedirects} lần)`,
        );
      }

      const rawLocation = response.headers?.location;
      if (!rawLocation || typeof rawLocation !== 'string') {
        throw new ApiError(502, 'Phản hồi chuyển hướng RSS thiếu tiêu đề Location');
      }

      let nextParsed;
      try {
        nextParsed = new URL(rawLocation.trim(), validated.parsedUrl);
      } catch {
        throw new ApiError(400, 'Đích chuyển hướng (redirect URL) không hợp lệ');
      }

      if (!ALLOWED_SCHEMES.has(nextParsed.protocol)) {
        throw new ApiError(
          400,
          `Chặn chuyển hướng nguy hiểm sang giao thức ${nextParsed.protocol}`,
        );
      }

      if (
        validated.parsedUrl.protocol === 'https:' &&
        nextParsed.protocol === 'http:'
      ) {
        throw new ApiError(
          400,
          'Chặn chuyển hướng hạ cấp bảo mật không an toàn (HTTPS xuống HTTP)',
        );
      }

      // Immediately validate redirect target against SSRF before the next iteration
      await validateExternalFeedUrl(nextParsed.toString(), {
        lookupFn,
        resolveDns: true,
      });

      currentUrl = nextParsed.toString();
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new ApiError(
        502,
        `Nguồn RSS trả về mã trạng thái không hợp lệ (HTTP ${response.statusCode})`,
      );
    }

    return {
      finalUrl: validated.canonicalUrl,
      xmlBody: response.body,
      redirectCount: hop,
    };
  }

  throw new ApiError(502, 'Không thể tải dữ liệu từ nguồn RSS');
}

module.exports = {
  isPrivateOrReservedIp,
  isBlockedHostname,
  validateExternalFeedUrl,
  fetchRssFeedSafely,
};

