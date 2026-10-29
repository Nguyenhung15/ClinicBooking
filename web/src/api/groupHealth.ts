import { http } from "./http";

export type GroupHealthResultFile = {
  version: number;
  originalName: string;
  size: number;
  uploadedAt?: string;
  reviewStatus: "PENDING_ADMIN_REVIEW" | "APPROVED" | "REJECTED";
  reviewedAt?: string;
  reviewNote?: string;
};

export type GroupHealthAssignment = {
  id: string;
  groupName: string;
  departments: string;
  preferredDate: string | null;
  shiftDate: string | null;
  shift: string | null;
  specialtyName: string;
  capacityAllocated: number | null;
  note: string;
  sourceFileAvailable: boolean;
  sourceFileName: string;
  resultStatus: "NONE" | "UPLOADED" | "APPROVED" | "REJECTED";
  resultFiles: GroupHealthResultFile[];
};

const unwrap = <T,>(response: unknown): T => {
  if (typeof response === "object" && response !== null && "data" in response) {
    const envelope = (response as { data?: unknown }).data;
    if (typeof envelope === "object" && envelope !== null && "data" in envelope) {
      return (envelope as { data: T }).data;
    }
  }
  return response as T;
};

export async function fetchMyGroupHealthAssignments(): Promise<GroupHealthAssignment[]> {
  const response = await http.get("/group-health/assignments/my");
  return unwrap<GroupHealthAssignment[]>(response);
}

export async function uploadGroupHealthResult(
  assignmentId: string,
  file: File,
): Promise<GroupHealthAssignment> {
  const form = new FormData();
  form.append("file", file);
  const response = await http.post(`/group-health/assignments/${encodeURIComponent(assignmentId)}/result`, form);
  return unwrap<GroupHealthAssignment>(response);
}

async function download(url: string, fileName: string): Promise<void> {
  const response = await http.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function downloadGroupHealthSource(assignmentId: string, fileName: string): Promise<void> {
  return download(
    `/group-health/assignments/${encodeURIComponent(assignmentId)}/source`,
    fileName,
  );
}

export function downloadGroupHealthResult(
  assignmentId: string,
  version: number,
  fileName: string,
): Promise<void> {
  return download(
    `/group-health/assignments/${encodeURIComponent(assignmentId)}/results/${version}`,
    fileName,
  );
}
