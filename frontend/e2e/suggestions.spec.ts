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

test.describe("提案フロー", () => {
  test("位置情報許可で提案カードが表示される", async ({ page, context }) => {
    const user = buildTestUser("e2e_suggest_allow");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    await openHomeReady(page);

    await expect(page.getByText("行ってきた！")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator("h2").first()).toBeVisible();
  });

  test("位置情報拒否時にデフォルト位置フォールバックで提案カード表示", async ({
    page,
  }) => {
    const user = buildTestUser("e2e_suggest_deny");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await setAuthTokens(page, login.access_token, login.refresh_token);

    await page.addInitScript(() => {
      const geolocation = {
        getCurrentPosition: (
          _success: unknown,
          error: (err: { code: number }) => void,
        ) => {
          error({ code: 1 });
        },
      };
      Object.defineProperty(navigator, "geolocation", {
        value: geolocation,
        configurable: true,
      });
    });

    await openHomeReady(page);

    await expect(
      page.getByRole("dialog", { name: "位置情報が利用できません" }),
    ).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: "渋谷駅周辺で試す" }).click();

    await expect(page.getByText("行ってきた！")).toBeVisible({
      timeout: 15000,
    });
  });

  test("リロードボタンで別提案が表示される", async ({ page, context }) => {
    const user = buildTestUser("e2e_suggest_reload");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    const first = samplePlaces("初回提案");
    const second = samplePlaces("再提案");

    await mockSuggestionsEndpoint(page, [
      {
        body: {
          places: first,
          reload_count_remaining: 3,
        },
      },
      {
        body: {
          places: second,
          reload_count_remaining: 2,
        },
      },
    ]);

    await openHomeReady(page);

    await expect(page.getByText("初回提案 カフェ")).toBeVisible();
    await page.getByRole("button", { name: "リロード" }).click();
    await expect(page.getByText("再提案 カフェ")).toBeVisible();
  });

  test("リロード上限到達で上限メッセージが表示される", async ({
    page,
    context,
  }) => {
    const user = buildTestUser("e2e_suggest_reload_limit");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    const first = samplePlaces("上限前");

    await mockSuggestionsEndpoint(page, [
      {
        body: {
          places: first,
          reload_count_remaining: 1,
        },
      },
      {
        status: 429,
        body: {
          code: "RELOAD_LIMIT_REACHED",
          error: "reload limit reached",
        },
      },
    ]);

    await openHomeReady(page);
    await expect(page.getByText("上限前 カフェ")).toBeVisible();

    await page.getByRole("button", { name: "リロード" }).click();
    await expect(
      page.getByText("今日のリロードは使い切りました。明日また使えます"),
    ).toBeVisible();
  });

  test("全お店訪問済みでメッセージ表示", async ({ page, context }) => {
    const user = buildTestUser("e2e_suggest_all_visited");
    const login = await devTestLogin(user.email, user.displayName);
    await ensureOnboardingCompleted(login.access_token);
    await setAuthTokens(page, login.access_token, login.refresh_token);
    await grantGeolocation(context, 35.658, 139.701);

    await mockSuggestionsEndpoint(page, [
      {
        body: {
          places: [],
          is_completed: true,
          notice: "ALL_VISITED_NEARBY",
          reload_count_remaining: 0,
        },
      },
    ]);

    await openHomeReady(page);

    await expect(
      page.getByText(
        "この近くのお店は最近すべて訪問済みです。しばらく時間を置くか、別のエリアを試してみてください",
      ),
    ).toBeVisible({ timeout: 15000 });
  });
});
