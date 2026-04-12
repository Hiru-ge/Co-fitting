import { apiCall } from "./client";
import type { GenreTag } from "~/types/genre";

export async function getGenreTags(authToken: string): Promise<GenreTag[]> {
  return apiCall("/api/genres", authToken);
}
