// src/api/doctor.ts
import { http } from "./http";

/** ---- Domain types (theo BE hiện có) ---- */
export type Doctor = {
  id: number;
  fullName: string;

  email?: string;
  phoneNumber?: string;
  gender?: "Male" | "Female" | "Other";

  degree?: string;
  description?: string;
  experience?: string;

  specialtyId?: number;
  specialtyName?: string;
  avatarUrl?: string;
  imageUrl?: string;
  photoUrl?: string;
  profileImage?: string;
};

export type CreateDoctorPayload = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  gender: "Male" | "Female" | "Other";
  specialization: string;
  degree?: string;
  description?: string;
  experience?: string;
};

export type UpdateDoctorPayload = {
  fullName?: string;
  phoneNumber?: string;
  gender?: "Male" | "Female" | "Other";
  specialtyId?: number;
  degree?: string;
  description?: string;
  experience?: string;
};

/* Chuẩn hoá response */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (isRecord(data)) {
    if (Array.isArray(data.items)) return data.items as T[];
    if (Array.isArray(data.data)) return data.data as T[];
  }
  return [];
}

function pickObject<T>(data: unknown): T {
  if (isRecord(data) && isRecord(data.data)) {
    return data.data as T;
  }
  return data as T;
}

/* Map về shape FE thống nhất */
function normalizeDoctor(raw: unknown): Doctor {
  if (!isRecord(raw)) {
    return {
      id: Number((raw as { id?: number })?.id ?? 0),
      fullName: "",
    };
  }

  const specialtyRaw = isRecord(raw.specialty) ? raw.specialty : undefined;
  const specialitiesList = Array.isArray(raw["specialities"])
    ? raw["specialities"].filter(isRecord)
    : undefined;
  const specialtySource = specialtyRaw ?? specialitiesList?.[0];

  const specialtyId =
    typeof raw.specialtyId === "number"
      ? raw.specialtyId
      : typeof raw["specialityId"] === "number"
      ? (raw["specialityId"] as number)
      : typeof specialtySource?.id === "number"
      ? specialtySource.id
      : undefined;

  const specialtyName =
    typeof raw.specialtyName === "string"
      ? raw.specialtyName
      : typeof raw["specialityName"] === "string"
      ? (raw["specialityName"] as string)
      : typeof specialtySource?.name === "string"
      ? specialtySource.name
      : typeof raw.specialization === "string"
      ? raw.specialization
      : undefined;

  const avatar =
    (typeof raw.avatarUrl === "string" && raw.avatarUrl) ||
    (typeof raw.imageUrl === "string" && raw.imageUrl) ||
    (typeof raw.photoUrl === "string" && raw.photoUrl) ||
    (typeof raw.profileImage === "string" && raw.profileImage) ||
    undefined;

  return {
    id: Number(raw.id ?? 0),
    fullName: (raw.fullName as string | undefined) ?? (raw.name as string | undefined) ?? "",
    email: typeof raw.email === "string" ? raw.email : undefined,
    phoneNumber: typeof raw.phoneNumber === "string" ? raw.phoneNumber : undefined,
    gender: raw.gender === "Male" || raw.gender === "Female" || raw.gender === "Other" ? raw.gender : undefined,
    degree: typeof raw.degree === "string" ? raw.degree : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    experience: typeof raw.experience === "string" ? raw.experience : undefined,
    specialtyId,
    specialtyName,
    avatarUrl: avatar,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : undefined,
    photoUrl: typeof raw.photoUrl === "string" ? raw.photoUrl : undefined,
    profileImage: typeof raw.profileImage === "string" ? raw.profileImage : undefined,
  };
}
function normalizeDoctorArray(list: unknown[]): Doctor[] {
  return (list || []).map(normalizeDoctor);
}

/** ================== API CALLS ================== */
/** GET /admin/doctors */
export async function fetchDoctorsAll(): Promise<Doctor[]> {
  const res = await http.get("/admin/doctors");
  return normalizeDoctorArray(pickArray(res.data));
}

/** GET /doctors/by-specialty/{specialtyId} */
export async function fetchDoctorsBySpecialty(specialtyId: number): Promise<Doctor[]> {
  const res = await http.get(`/doctors/by-specialty/${specialtyId}`);
  return normalizeDoctorArray(pickArray(res.data));
}

/** GET /doctors/{id} */
export async function fetchDoctorById(id: number): Promise<Doctor> {
  const res = await http.get(`/doctors/${id}`);
  return normalizeDoctor(pickObject(res.data));
}

/** GET /doctors/search?keyword=... */
export async function searchDoctors(keyword: string): Promise<Doctor[]> {
  const res = await http.get(`/doctors/search?keyword=${encodeURIComponent(keyword)}`);
  return normalizeDoctorArray(pickArray(res.data));
}

/**
 * POST /admin/create-user
 * - BE tạo user bác sĩ; nếu BE dùng endpoint khác, đổi URL dưới.
 * - Nếu BE tự set role/authority cho bác sĩ thì bỏ `role`.
 */
export async function createDoctor(payload: CreateDoctorPayload): Promise<Doctor> {
  const res = await http.post("/admin/create-user", {
    ...payload,
    userType: "Doctor", // đúng key và đúng casing như Postman của bạn
  });
  return pickObject<Doctor>(res.data);
}

/** PUT /admin/update-doctor/{id} */
export async function updateDoctor(id: number, payload: UpdateDoctorPayload): Promise<Doctor> {
  const res = await http.put(`/admin/update-doctor/${id}`, payload);
  return normalizeDoctor(pickObject(res.data));
}
