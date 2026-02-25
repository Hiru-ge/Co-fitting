import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),

  // 認証レイアウト
  layout("layouts/auth-layout.tsx", [
    route("login", "routes/login.tsx"),
  ]),

  // オンボーディング（ボトムナビなし）
  route("onboarding", "routes/onboarding.tsx"),

  // アプリレイアウト（認証必須）
  layout("layouts/app-layout.tsx", [
    route("home", "routes/home.tsx"),
    route("history", "routes/history.tsx"),
    route("history/:id", "routes/history-detail.tsx"),
    route("profile", "routes/profile.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig;
