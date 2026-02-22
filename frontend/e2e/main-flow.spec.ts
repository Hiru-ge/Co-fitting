import { test, expect, type Page } from "@playwright/test";

/**
 * E2E テスト — 主要ユーザーフロー
 *
 * 前提条件:
 *   - docker-compose up でバックエンド (port 8000) + DB + Redis が起動済み
 *   - フロントエンドは playwright.config.ts の webServer で自動起動
 *
 * テスト対象フロー:
 *   ランディング → サインアップ → ホーム → 履歴 → プロフィール → ログアウト → ログイン
 */

const TEST_USER = {
  displayName: `E2Eテスト_${Date.now()}`,
  email: `e2e_${Date.now()}@test.example.com`,
  password: "TestPass1234!",
};

// ─── ヘルパー ────────────────────────────────────────

/** ランディングページが正常表示されるか確認 */
async function expectLandingPage(page: Page) {
  await expect(page.getByRole("heading", { name: "Roamble" })).toBeVisible();
  await expect(page.getByText("いつもと違う場所へ、一歩踏み出そう")).toBeVisible();
}

// ─── テスト ─────────────────────────────────────────

test.describe("主要ユーザーフロー", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // 1. ランディングページ表示
  test("ランディングページが正しく表示される", async () => {
    await page.goto("/");
    await expectLandingPage(page);

    // 利用フロー 3 ステップ
    await expect(page.getByText("提案", { exact: true })).toBeVisible();
    await expect(page.getByText("訪問", { exact: true })).toBeVisible();
    await expect(page.getByText("記録", { exact: true })).toBeVisible();

    // CTA ボタン
    await expect(page.getByRole("link", { name: "さっそく始める" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();

    // 外部リンク
    const notionLink = page.getByRole("link", { name: /Roamble ってなに/ });
    await expect(notionLink).toBeVisible();
    await expect(notionLink).toHaveAttribute("href", "https://hiruge.notion.site/roamble-lp");
  });

  // 2. ランディング → サインアップ画面遷移
  test("「さっそく始める」→ サインアップ画面へ遷移", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: "さっそく始める" }).click();
    await page.waitForURL("/signup");

    await expect(page.getByRole("heading", { name: "アカウント作成" })).toBeVisible();
    await expect(page.getByLabel("表示名")).toBeVisible();
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
    await expect(page.getByLabel("パスワード")).toBeVisible();
  });

  // 3. サインアップ実行 → オンボーディング画面リダイレクト
  test("サインアップ → /onboarding へリダイレクト", async () => {
    await page.goto("/signup");
    await page.getByLabel("表示名").fill(TEST_USER.displayName);
    await page.getByLabel("メールアドレス").fill(TEST_USER.email);
    await page.getByLabel("パスワード").fill(TEST_USER.password);
    await page.getByRole("button", { name: "サインアップ" }).click();

    await page.waitForURL("/onboarding", { timeout: 15_000 });
    await expect(page).toHaveURL("/onboarding");
  });

  // 3.5. オンボーディング完了 → ホーム画面リダイレクト
  test("オンボーディングで3つ以上選択して保存 → /home へリダイレクト", async () => {
    await expect(page.getByRole("heading", { name: "興味のあるジャンルを選ぼう" })).toBeVisible();

    // ジャンルタグを3つ選択（aria-pressed があるボタンがタグボタン）
    const tagButtons = page.locator('[aria-pressed]');
    await tagButtons.nth(0).click();
    await tagButtons.nth(1).click();
    await tagButtons.nth(2).click();

    await page.getByRole("button", { name: /選択して始める/ }).click();

    await page.waitForURL("/home", { timeout: 15_000 });
    await expect(page).toHaveURL("/home");
  });

  // 4. ホーム画面の表示確認
  test("ホーム画面が正しく表示される", async () => {
    // ローディングが終わるまで待つ（カード or エラーメッセージが出る）
    await expect(
      page.getByText("行ってきた！").or(page.getByText("近くのスポットが見つかりませんでした")).or(page.getByText("スポットの取得に失敗しました")).or(page.getByText("再試行"))
    ).toBeVisible({ timeout: 15_000 });

    // ボトムナビゲーションの確認
    await expect(page.getByRole("link", { name: "発見" })).toBeVisible();
    await expect(page.getByRole("link", { name: "履歴" })).toBeVisible();
    await expect(page.getByRole("link", { name: "マイページ" })).toBeVisible();
  });

  // 5. ボトムナビ → 履歴画面遷移
  test("ボトムナビから履歴画面へ遷移", async () => {
    await page.getByRole("link", { name: "履歴" }).click();
    await page.waitForURL("/history");

    await expect(page.getByText("これまでの旅路")).toBeVisible();
    // フィルター「すべて」ボタンが表示されること
    await expect(page.getByRole("button", { name: "すべて" })).toBeVisible();
  });

  // 6. ボトムナビ → プロフィール画面遷移
  test("ボトムナビからプロフィール画面へ遷移", async () => {
    await page.getByRole("link", { name: "マイページ" }).click();
    await page.waitForURL("/profile");

    await expect(page.getByRole("heading", { name: "マイページ" })).toBeVisible();
    // 登録した表示名が表示されること
    await expect(page.getByText(TEST_USER.displayName)).toBeVisible();
    // ログアウトボタン
    await expect(page.getByRole("button", { name: /ログアウト/ })).toBeVisible();
  });

  // 7. ログアウト → ログイン画面リダイレクト
  test("ログアウト → /login へリダイレクト", async () => {
    // ログアウトボタンを押す
    await page.getByRole("button", { name: /ログアウト/ }).click();

    // 確認モーダル
    await expect(page.getByText("ログアウトしますか？")).toBeVisible();
    await page.getByRole("button", { name: "ログアウトする" }).click();

    // ログイン画面へ遷移
    await page.waitForURL("/login", { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "おかえりなさい" })).toBeVisible();
  });

  // 8. ログイン → ホーム画面リダイレクト
  test("ログイン → /home へリダイレクト", async () => {
    await page.getByLabel("メールアドレス").fill(TEST_USER.email);
    await page.getByLabel("パスワード").fill(TEST_USER.password);
    await page.getByRole("button", { name: "ログイン", exact: true }).click();

    await page.waitForURL("/home", { timeout: 15_000 });
    await expect(page).toHaveURL("/home");
  });

  // 9. 認証済みでランディングページにアクセス → /home へリダイレクト
  test("認証済みで / にアクセス → /home へリダイレクト", async () => {
    await page.goto("/");
    await page.waitForURL("/home", { timeout: 10_000 });
    await expect(page).toHaveURL("/home");
  });
});

