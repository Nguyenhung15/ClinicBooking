import { http } from "./http";
import type { EventItem } from "./event";

export type UserEventItem = EventItem & { registrationStatus?: string };

export type MyEventItem = {
  userEventId: number;
  eventId: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  registeredAt?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeUserEvent = (raw: unknown): UserEventItem => {
  const event = isRecord(raw) ? raw : {};
  const base: UserEventItem = {
    id: Number(event.id ?? 0),
    title: typeof event.title === "string" ? event.title : "",
    description: typeof event.description === "string" ? event.description : undefined,
    location: typeof event.location === "string" ? event.location : undefined,
    startDate: typeof event.startDate === "string" ? event.startDate : undefined,
    endDate: typeof event.endDate === "string" ? event.endDate : undefined,
    isEnabled: typeof event.isEnabled === "boolean" ? event.isEnabled : true,
    voucherId: typeof event.voucherId === "number" ? event.voucherId : undefined,
    voucherCode: typeof event.voucherCode === "string" ? event.voucherCode : undefined,
    voucherName: typeof event.voucherName === "string" ? event.voucherName : undefined,
  };
  const status = typeof event.registrationStatus === "string" ? event.registrationStatus : undefined;
  return status ? { ...base, registrationStatus: status } : base;
};

const extractArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.data)) return data.data;
  return [];
};

export async function fetchAvailableEvents(): Promise<UserEventItem[]> {
  const res = await http.get("/events");
  return extractArray(res.data).map(normalizeUserEvent);
}

export async function fetchRegisteredEventIds(): Promise<number[]> {
  const res = await http.get("/events/my");
  return extractArray(res.data).map((raw) => {
    const record = isRecord(raw) ? raw : {};
    return Number(record.eventId ?? record.eventID ?? record.id ?? 0);
  });
}

export async function registerEvent(eventId: number): Promise<void> {
  await http.post(`/events/${eventId}/register`);
}

export async function fetchMyEvents(): Promise<MyEventItem[]> {
  const res = await http.get("/events/my");
  return extractArray(res.data).map((raw) => {
    const record = isRecord(raw) ? raw : {};
    return {
      userEventId: Number(record.id ?? 0),
      eventId: Number(record.eventId ?? record.eventID ?? 0),
      title: typeof record.eventName === "string" ? record.eventName : typeof record.title === "string" ? record.title : "",
      description: typeof record.eventDescription === "string" ? record.eventDescription : undefined,
      location: typeof record.eventLocation === "string" ? record.eventLocation : undefined,
      startDate: typeof record.eventStart === "string" ? record.eventStart : undefined,
      endDate: typeof record.eventEnd === "string" ? record.eventEnd : undefined,
      status: typeof record.status === "string" ? record.status : "PENDING",
      registeredAt: typeof record.registeredAt === "string" ? record.registeredAt : undefined,
    };
  });
}


