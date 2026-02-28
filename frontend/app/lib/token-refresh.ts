import { API_BASE_URL } from "~/utils/constants";
import { getRefreshToken, setToken } from "~/lib/token-storage";

/**
 * リフレッシュトークンでアクセストークンを更新する
 * 失敗した場合は Error を throw する
 */
export async function refreshToken(): Promise<void> {
  const refresh = getRefreshToken();

  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const { access_token, refresh_token } = await res.json();
  setToken(access_token, refresh_token);
}

/**
 * リフレッシュトークンでアクセストークンの更新を試みる
 * @returns 更新成功なら true、失敗なら false
 */
export async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    await refreshToken();
    return true;
  } catch {
    return false;
  }
}
