import { apiCall } from "./client";
import type { Place } from "~/types/suggestion";

/**
 * 提案APIのレスポンス型
 * places に提案施設リスト、notice に通知コードが含まれる場合がある
 * notice === "NO_INTEREST_PLACES" のとき、興味タグに合致する施設が半径内に見つからなかったことを示す
 */
export interface SuggestionResult {
  places: Place[];
  notice?: string;
}

/**
 * 日次提案を取得する（SuggestionResult: { places, notice? }）
 * バックエンドが日次キャッシュを担保するため、同一日・同一エリアでは同じ結果が返る
 */
export async function getSuggestions(
  token: string,
  lat: number,
  lng: number,
  radius?: number
): Promise<SuggestionResult> {
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
  const result = await getSuggestions(token, lat, lng, radius);
  return result.places[0];
}
