// src/api/prescription.ts
import { http } from "./http";

/** ===== Types ===== */
export type Prescription = {
  id: number;
  medicineName?: string | null;
  dosage?: string | null;
  duration?: string | null;
  instructions?: string | null;
  createdAt?: string;
  appointmentId?: number;
};

export type CreatePrescriptionPayload = {
  medicineName?: string | null;
  dosage?: string | null;
  duration?: string | null;
  instructions?: string | null;
};

export type ActionResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};

/** ===== Utilities ===== */
type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const normalizePrescription = (raw: unknown): Prescription => {
  const record = isRecord(raw) ? raw : {};
  const appointment = isRecord(record.appointment) ? record.appointment : undefined;
  return {
    id: Number(record.id ?? 0),
    medicineName: typeof record.medicineName === "string" ? record.medicineName : null,
    dosage: typeof record.dosage === "string" ? record.dosage : null,
    duration: typeof record.duration === "string" ? record.duration : null,
    instructions: typeof record.instructions === "string" ? record.instructions : null,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    appointmentId:
      typeof record.appointmentId === "number"
        ? record.appointmentId
        : appointment && typeof appointment.id === "number"
        ? (appointment.id as number)
        : undefined,
  };
};

const extractArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.data)) return data.data;
  return [];
};

const extractObject = (data: unknown): unknown =>
  isRecord(data) && "data" in data ? (data.data as unknown) : data;

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

/** 🔵 DOCTOR — Tạo prescription cho appointment */
export async function createPrescription(
  appointmentId: number,
  payload?: CreatePrescriptionPayload
): Promise<ActionResponse<Prescription>> {
  try {
    const body: CreatePrescriptionPayload =
      payload ?? {
        medicineName: null,
        dosage: null,
        duration: null,
        instructions: null,
      };
    const res = await http.post(`/prescriptions/create/${appointmentId}`, body);
    const prescription = normalizePrescription(extractObject(res.data));
    return { ok: true, data: prescription };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error, "Failed to create prescription") };
  }
}

/** Lấy danh sách prescriptions theo appointment ID */
export async function getPrescriptionsByAppointment(
  appointmentId: number
): Promise<ActionResponse<Prescription[]>> {
  try {
    const res = await http.get(`/prescriptions/by-appointment/${appointmentId}`);
    const payload = extractArray(res.data);
    return { ok: true, data: payload.map(normalizePrescription) };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error, "Failed to fetch prescriptions") };
  }
}

/** 🔵 DOCTOR — Tạo nhiều prescriptions cho appointment cùng lúc */
export async function createPrescriptions(
  appointmentId: number,
  prescriptions: CreatePrescriptionPayload[]
): Promise<ActionResponse<Prescription[]>> {
  try {
    const res = await http.post(`/prescriptions/batch-create/${appointmentId}`, prescriptions);
    const payload = extractArray(res.data);
    return { ok: true, data: payload.map(normalizePrescription) };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error, "Failed to create prescriptions") };
  }
}

/** 🔵 DOCTOR — Cập nhật prescriptions cho appointment (chỉ khi chưa completed) */
export async function updatePrescriptions(
  appointmentId: number,
  prescriptions: CreatePrescriptionPayload[]
): Promise<ActionResponse<Prescription[]>> {
  try {
    const res = await http.put(`/prescriptions/update/${appointmentId}`, prescriptions);
    const payload = extractArray(res.data);
    return { ok: true, data: payload.map(normalizePrescription) };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error, "Failed to update prescriptions") };
  }
}