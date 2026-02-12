import { apiCall } from "~/api/client";
import { API_BASE_URL } from "~/utils/constants";
import type { User } from "~/types/auth";

const TOKEN_KEY = "roamble_token";
const REFRESH_TOKEN_KEY = "roamble_refresh_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // API失敗してもローカルトークンは必ず削除する
    }
  }
  clearToken();
}

export async function refreshToken(): Promise<void> {
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);

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

export async function getUser(token: string): Promise<User> {
  return apiCall("/api/users/me", token);
}
