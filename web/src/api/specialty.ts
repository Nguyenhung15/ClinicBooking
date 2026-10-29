import { http } from "./http";

export type Specialty = {
  id: number;
  name: string;
  description: string;
};

export type SpecialtyCreatePayload = {
  name: string;
  description: string;
};

export type SpecialtyUpdatePayload = {
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

const normalizeSpecialty = (raw: unknown): Specialty => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: Number(record.id ?? 0),
    name: typeof record.name === "string" ? record.name : "",
    description: typeof record.description === "string" ? record.description : "",
  };
};

function pickSingle(data: unknown): UnknownRecord | undefined {
  if (isRecord(data)) return data;
  if (Array.isArray(data) && data.length > 0 && isRecord(data[0])) {
    return data[0];
  }
  if (isRecord(data) && Array.isArray(data.data) && data.data.length > 0 && isRecord(data.data[0])) {
    return data.data[0] as UnknownRecord;
  }
  return undefined;
}


export async function fetchSpecialties(): Promise<Specialty[]> {
  const res = await http.get("/specialties/all");
  return pickArray(res.data).map(normalizeSpecialty);
}


export async function createSpecialty(payload: SpecialtyCreatePayload): Promise<Specialty> {
  const res = await http.post("/specialties/create", payload);
  const data = pickSingle(res.data) ?? pickSingle(res.data?.data);
  return normalizeSpecialty(data);
}


export async function updateSpecialty(id: number, payload: SpecialtyUpdatePayload): Promise<Specialty> {
  const res = await http.put(`/specialties/update/${id}`, payload);
  const data = pickSingle(res.data) ?? pickSingle(res.data?.data);
  return normalizeSpecialty(data);
}

/**
 * Fetch specialty by ID from /all endpoint and filter
 * (Backend doesn't have /{id} endpoint, so we fetch all and filter)
 */
export async function fetchSpecialtyById(id: number): Promise<Specialty | null> {
  try {
    const specialties = await fetchSpecialties();
    const specialty = specialties.find(s => s.id === id);
    return specialty || null;
  } catch (error) {
    console.error('Error fetching specialty:', error);
    return null;
  }
}