import { test, expect, type Page } from "@playwright/test";

/**
 * E2E テスト — 主要ユーザーフロー
 *
 * 前提条件:
 *   - docker-compose up でバックエンド (port 8000) + DB + Redis が起動済み
 *   - フロントエンドは playwright.config.ts の webServer で自動起動
 *   - バックエンドが development 環境で起動（/api/dev/auth/test-login が有効）
 *
 * テスト対象フロー:
 *   ランディング → ログイン → (dev認証) → オンボーディング → ホーム → 履歴 → プロフィール → ログアウト
 */

const API_BASE_URL = "http://localhost:8000";

const TEST_USER = {
  displayName: `E2Eテスト_${Date.now()}`,
  email: `e2e_${Date.now()}@test.example.com`,
};

// ─── ヘルパー ────────────────────────────────────────

/** 開発用エンドポイントでテストユーザーを作成しトークンを取得 */
async function devTestLogin(email: string, displayName: string) {
  const res = await fetch(`${API_BASE_URL}/api/dev/auth/test-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, display_name: displayName }),
  });
  if (!res.ok) {
    throw new Error(`dev test-login failed: ${res.status}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    is_new_user: boolean;
  }>;
}

/** ブラウザの localStorage にトークンをセットし認証状態にする */
async function injectAuthTokens(
  page: Page,
  accessToken: string,
  refreshToken: string
) {
  await page.evaluate(
    ({ at, rt }) => {
      localStorage.setItem("roamble_token", at);
      localStorage.setItem("roamble_refresh_token", rt);
    },
    { at: accessToken, rt: refreshToken }
  );
}

// ─── テスト ─────────────────────────────────────────

