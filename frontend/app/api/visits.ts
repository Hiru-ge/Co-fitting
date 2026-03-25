import { apiCall } from "./client";
import type {
  CreateVisitRequest,
  CreateVisitResponse,
  MapVisitResponse,
  UpdateVisitRequest,
  Visit,
  VisitListResponse,
} from "~/types/visit";

export async function createVisit(
  token: string,
  visitData: CreateVisitRequest,
): Promise<CreateVisitResponse> {
  return apiCall("/api/visits", token, {
    method: "POST",
    body: JSON.stringify(visitData),
  });
}

export async function getVisit(token: string, id: number): Promise<Visit> {
  return apiCall(`/api/visits/${id}`, token);
}

export async function updateVisit(
  token: string,
  id: number,
  data: UpdateVisitRequest,
): Promise<Visit> {
  return apiCall(`/api/visits/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listVisits(
  token: string,
  limit: number = 20,
  offset: number = 0,
  from?: string,
  until?: string,
): Promise<VisitListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (from) params.set("from", from);
  if (until) params.set("until", until);
  return apiCall(`/api/visits?${params.toString()}`, token);
}

export async function getMapVisits(token: string): Promise<MapVisitResponse> {
  return apiCall("/api/visits/map", token);
}
