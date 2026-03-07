import { apiCall } from "./client";
import type { GenreTag, Interest } from "~/types/genre";

export async function getGenreTags(token: string): Promise<GenreTag[]> {
  return apiCall("/api/genres", token);
}

export async function getInterests(token: string): Promise<Interest[]> {
  return apiCall("/api/users/me/interests", token);
}

export async function updateInterests(
  token: string,
  genreTagIds: number[],
  refreshSuggestions?: boolean
): Promise<{ interests: Interest[]; reload_count_remaining: number }> {
  const url = refreshSuggestions
    ? "/api/users/me/interests?refresh_suggestions=true"
    : "/api/users/me/interests";
  return apiCall(url, token, {
    method: "PUT",
    body: JSON.stringify({ genre_tag_ids: genreTagIds }),
  });
}
