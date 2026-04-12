import { apiCall } from "./client";
import type { SuggestionResult } from "~/types/suggestion";

/**
 * 日次提案を取得する（SuggestionResult: { places, notice?, reload_count_remaining? }）
 * バックエンドが日次キャッシュを担保するため、同一日・同一エリアでは同じ結果が返る
 * isReload=true の場合、日次キャッシュをクリアして新しい提案を生成する（1日3回まで）
 */
export async function getSuggestions(
  token: string,
  lat: number,
  lng: number,
  isReload?: boolean,
): Promise<SuggestionResult> {
  const body: Record<string, number | boolean> = { lat, lng };
  if (isReload) {
    body.is_reload = true;
  }
  return apiCall("/api/suggestions", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
