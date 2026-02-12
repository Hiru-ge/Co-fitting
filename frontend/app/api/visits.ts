import { apiCall } from "./client";
import type { CreateVisitRequest } from "~/types/visit";

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
) {
  return apiCall(`/api/visits?limit=${limit}&offset=${offset}`, token);
}