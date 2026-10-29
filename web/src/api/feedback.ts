// src/api/feedback.ts
import { http } from "./http";

export interface FeedbackItem {
  id: number;
  userId?: number;
  patientName: string;
  patientEmail?: string;
  rating: number;
  title?: string;
  comment: string;
  category?: string;
  isAnonymous?: boolean;
  adminResponse?: string;
  adminRespondedAt?: string;
  createdAt: string;
  updatedAt?: string;
  isOwner?: boolean;
}

export interface CreateFeedbackPayload {
  rating: number;
  title?: string;
  comment: string;
  category?: string;
  isAnonymous?: boolean;
}

export interface FeedbackStats {
  averageRating: number;
  totalFeedbacks: number;
  starCounts: Record<number, number>;
}

export async function fetchMyFeedbacks(): Promise<FeedbackItem[]> {
  const res = await http.get("/feedbacks/my");
  return (res.data?.data ?? res.data) as FeedbackItem[];
}

export async function fetchPublicFeedbacks(): Promise<FeedbackItem[]> {
  const res = await http.get("/feedbacks/public");
  return (res.data?.data ?? res.data) as FeedbackItem[];
}

export async function fetchFeedbackStats(): Promise<FeedbackStats> {
  const res = await http.get("/feedbacks/stats");
  return (res.data?.data ?? res.data) as FeedbackStats;
}

export async function createFeedback(payload: CreateFeedbackPayload): Promise<FeedbackItem> {
  const res = await http.post("/feedbacks", payload);
  return (res.data?.data ?? res.data) as FeedbackItem;
}

export async function updateFeedback(
  id: number,
  payload: CreateFeedbackPayload
): Promise<FeedbackItem> {
  const res = await http.put(`/feedbacks/${id}`, payload);
  return (res.data?.data ?? res.data) as FeedbackItem;
}

export async function deleteFeedback(id: number): Promise<void> {
  await http.delete(`/feedbacks/${id}`);
}
