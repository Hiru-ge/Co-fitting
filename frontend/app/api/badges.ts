import { apiCall } from "./client";
import type { Badge } from "~/types/auth";

export async function getAllBadges(authToken: string): Promise<Badge[]> {
  return apiCall("/api/badges", authToken);
}
