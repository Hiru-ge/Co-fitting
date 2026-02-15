import { apiCall } from "./client";
import type { CreateVisitRequest, VisitListResponse } from "~/types/visit";

export async function createVisit(token: string, visitData: CreateVisitRequest) {
  return apiCall('/api/visits', token, {
    method: 'POST',
    body: JSON.stringify(visitData),
  });
}

export async function listVisits(
  token: string,
  limit: number = 20,
  offset: number = 0
): Promise<VisitListResponse> {
  return apiCall(`/api/visits?limit=${limit}&offset=${offset}`, token);
}
