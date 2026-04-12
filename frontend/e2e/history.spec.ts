import { test, expect } from "@playwright/test";
import {
  buildTestUser,
  devTestLogin,
  ensureOnboardingCompleted,
  grantGeolocation,
  setAuthTokens,
} from "./helpers";

const API_BASE_URL = "http://localhost:8000";

async function createVisitRecord(accessToken: string, placeName: string) {
  const res = await fetch(`${API_BASE_URL}/api/visits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      place_id: `e2e-place-${Date.now()}`,
      place_name: placeName,
      vicinity: "渋谷区テスト",
      category: "カフェ",
      lat: 35.658,
      lng: 139.701,
      visited_at: new Date().toISOString(),
      user_lat: 35.658,
      user_lng: 139.701,
      place_types: ["cafe"],
    }),
  });

  if (!res.ok) {
    throw new Error(`create visit failed: ${res.status}`);
  }
}

test.describe("履歴フロー", () => {
  test("チェックイン後に履歴画面でレコード表示", async ({ page, context }) => {
    const user = buildTestUser("e2e_history_list");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await createVisitRecord(login.access_token, "E2E履歴カフェ");

    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    await page.goto("/history");
    await expect(page).toHaveURL("/history");
    await expect(page.getByText("E2E履歴カフェ")).toBeVisible({
      timeout: 15000,
    });
  });

  test("履歴詳細でメモとレーティングを保存して反映", async ({
    page,
    context,
  }) => {
    const user = buildTestUser("e2e_history_detail");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await createVisitRecord(login.access_token, "E2E詳細カフェ");

    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    await page.goto("/history");
    await expect(page.getByText("E2E詳細カフェ")).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("link", { name: /E2E詳細カフェ/ }).click();
    await expect(page).toHaveURL(/\/history\/[0-9]+/);

    const memo = page.getByPlaceholder("どんな体験でしたか？");
    await memo.fill("E2Eで更新したメモ");
    await page.getByRole("button", { name: "★4" }).click();
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("保存しました")).toBeVisible({
      timeout: 15000,
    });
    await expect(memo).toHaveValue("E2Eで更新したメモ");
  });
});
