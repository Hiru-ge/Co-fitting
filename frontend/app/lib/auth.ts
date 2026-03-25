import { apiCall } from "~/api/client";
import { API_BASE_URL } from "~/utils/constants";
import type { User } from "~/types/auth";
import {
  getToken as getStoredToken,
  setToken as setStoredToken,
  clearToken as clearStoredToken,
  getRefreshToken,
} from "~/lib/token-storage";
export { refreshToken, tryRefreshToken } from "~/lib/token-refresh";

export {
  getStoredToken as getToken,
  setStoredToken as setToken,
  clearStoredToken as clearToken,
};

export async function logout(): Promise<void> {
  const token = getStoredToken();
  const refresh = getRefreshToken();

  if (token) {
    try {
      // リクエストボディにリフレッシュトークンを含める（セキュリティ向上のため）
      const requestBody: { refresh_token?: string } = {};
      if (refresh) {
        requestBody.refresh_token = refresh;
      }

      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch {
      // API失敗してもローカルトークンは必ず削除する
    }
  }
  clearStoredToken();
}

export async function getUser(token: string): Promise<User> {
  return apiCall("/api/users/me", token);
}

export async function googleOAuth(idToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  is_new_user: boolean;
}> {
  const res = await fetch(`${API_BASE_URL}/api/auth/oauth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) {
    if (res.status === 500 || res.status === 502 || res.status === 503) {
      throw new Error("server_error");
    }
    throw new Error("oauth_failed");
  }

  return res.json();
}
