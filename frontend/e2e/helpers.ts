import { expect, type Page, type BrowserContext } from "@playwright/test";

const API_BASE_URL = "http://localhost:8000";

export interface DevLoginResult {
  access_token: string;
  refresh_token: string;
  is_new_user: boolean;
}

export interface MockSuggestionPlace {
  place_id: string;
  name: string;
  vicinity: string;
  lat: number;
  lng: number;
  rating: number;
  types: string[];
  is_interest_match?: boolean;
  is_breakout?: boolean;
  photo_reference?: string;
}

export function buildTestUser(prefix: string) {
  const stamp = Date.now();
  return {
    email: `${prefix}_${stamp}@test.example.com`,
    displayName: `${prefix}_${stamp}`,
  };
}

export async function devTestLogin(
  email: string,
  displayName: string,
): Promise<DevLoginResult> {
  const res = await fetch(`${API_BASE_URL}/api/dev/auth/test-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, display_name: displayName }),
  });

  if (!res.ok) {
    throw new Error(`dev test-login failed: ${res.status}`);
  }

  return (await res.json()) as DevLoginResult;
}

export async function setAuthTokens(
  page: Page,
  accessToken: string,
  refreshToken: string,
) {
  await page.addInitScript(
    ({ at, rt }) => {
      localStorage.setItem("roamble_token", at);
      localStorage.setItem("roamble_refresh_token", rt);
      localStorage.setItem("roamble_beta_unlocked", "1");
      localStorage.setItem("home_tour_seen", "true");
      localStorage.setItem("pwa-install-dismissed", "true");
    },
    { at: accessToken, rt: refreshToken },
  );
}

export async function ensureOnboardingCompleted(
  accessToken: string,
): Promise<void> {
  const genresRes = await fetch(`${API_BASE_URL}/api/genres`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!genresRes.ok) {
    throw new Error(`get genres failed: ${genresRes.status}`);
  }

  const genres = (await genresRes.json()) as Array<{ id: number }>;
  const genreTagIds = genres.slice(0, 3).map((g) => g.id);

  const updateRes = await fetch(`${API_BASE_URL}/api/users/me/interests`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ genre_tag_ids: genreTagIds }),
  });

  if (!updateRes.ok) {
    throw new Error(`update interests failed: ${updateRes.status}`);
  }
}

export async function openHomeReady(page: Page) {
  await page.goto("/home");
  await expect(page).toHaveURL("/home");
}

export async function grantGeolocation(
  context: BrowserContext,
  lat: number,
  lng: number,
) {
  await context.grantPermissions(["geolocation"], {
    origin: "http://localhost:5173",
  });
  await context.setGeolocation({ latitude: lat, longitude: lng });
}

export async function mockSuggestionsEndpoint(
  page: Page,
  responses: Array<{
    status?: number;
    body: Record<string, unknown>;
  }>,
) {
  let idx = 0;
  await page.route("**/api/suggestions", async (route) => {
    const current = responses[Math.min(idx, responses.length - 1)];
    idx += 1;
    await route.fulfill({
      status: current.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(current.body),
    });
  });
}

export function samplePlaces(prefix: string): MockSuggestionPlace[] {
  return [
    {
      place_id: `${prefix}_1`,
      name: `${prefix} カフェ`,
      vicinity: "渋谷区1-1",
      lat: 35.658,
      lng: 139.701,
      rating: 4.2,
      types: ["cafe"],
      is_interest_match: true,
      is_breakout: false,
    },
    {
      place_id: `${prefix}_2`,
      name: `${prefix} 公園`,
      vicinity: "渋谷区2-2",
      lat: 35.659,
      lng: 139.702,
      rating: 4.1,
      types: ["park"],
      is_interest_match: false,
      is_breakout: true,
    },
    {
      place_id: `${prefix}_3`,
      name: `${prefix} レストラン`,
      vicinity: "渋谷区3-3",
      lat: 35.66,
      lng: 139.703,
      rating: 4.0,
      types: ["restaurant"],
      is_interest_match: true,
      is_breakout: false,
    },
  ];
}