test.describe("未認証ガード", () => {
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

test.describe("認証画面ナビゲーション", () => {
  test("サインアップ画面 → ログイン画面への相互遷移", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "アカウント作成" })).toBeVisible();

    // 「ログイン」リンクでログイン画面へ
    await page.getByRole("link", { name: "ログイン" }).click();
    await page.waitForURL("/login");
    await expect(page.getByRole("heading", { name: "おかえりなさい" })).toBeVisible();

    // 「新規登録」リンクでサインアップ画面へ
    await page.getByRole("link", { name: "新規登録" }).click();
    await page.waitForURL("/signup");
    await expect(page.getByRole("heading", { name: "アカウント作成" })).toBeVisible();
  });

  test("バリデーションエラーが表示される — サインアップ", async ({ page }) => {
    await page.goto("/signup");

    // HTML5 ネイティブバリデーションを無効化してカスタムバリデーションをテスト
    await page.waitForSelector("form");
    await page.evaluate(() => {
      const form = document.querySelector("form");
      if (form) form.setAttribute("novalidate", "");
    });

    await page.getByLabel("表示名").fill("テスト");
    await page.getByLabel("メールアドレス").fill("invalid-email");
    await page.getByLabel("パスワード").fill("short");
    await page.getByRole("button", { name: "サインアップ" }).click();

    // カスタムバリデーションエラーメッセージが表示される
    await expect(
      page.getByText("有効なメールアドレスを入力してください").or(
        page.getByText("パスワードは8文字以上")
      )
    ).toBeVisible({ timeout: 5_000 });
  });
});
