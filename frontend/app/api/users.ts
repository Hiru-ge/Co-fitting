import { apiCall } from "./client";
import type { User, UserStats, EarnedBadge, Proficiency } from "~/types/auth";

export async function updateDisplayName(
  token: string,
  displayName: string
): Promise<User> {
  return apiCall("/api/users/me", token, {
    method: "PATCH",
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function updateSearchRadius(
  token: string,
  searchRadius: number,
  refreshSuggestions?: boolean
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
