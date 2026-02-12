import { apiCall } from "./client";

export async function getSuggestion(
  token: string,
  lat: number,
  lng: number,
  radius?: number
) {
  const body: Record<string, number> = { lat, lng };
  if (radius !== undefined) {
    body.radius = radius;
  }
  return apiCall("/api/suggestions", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
