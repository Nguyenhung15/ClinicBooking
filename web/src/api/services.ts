import { http } from "./http";

export type Service = {
  id: number;
  name: string;
  description: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const pickArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.items)) return data.items;
  if (isRecord(data) && Array.isArray(data.data)) return data.data;
  return [];
};

const normalizeService = (raw: unknown): Service => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: Number(record.id ?? 0),
    name: typeof record.name === "string" ? record.name : "",
    description: typeof record.description === "string" ? record.description : "",
  };
};

export async function fetchServices(): Promise<Service[]> {
  const res = await http.get("/services/all");
  return pickArray(res.data).map(normalizeService);
}

export async function fetchService(id: number | string): Promise<Service | null> {
  const res = await http.get(`/services/${id}`);
  const arr = pickArray(res.data);
  if (arr.length) return normalizeService(arr[0]);
  const fallback = isRecord(res.data?.data) ? res.data.data : res.data;
  return normalizeService(fallback);
}