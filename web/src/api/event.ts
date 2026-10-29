import { http } from "./http";

export type EventItem = {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate?: string;
  endDate?: string;
  isEnabled: boolean;
  voucherId?: number | null;
  voucherCode?: string | null;
  voucherName?: string | null;
};

export type EventPayload = {
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: string; // dd/MM/yyyy HH:mm
  endDate: string; // dd/MM/yyyy HH:mm
  isEnabled: boolean;
  voucherId?: number | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const pickString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const pickNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
};

const normalizeEvent = (raw: unknown): EventItem => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: Number(record.id ?? 0),
    title: pickString(record.title) ?? "",
    description: pickString(record.description),
    location: pickString(record.location),
    startDate: pickString(record.startDate),
    endDate: pickString(record.endDate),
    isEnabled: typeof record.isEnabled === "boolean" ? record.isEnabled : Boolean(record.isEnabled ?? true),
    voucherId: pickNumber(record.voucherId) ?? null,
    voucherCode: pickString(record.voucherCode),
    voucherName: pickString(record.voucherName),
  };
};

const extractArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.data)) return data.data;
  return [];
};

const extractObject = (data: unknown): unknown =>
  isRecord(data) && "data" in data ? (data.data as unknown) : data;

export async function fetchEvents(): Promise<EventItem[]> {
  const res = await http.get("/events/all");
  return extractArray(res.data).map(normalizeEvent);
}

export async function createEvent(payload: EventPayload): Promise<EventItem> {
  const res = await http.post("/events/create", payload);
  return normalizeEvent(extractObject(res.data));
}

export async function updateEvent(id: number, payload: EventPayload): Promise<EventItem> {
  const res = await http.put(`/events/update/${id}`, payload);
  return normalizeEvent(extractObject(res.data));
}

export async function deleteEvent(id: number): Promise<void> {
  await http.delete(`/events/delete/${id}`);
}


