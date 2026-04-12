import { apiCall } from "./client";
import type { User, UserStats, EarnedBadge, Proficiency } from "~/types/auth";
import type { Interest } from "~/types/genre";

export async function getUser(token: string): Promise<User> {
  return apiCall("/api/users/me", token);
}

export async function updateDisplayName(
  token: string,
  displayName: string,
): Promise<User> {
  return apiCall("/api/users/me", token, {
    method: "PATCH",
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function updateSearchRadius(
  token: string,
  searchRadius: number,
  refreshSuggestions?: boolean,
): Promise<{ reload_count_remaining: number }> {
  const url = refreshSuggestions
    ? "/api/users/me?refresh_suggestions=true"
    : "/api/users/me";
  return apiCall(url, token, {
    method: "PATCH",
    body: JSON.stringify({ search_radius: searchRadius }),
  });
}

export async function deleteAccount(token: string): Promise<void> {
  await apiCall("/api/users/me", token, {
    method: "DELETE",
  });
}

export async function getUserStats(token: string): Promise<UserStats> {
  return apiCall("/api/users/me/stats", token);
}

export async function getUserBadges(token: string): Promise<EarnedBadge[]> {
  return apiCall("/api/users/me/badges", token);
}

export async function getProficiency(token: string): Promise<Proficiency[]> {
  return apiCall("/api/users/me/proficiency", token);
}

export async function getInterests(token: string): Promise<Interest[]> {
  return apiCall("/api/users/me/interests", token);
}

export async function updateInterests(
  token: string,
  genreTagIds: number[],
  refreshSuggestions?: boolean,
): Promise<{ interests: Interest[]; reload_count_remaining: number }> {
  const url = refreshSuggestions
    ? "/api/users/me/interests?refresh_suggestions=true"
    : "/api/users/me/interests";
  return apiCall(url, token, {
    method: "PUT",
    body: JSON.stringify({ genre_tag_ids: genreTagIds }),
  });
}
