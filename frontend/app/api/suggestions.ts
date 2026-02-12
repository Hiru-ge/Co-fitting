import { apiCall } from "./client";
import type { Place } from "~/types/suggestion";

export async function getSuggestion(
  token: string,
  lat: number,
  lng: number,
  radius?: number
): Promise<Place[]> {
  const body: Record<string, number> = { lat, lng };
  if (radius !== undefined) {
    body.radius = radius;
  }
  return apiCall("/api/suggestions", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
