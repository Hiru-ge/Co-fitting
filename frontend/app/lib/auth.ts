import { redirect } from "react-router";
import { API_BASE_URL } from "~/utils/constants";
import {
  getToken as getStoredToken,
  clearToken as clearStoredToken,
  getRefreshToken,
} from "~/lib/token-storage";
import { getUser as getUserFromApi } from "~/api/users";

export { refreshToken, tryRefreshToken } from "~/lib/token-refresh";
export { getToken, setToken, clearToken } from "~/lib/token-storage";
export { getUser } from "~/api/users";

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

export async function logout(): Promise<void> {
  const token = getStoredToken();
  const refresh = getRefreshToken();

  if (token) {
    try {
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

export async function protectedLoader() {
  const token = getStoredToken();
  if (!token) {
    throw redirect("/login");
  }
  try {
    const user = await getUserFromApi(token);
    return { user, token };
  } catch {
    throw redirect("/login");
  }
}
