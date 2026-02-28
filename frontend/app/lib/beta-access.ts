export const BETA_STORAGE_KEY = "roamble_beta_unlocked";

/**
 * 合言葉の正解（環境変数から取得。未設定時は仮の合言葉を使用）
 * ベータ版公開時に VITE_BETA_PASSPHRASE を設定する
 */
const BETA_PASSPHRASE =
  import.meta.env.VITE_BETA_PASSPHRASE ?? "ROAMBLE_BETA";

/**
 * ベータ版へのアクセスがアンロック済みか確認する
 */
export function isBetaUnlocked(): boolean {
  try {
    return localStorage.getItem(BETA_STORAGE_KEY) === "1";
  } catch {
    // SSR や localStorage 利用不可環境では常に false
    return false;
  }
}

/**
 * 合言葉を照合し、正しければ localStorage にフラグを保存する
 * @returns 合言葉が正しければ true
 */
export function unlockBeta(input: string): boolean {
  if (input.trim() === BETA_PASSPHRASE) {
    try {
      localStorage.setItem(BETA_STORAGE_KEY, "1");
    } catch {
      // localStorage 利用不可環境では無視
    }
    return true;
  }
  return false;
}
