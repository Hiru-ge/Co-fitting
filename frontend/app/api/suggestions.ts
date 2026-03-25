import { apiCall } from "./client";
import type { Place } from "~/types/suggestion";

/**
 * 提案APIのレスポンス型
 * places に提案施設リスト、notice に通知コードが含まれる場合がある
 * notice === "NO_INTEREST_PLACES" のとき、興味タグに合致する施設が半径内に見つからなかったことを示す
 * completed === true のとき、本日の3件提案を全て訪問済みであることを示す
 * reload_count_remaining は残りリロード回数（1日3回まで）
 */
export interface SuggestionResult {
  places: Place[];
  notice?: string;
  completed?: boolean;
  reload_count_remaining?: number;
}

/**
 * 日次提案を取得する（SuggestionResult: { places, notice?, reload_count_remaining? }）
 * バックエンドが日次キャッシュを担保するため、同一日・同一エリアでは同じ結果が返る
 * forceReload=true の場合、日次キャッシュをクリアして新しい提案を生成する（1日3回まで）
 */
export async function getSuggestions(
  token: string,
  lat: number,
  lng: number,
  radius?: number,
  forceReload?: boolean,
): Promise<SuggestionResult> {
  const body: Record<string, number | boolean> = { lat, lng };
  if (radius !== undefined) {
    body.radius = radius;
  }
  if (forceReload) {
    body.force_reload = true;
  }
  return apiCall("/api/suggestions", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
