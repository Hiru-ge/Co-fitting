import { apiCall } from "./client";
import type { User, UserStats, EarnedBadge, Proficiency } from "~/types/auth";
import type { Interest } from "~/types/genre";

export async function getUser(authToken: string): Promise<User> {
  return apiCall("/api/users/me", authToken);
}

export async function updateDisplayName(
  authToken: string,
  displayName: string,
): Promise<User> {
  return apiCall("/api/users/me", authToken, {
    method: "PATCH",
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function updateSearchRadius(
  authToken: string,
  searchRadius: number,
  refreshSuggestions?: boolean,
): Promise<{ reload_count_remaining: number }> {
  const url = refreshSuggestions
    ? "/api/users/me?refresh_suggestions=true"
    : "/api/users/me";
  return apiCall(url, authToken, {
    method: "PATCH",
    body: JSON.stringify({ search_radius: searchRadius }),
  });
}

export async function deleteAccount(authToken: string): Promise<void> {
  await apiCall("/api/users/me", authToken, {
    method: "DELETE",
  });
}

export async function getUserStats(authToken: string): Promise<UserStats> {
  return apiCall("/api/users/me/stats", authToken);
}

export async function getUserBadges(authToken: string): Promise<EarnedBadge[]> {
  return apiCall("/api/users/me/badges", authToken);
}

export async function getProficiency(
  authToken: string,
): Promise<Proficiency[]> {
  return apiCall("/api/users/me/proficiency", authToken);
}

export async function getInterests(authToken: string): Promise<Interest[]> {
  return apiCall("/api/users/me/interests", authToken);
}

export async function updateInterests(
  authToken: string,
  genreTagIds: number[],
  refreshSuggestions?: boolean,
): Promise<{ interests: Interest[]; reload_count_remaining: number }> {
  const url = refreshSuggestions
    ? "/api/users/me/interests?refresh_suggestions=true"
    : "/api/users/me/interests";
  return apiCall(url, authToken, {
    method: "PUT",
    body: JSON.stringify({ genre_tag_ids: genreTagIds }),
  });
}
