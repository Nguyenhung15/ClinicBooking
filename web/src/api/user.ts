import { http } from "./http";

type UnknownRecord = Record<string, unknown>;

export type UserProfile = {
  id: number;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  gender?: string;
  userType?: string;
  dob?: string;
  address?: string;
};

export type UpdateUserPayload = {
  fullName?: string;
  phoneNumber?: string;
  gender?: string;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const pickString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

function normalizeUser(raw: unknown): UserProfile {
  const record = isRecord(raw) ? raw : {};
  return {
    id: Number(record.id ?? 0),
    fullName: pickString(record.fullName) ?? pickString(record.name),
    email: pickString(record.email),
    phoneNumber: pickString(record.phoneNumber),
    gender: pickString(record.gender),
    userType: pickString(record.userType) ?? pickString(record.role),
  };
}

export async function fetchMyProfile(): Promise<UserProfile> {
  const res = await http.get("/users/me");
  const payload = res.data?.data ?? res.data;
  return normalizeUser(payload);
}

export async function updateMyProfile(payload: UpdateUserPayload): Promise<UserProfile> {
  const res = await http.put("/users/update", payload);
  const data = res.data?.data ?? res.data;
  return normalizeUser(data);
}

