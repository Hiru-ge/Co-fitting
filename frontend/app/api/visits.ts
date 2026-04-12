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
  authToken: string,
  visitData: CreateVisitRequest,
): Promise<CreateVisitResponse> {
  return apiCall("/api/visits", authToken, {
    method: "POST",
    body: JSON.stringify(visitData),
  });
}

export async function getVisit(authToken: string, id: number): Promise<Visit> {
  return apiCall(`/api/visits/${id}`, authToken);
}

export async function updateVisit(
  authToken: string,
  id: number,
  data: UpdateVisitRequest,
): Promise<Visit> {
  return apiCall(`/api/visits/${id}`, authToken, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listVisits(
  authToken: string,
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
  return apiCall(`/api/visits?${params.toString()}`, authToken);
}

export async function getMapVisits(
  authToken: string,
): Promise<MapVisitResponse> {
  return apiCall("/api/visits/map", authToken);
}
