import { test, expect } from "@playwright/test";
import {
  buildTestUser,
  devTestLogin,
  ensureOnboardingCompleted,
  grantGeolocation,
  mockSuggestionsEndpoint,
  openHomeReady,
  samplePlaces,
  setAuthTokens,
} from "./helpers";

function mockCreateVisitSequence(
  page: import("@playwright/test").Page,
  responses: unknown[],
) {
  let index = 0;
  return page.route("**/api/visits", async (route) => {
    const body = responses[Math.min(index, responses.length - 1)];
    index += 1;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test.describe("チェックインフロー", () => {
  test("チェックインでXPモーダル表示（獲得XP・内訳）", async ({
    page,
    context,
  }) => {
    const user = buildTestUser("e2e_checkin_xp");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    const places = samplePlaces("XP");
    await mockSuggestionsEndpoint(page, [
      {
        body: {
          places,
          reload_count_remaining: 3,
        },
      },
    ]);

    await mockCreateVisitSequence(page, [
      {
        id: 1,
        xp_earned: 80,
        total_xp: 180,
        is_level_up: false,
        new_level: 2,
        new_badges: [],
        is_daily_completed: false,
        xp_breakdown: {
          base_xp: 50,
          first_area_bonus: 30,
          streak_bonus: 0,
        },
      },
    ]);

    await openHomeReady(page);
    await expect(page.getByText("XP カフェ")).toBeVisible();

    await page.getByRole("button", { name: /行ってきた！/ }).click();

    await expect(page.getByRole("dialog", { name: "XP獲得" })).toBeVisible();
    await expect(page.getByText("+80 XP")).toBeVisible();
    await expect(page.getByTestId("xp-breakdown")).toContainText(
      "初エリアボーナス",
    );
  });

  test("レベルアップ時にLevel Up表示", async ({ page, context }) => {
    const user = buildTestUser("e2e_checkin_levelup");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    await mockSuggestionsEndpoint(page, [
      {
        body: {
          places: samplePlaces("Level"),
          reload_count_remaining: 3,
        },
      },
    ]);

    await mockCreateVisitSequence(page, [
      {
        id: 1,
        xp_earned: 100,
        total_xp: 500,
        is_level_up: true,
        new_level: 5,
        new_badges: [],
        is_daily_completed: false,
        xp_breakdown: {
          base_xp: 100,
          first_area_bonus: 0,
          streak_bonus: 0,
        },
      },
    ]);

    await openHomeReady(page);
    await page.getByRole("button", { name: /行ってきた！/ }).click();

    await expect(page.getByText("Level Up!")).toBeVisible();
    await expect(page.getByText("レベル5に上がりました！")).toBeVisible();
  });

  test("バッジ獲得時にバッジモーダル表示", async ({ page, context }) => {
    const user = buildTestUser("e2e_checkin_badge");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    await mockSuggestionsEndpoint(page, [
      {
        body: {
          places: samplePlaces("Badge"),
          reload_count_remaining: 3,
        },
      },
    ]);

    await mockCreateVisitSequence(page, [
      {
        id: 1,
        xp_earned: 50,
        total_xp: 150,
        is_level_up: false,
        new_level: 2,
        new_badges: [
          {
            id: 1,
            name: "最初の一歩",
            description: "初めての訪問を記録した",
            icon_url: "",
          },
        ],
        is_daily_completed: false,
        xp_breakdown: {
          base_xp: 50,
          first_area_bonus: 0,
          streak_bonus: 0,
        },
      },
    ]);

    await openHomeReady(page);
    await page.getByRole("button", { name: /行ってきた！/ }).click();

    await expect(page.getByRole("dialog", { name: "XP獲得" })).toBeVisible();
    await page.getByRole("button", { name: "次の冒険へ" }).click();

    await expect(
      page.getByRole("dialog", { name: "バッジ獲得" }),
    ).toBeVisible();
    await expect(page.getByText("最初の一歩")).toBeVisible();
  });

  test("3件チェックインでComplete Card表示", async ({ page, context }) => {
    const user = buildTestUser("e2e_checkin_complete");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    await mockSuggestionsEndpoint(page, [
      {
        body: {
          places: samplePlaces("Complete"),
          reload_count_remaining: 3,
        },
      },
    ]);

    await mockCreateVisitSequence(page, [
      {
        id: 1,
        xp_earned: 50,
        total_xp: 150,
        is_level_up: false,
        new_level: 2,
        new_badges: [],
        is_daily_completed: false,
        xp_breakdown: { base_xp: 50, first_area_bonus: 0, streak_bonus: 0 },
      },
      {
        id: 2,
        xp_earned: 50,
        total_xp: 200,
        is_level_up: false,
        new_level: 2,
        new_badges: [],
        is_daily_completed: false,
        xp_breakdown: { base_xp: 50, first_area_bonus: 0, streak_bonus: 0 },
      },
      {
        id: 3,
        xp_earned: 50,
        total_xp: 250,
        is_level_up: false,
        new_level: 3,
        new_badges: [],
        is_daily_completed: true,
        xp_breakdown: { base_xp: 50, first_area_bonus: 0, streak_bonus: 0 },
      },
    ]);

    await openHomeReady(page);

    for (let i = 0; i < 3; i += 1) {
      await page
        .getByRole("button", { name: /行ってきた！|記録済み|記録中/ })
        .first()
        .click();
      await expect(page.getByRole("dialog", { name: "XP獲得" })).toBeVisible();
      await page.getByRole("button", { name: "次の冒険へ" }).click();
    }

    await expect(page.getByText("今日の3件コンプリート！")).toBeVisible({
      timeout: 15000,
    });
  });
});
