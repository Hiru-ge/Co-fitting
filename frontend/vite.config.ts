import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Roamble",
        short_name: "Roamble",
        description: "コンフォートゾーンを抜け出して、新しい場所へ。",
        theme_color: "#525BBB",
        background_color: "#102222",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "ja",
        icons: [
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // ナビゲーション（SPAルーティング）は常にindex.htmlにフォールバック
        navigateFallback: "index.html",
        // キャッシュするアセットのパターン
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // 外部APIへのリクエストはキャッシュしない
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
