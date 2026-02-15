import { API_BASE_URL } from "~/utils/constants";
import { ApiError, parseApiError } from "~/utils/error";

/**
 * 認証付き API 呼び出しヘルパー
 *
 * - レスポンスが ok でない場合、ApiError を throw する
 * - 401 の場合はトークンリフレッシュを試み、成功したらリトライする
 * - リフレッシュも失敗した場合は /login へリダイレクトする
 */
export async function apiCall(
  endpoint: string,
  token: string,
  options: RequestInit = {}
) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.ok) {
    return res.json();
  }

  // 401: トークンリフレッシュを試行
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // リフレッシュ成功 → 新しいトークンでリトライ
      const newToken = localStorage.getItem("roamble_token");
      if (newToken) {
        const retryRes = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newToken}`,
            ...options.headers,
          },
        });

        if (retryRes.ok) {
          return retryRes.json();
        }
      }
    }

    // リフレッシュ失敗 → トークンクリアして /login へリダイレクト
    localStorage.removeItem("roamble_token");
    localStorage.removeItem("roamble_refresh_token");
    window.location.href = "/login";
    throw new ApiError(401, "認証の有効期限が切れました。再ログインしてください");
  }

  // その他のエラー → ApiError を throw
  throw await parseApiError(res);
}

/**
 * リフレッシュトークンでアクセストークンを更新する
 * @returns リフレッシュ成功なら true
 */
async function tryRefreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem("roamble_refresh_token");
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) return false;

    const { access_token, refresh_token } = await res.json();
    localStorage.setItem("roamble_token", access_token);
    if (refresh_token) {
      localStorage.setItem("roamble_refresh_token", refresh_token);
    }
    return true;
  } catch {
    return false;
  }
}