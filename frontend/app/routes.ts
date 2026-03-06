import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),

  // 認証レイアウト
  layout("layouts/auth-layout.tsx", [
    route("login", "routes/login.tsx"),
  ]),

  // オンボーディング（ボトムナビなし）
  route("onboarding", "routes/onboarding.tsx"),

  // ベータ版ゲート（合言葉入力）
  route("beta-gate", "routes/beta-gate.tsx"),

  // 公開ページ（認証不要）
  route("lp", "routes/lp.tsx"),
  route("privacy", "routes/privacy.tsx"),

  // アプリレイアウト（認証必須）
  layout("layouts/app-layout.tsx", [
    route("home", "routes/home.tsx"),
    route("history", "routes/history.tsx"),
    route("history/:id", "routes/history-detail.tsx"),
    route("profile", "routes/profile.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig;
