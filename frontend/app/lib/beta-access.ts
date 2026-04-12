import { API_BASE_URL } from "~/utils/constants";

export const BETA_STORAGE_KEY = "roamble_beta_unlocked";

/**
 * ベータ版へのアクセスがアンロック済みか確認する
 */
export function isBetaUnlocked(): boolean {
  try {
    return localStorage.getItem(BETA_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * バックエンドで合言葉を照合し、正しければ localStorage にフラグを保存する
 * @returns 合言葉が正しければ true
 */
export async function unlockBeta(input: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/beta/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: input.trim() }),
    });

    if (!res.ok) {
      return false;
    }

    localStorage.setItem(BETA_STORAGE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
