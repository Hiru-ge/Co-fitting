import { API_BASE_URL } from "~/utils/constants";
import { ApiError, parseApiError } from "~/utils/error";
import { getToken, clearToken } from "~/lib/token-storage";
import { tryRefreshToken } from "~/lib/token-refresh";

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
      const newToken = getToken();
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
    clearToken();
    window.location.href = "/login";
    throw new ApiError(401, "認証の有効期限が切れました。再ログインしてください");
  }

  // その他のエラー → ApiError を throw
  throw await parseApiError(res);
}

