const ApiError = require('./ApiError');

const NAMED_ENTITIES = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
});

function decodeXmlEntities(input) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : full;
    }
    if (entity.startsWith('#')) {
      const codePoint = parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : full;
    }
    const lower = entity.toLowerCase();
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower)
      ? NAMED_ENTITIES[lower]
      : full;
  });
}

function unwrapCdata(rawText) {
  if (!rawText) return '';
  return rawText.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
}

function sanitizePlainText(rawHtmlOrXml, maxLength = 5000) {
  if (!rawHtmlOrXml || typeof rawHtmlOrXml !== 'string') return '';
  const withoutCdata = unwrapCdata(rawHtmlOrXml);
  const decodedOnce = decodeXmlEntities(withoutCdata);
  const withoutDangerousBlocks = decodedOnce
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = withoutDangerousBlocks.replace(/<[^>]+>/g, ' ');
  const normalized = decodeXmlEntities(withoutTags)
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.slice(0, maxLength);
}

function canonicalizeArticleHttpUrl(rawUrl, baseUrl = null) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const cleaned = decodeXmlEntities(unwrapCdata(rawUrl)).trim();
  if (!cleaned) return null;

  let parsed;
  try {
    parsed = baseUrl ? new URL(cleaned, baseUrl) : new URL(cleaned);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }

  parsed.hash = '';
  return parsed.toString();
}

function extractFirstTagInner(xmlBlock, tagNames) {
  for (const tag of tagNames) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i');
    const match = regex.exec(xmlBlock);
    if (match && match[1] !== undefined) {
      return match[1];
    }
  }
  return '';
}

function extractAtomLink(xmlBlock) {
  const linkTags = xmlBlock.match(/<link\b[^>]*\/?>/gi) || [];
  let fallbackHref = null;
  for (const tag of linkTags) {
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!hrefMatch) continue;
    const relMatch = /\brel\s*=\s*["']([^"']+)["']/i.exec(tag);
    const rel = relMatch ? relMatch[1].toLowerCase() : 'alternate';
    if (rel === 'alternate') {
      return hrefMatch[1];
    }
    if (!fallbackHref) {
      fallbackHref = hrefMatch[1];
    }
  }
  return fallbackHref;
}

function extractImageFromEntry(xmlBlock, rawDescriptionHtml, baseUrl) {
  // 1. <enclosure url="..." type="image/..." /> or <media:content url="..." /> or <media:thumbnail url="..." />
  const mediaTagRegex =
    /<(?:enclosure|media:content|media:thumbnail)\b[^>]*\burl\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let mediaMatch;
  while ((mediaMatch = mediaTagRegex.exec(xmlBlock)) !== null) {
    const fullTag = mediaMatch[0];
    const candidateUrl = mediaMatch[1];
    const typeMatch = /\btype\s*=\s*["']([^"']+)["']/i.exec(fullTag);
    if (typeMatch && !typeMatch[1].toLowerCase().startsWith('image/')) {
      continue;
    }
    const safeUrl = canonicalizeArticleHttpUrl(candidateUrl, baseUrl);
    if (safeUrl) return safeUrl;
  }

  // 2. First <img src="..."> inside description/content HTML
  const decodedHtml = decodeXmlEntities(unwrapCdata(rawDescriptionHtml || ''));
  const imgMatch = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(decodedHtml);
  if (imgMatch && imgMatch[1]) {
    const safeUrl = canonicalizeArticleHttpUrl(imgMatch[1], baseUrl);
    if (safeUrl) return safeUrl;
  }

  return null;
}

function parsePubDate(rawDate) {
  if (!rawDate) return new Date();
  const text = sanitizePlainText(rawDate, 100);
  if (!text) return new Date();
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Parse RSS 2.0 (`<item>`) or Atom 1.0 (`<entry>`) XML safely into normalized news items.
 * Rejects XXE / `<!ENTITY` declarations outright.
 */
function parseRssOrAtomXml(xmlString, { feedBaseUrl = null, maxItems = 100 } = {}) {
  if (typeof xmlString !== 'string' || !xmlString.trim()) {
    throw new ApiError(422, 'Nội dung nguồn RSS trống hoặc không hợp lệ');
  }

  if (/<!ENTITY\b/i.test(xmlString)) {
    throw new ApiError(
      400,
      'Từ chối nội dung XML chứa khai báo thực thể ngoài không an toàn (XXE)',
    );
  }

  if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xmlString)) {
    throw new ApiError(
      422,
      'Nội dung phản hồi không đúng định dạng XML RSS/Atom hợp lệ',
    );
  }

  const rawBlocks = [];
  const itemRegex = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlString)) !== null && rawBlocks.length < maxItems) {
    rawBlocks.push({ kind: 'rss', content: match[1] });
  }

  if (rawBlocks.length === 0) {
    const entryRegex = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xmlString)) !== null && rawBlocks.length < maxItems) {
      rawBlocks.push({ kind: 'atom', content: match[1] });
    }
  }

  const parsedItems = [];
  let skippedInvalidCount = 0;

  for (const block of rawBlocks) {
    const xml = block.content;
    const rawTitle = extractFirstTagInner(xml, ['title']);
    const title = sanitizePlainText(rawTitle, 300);

    let rawLink = extractFirstTagInner(xml, ['link']);
    if (!rawLink || !unwrapCdata(rawLink).trim()) {
      rawLink = extractAtomLink(xml);
    }
    if (!rawLink) {
      const guidBlock = /<guid(?:\s+isPermaLink\s*=\s*["']true["'])?\s*>([\s\S]*?)<\/guid>/i.exec(
        xml,
      );
      if (guidBlock) rawLink = guidBlock[1];
    }

    const link = canonicalizeArticleHttpUrl(rawLink, feedBaseUrl);
    if (!title || !link) {
      skippedInvalidCount += 1;
      continue;
    }

    const rawSummaryHtml = extractFirstTagInner(xml, [
      'description',
      'summary',
      'content:encoded',
      'content',
    ]);
    const summary = sanitizePlainText(rawSummaryHtml, 5000);
    const image = extractImageFromEntry(xml, rawSummaryHtml, feedBaseUrl);
    const rawDate = extractFirstTagInner(xml, [
      'pubDate',
      'published',
      'updated',
      'dc:date',
    ]);
    const pubDate = parsePubDate(rawDate);

    parsedItems.push({
      title,
      link,
      summary,
      image,
      pubDate,
    });
  }

  return {
    totalExtractedBlocks: rawBlocks.length,
    validItems: parsedItems,
    skippedInvalidCount,
  };
}

module.exports = {
  decodeXmlEntities,
  sanitizePlainText,
  canonicalizeArticleHttpUrl,
  parseRssOrAtomXml,
};

