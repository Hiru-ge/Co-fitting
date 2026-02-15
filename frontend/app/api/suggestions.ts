import { apiCall } from "./client";
import type { Place } from "~/types/suggestion";

/**
 * 日次提案を取得する（配列レスポンス: 最大3件）
 * バックエンドが日次キャッシュを担保するため、同一日・同一エリアでは同じ結果が返る
 */
export async function getSuggestions(
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

/**
 * @deprecated getSuggestions() を使用してください
 */
export async function getSuggestion(
  token: string,
  lat: number,
  lng: number,
  radius?: number
): Promise<Place> {
  const places = await getSuggestions(token, lat, lng, radius);
  return places[0];
}
