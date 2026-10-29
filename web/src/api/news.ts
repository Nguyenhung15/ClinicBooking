import { http } from './http';

export interface News {
  id: number;
  title: string;
  link?: string;
  description?: string;
  summary?: string;
  pubDate?: string;
  source?: {
    id: number;
    name: string;
    category?: string;
  };
  imageUrl?: string;
  image?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (isRecord(data)) {
    if (Array.isArray(data.data)) return data.data as T[];
    if (Array.isArray(data.items)) return data.items as T[];
  }
  return [];
}

function normalizeNews(raw: unknown): News {
  if (!isRecord(raw)) {
    return {
      id: Number((raw as { id?: number })?.id ?? 0),
      title: '',
    };
  }

  const sourceRaw = isRecord(raw.source) ? raw.source : undefined;

  // pubDate có thể là LocalDateTime từ backend, cần convert
  let pubDateStr: string | undefined;
  if (raw.pubDate) {
    if (typeof raw.pubDate === 'string') {
      pubDateStr = raw.pubDate;
    } else if (isRecord(raw.pubDate)) {
      // Nếu là object LocalDateTime, convert sang ISO string
      pubDateStr = String(raw.pubDate);
    }
  }

  return {
    id: Number(raw.id ?? 0),
    title: (raw.title as string | undefined) ?? '',
    link: typeof raw.link === 'string' ? raw.link : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    pubDate: pubDateStr,
    source: sourceRaw
      ? {
          id: Number(sourceRaw.id ?? 0),
          name: (sourceRaw.name as string | undefined) ?? '',
          category: typeof sourceRaw.category === 'string' ? sourceRaw.category : undefined,
        }
      : undefined,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined,
    image: typeof raw.image === 'string' ? raw.image : undefined,
  };
}

function normalizeNewsArray(list: unknown[]): News[] {
  return (list || []).map(normalizeNews);
}

/**
 * GET /rss-sources/news/latest?limit=20
 * Lấy tin tức mới nhất
 */
export async function fetchLatestNews(limit: number = 6): Promise<News[]> {
  try {
    const res = await http.get(`/rss-sources/news/latest?limit=${limit}`);
    return normalizeNewsArray(pickArray(res.data));
  } catch (error) {
    console.error('Error fetching latest news:', error);
    return [];
  }
}

/**
 * GET /rss-sources/news/source/{id}?limit=20
 * Lấy tin tức theo nguồn
 */
export async function fetchNewsBySource(sourceId: number, limit: number = 20): Promise<News[]> {
  try {
    const res = await http.get(`/rss-sources/news/source/${sourceId}?limit=${limit}`);
    return normalizeNewsArray(pickArray(res.data));
  } catch (error) {
    console.error('Error fetching news by source:', error);
    return [];
  }
}