test.describe("主要ユーザーフロー", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    // ベータゲートをスキップ、ツアーモーダルも非表示にする
    await page.addInitScript(() => {
      localStorage.setItem("roamble_beta_unlocked", "1");
      localStorage.setItem("home_tour_seen", "true");
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  // 1. ランディングページ表示
  test("ランディングページが正しく表示される", async () => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Roamble" })).toBeVisible();
    await expect(page.getByText("いつもと違う場所へ、一歩踏み出そう")).toBeVisible();

    // 利用フロー 3 ステップ
    await expect(page.getByText("提案", { exact: true })).toBeVisible();
    await expect(page.getByText("訪問", { exact: true })).toBeVisible();
    await expect(page.getByText("記録", { exact: true })).toBeVisible();

    // CTA ボタン
    await expect(page.getByRole("link", { name: "さっそく始める" })).toBeVisible();

    // 外部リンク
    const notionLink = page.getByRole("link", { name: /Roamble ってなに/ });
    await expect(notionLink).toBeVisible();
    await expect(notionLink).toHaveAttribute("href", "https://hiruge.notion.site/roamble-lp");
  });

  // 2. 「さっそく始める」→ ログイン画面遷移
  test("「さっそく始める」→ ログイン画面へ遷移", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: "さっそく始める" }).click();
    await page.waitForURL("/login");

    await expect(page.getByRole("heading", { name: "Roambleへようこそ" })).toBeVisible();
    await expect(page.getByText("Googleアカウントでログイン / 新規登録")).toBeVisible();
  });

  // 3. devエンドポイント経由で認証 → オンボーディング画面
  test("認証後 → /onboarding へ遷移（新規ユーザー）", async () => {
    const { access_token, refresh_token } = await devTestLogin(
      TEST_USER.email,
      TEST_USER.displayName
    );

    // トークンを localStorage に注入してページ遷移
    await page.goto("/");
    await injectAuthTokens(page, access_token, refresh_token);
    await page.goto("/onboarding");

    await expect(page.getByRole("heading", { name: "興味のあるジャンルを選ぼう" })).toBeVisible({
      timeout: 15_000,
    });
  });

  // 4. オンボーディング完了 → ホーム画面リダイレクト
  test("オンボーディングで3つ以上選択して保存 → /home へリダイレクト", async () => {
    await expect(page.getByRole("heading", { name: "興味のあるジャンルを選ぼう" })).toBeVisible();

    // ジャンルタグを3つ選択
    const tagButtons = page.locator("[aria-pressed]");
    await tagButtons.nth(0).click();
    await tagButtons.nth(1).click();
    await tagButtons.nth(2).click();

    await page.getByRole("button", { name: /選択して始める/ }).click();

    await page.waitForURL("/home", { timeout: 15_000 });
    await expect(page).toHaveURL("/home");
  });

  // 5. ホーム画面の表示確認
  test("ホーム画面が正しく表示される", async () => {
    // ローディングが終わるまで待つ（カード or エラーメッセージが出る）
    await expect(
      page
        .getByText("行ってきた！")
        .or(page.getByText("近くのスポットが見つかりませんでした"))
        .or(page.getByText("スポットの取得に失敗しました"))
    ).toBeVisible({ timeout: 15_000 });

    // ボトムナビゲーションの確認
    await expect(page.getByRole("link", { name: "発見" })).toBeVisible();
    await expect(page.getByRole("link", { name: "履歴" })).toBeVisible();
    await expect(page.getByRole("link", { name: "マイページ" })).toBeVisible();
  });

  // 6. ボトムナビ → 履歴画面遷移
  test("ボトムナビから履歴画面へ遷移", async () => {
    await page.getByRole("link", { name: "履歴" }).click();
    await page.waitForURL("/history");

    await expect(page.getByText("これまでの旅路")).toBeVisible();
    await expect(page.getByRole("button", { name: "すべて" })).toBeVisible();
  });

  // 7. ボトムナビ → プロフィール画面遷移
  test("ボトムナビからプロフィール画面へ遷移", async () => {
    await page.getByRole("link", { name: "マイページ" }).click();
    await page.waitForURL("/profile");

    await expect(page.getByRole("heading", { name: "マイページ" })).toBeVisible();
    // 登録した表示名が表示されること
    await expect(page.getByText(TEST_USER.displayName)).toBeVisible();
    // ログアウトボタン
    await expect(page.getByRole("button", { name: /ログアウト/ })).toBeVisible();
  });

  // 8. ログアウト → ログイン画面リダイレクト
  test("ログアウト → /login へリダイレクト", async () => {
    await page.getByRole("button", { name: /ログアウト/ }).click();

    // 確認モーダル
    await expect(page.getByText("ログアウトしますか？")).toBeVisible();
    await page.getByRole("button", { name: "ログアウトする" }).click();

    // ログイン画面へ遷移
    await page.waitForURL("/login", { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Roambleへようこそ" })).toBeVisible();
  });

  // 9. 再ログイン（devエンドポイント経由）→ /home へリダイレクト
  test("再ログイン → /home へリダイレクト", async () => {
    const { access_token, refresh_token } = await devTestLogin(
      TEST_USER.email,
      TEST_USER.displayName
    );

    await injectAuthTokens(page, access_token, refresh_token);
    await page.goto("/home");

    await page.waitForURL("/home", { timeout: 15_000 });
    await expect(page).toHaveURL("/home");
  });

  // 10. 認証済みでランディングページにアクセス → /home へリダイレクト
  test("認証済みで / にアクセス → /home へリダイレクト", async () => {
    await page.goto("/");
    await page.waitForURL("/home", { timeout: 10_000 });
    await expect(page).toHaveURL("/home");
  });
});

test.describe("未認証ガード", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("roamble_beta_unlocked", "1");
    });
  });

  test("未認証で /home にアクセス → /login へリダイレクト", async ({ page }) => {
    await page.goto("/home");
    await page.waitForURL("/login", { timeout: 10_000 });
    await expect(page).toHaveURL("/login");
  });

  test("未認証で /history にアクセス → /login へリダイレクト", async ({ page }) => {
    await page.goto("/history");
    await page.waitForURL("/login", { timeout: 10_000 });
    await expect(page).toHaveURL("/login");
  });

  test("未認証で /profile にアクセス → /login へリダイレクト", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL("/login", { timeout: 10_000 });
    await expect(page).toHaveURL("/login");
  });
});

test.describe("ログイン画面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("roamble_beta_unlocked", "1");
    });
  });

  test("ログイン画面の要素が正しく表示される", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Roambleへようこそ" })).toBeVisible();
    await expect(page.getByText("Googleアカウントでログイン / 新規登録")).toBeVisible();
  });
});
