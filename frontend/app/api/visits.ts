import { apiCall } from "./client";
import type { CreateVisitRequest, CreateVisitResponse, UpdateVisitRequest, Visit, VisitListResponse } from "~/types/visit";

export async function createVisit(token: string, visitData: CreateVisitRequest): Promise<CreateVisitResponse> {
  return apiCall('/api/visits', token, {
    method: 'POST',
    body: JSON.stringify(visitData),
  });
}

export async function getVisit(token: string, id: number): Promise<Visit> {
  return apiCall(`/api/visits/${id}`, token);
}

export async function updateVisit(
  token: string,
  id: number,
  data: UpdateVisitRequest
): Promise<Visit> {
  return apiCall(`/api/visits/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listVisits(
  token: string,
  limit: number = 20,
  offset: number = 0
): Promise<VisitListResponse> {
  return apiCall(`/api/visits?limit=${limit}&offset=${offset}`, token);
}
