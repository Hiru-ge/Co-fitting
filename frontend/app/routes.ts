import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),

  // ランディング・認証
  route("lp", "routes/lp.tsx"),
  route("login", "routes/login.tsx"),

  // ベータ版ゲート・PWAインストール促進
  route("beta-gate", "routes/beta-gate.tsx"),
  route("pwa-prompt", "routes/pwa-prompt.tsx"),

  // 興味タグ選択（ボトムナビなし）
  route("onboarding", "routes/interest-setup.tsx"),

  // アプリレイアウト（認証必須）
  layout("layouts/app-layout.tsx", [
    route("home", "routes/home.tsx"),
    route("history", "routes/history.tsx"),
    route("history/:id", "routes/history-detail.tsx"),
    route("profile", "routes/profile.tsx"),
    route("settings", "routes/settings.tsx"),
    route("summary/weekly", "routes/summary.weekly.tsx"),
    route("summary/monthly", "routes/summary.monthly.tsx"),
  ]),

  // 公開ページ（認証不要）
  route("privacy", "routes/privacy.tsx"),
] satisfies RouteConfig;
