import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** SPAモードでクローラーが読む静的OGPタグをindex.htmlに注入する */
const injectOgpPlugin = {
  name: "inject-ogp",
  closeBundle() {
    const indexPath = resolve(__dirname, "build/client/index.html");
    let html: string;
    try {
      html = readFileSync(indexPath, "utf-8");
    } catch {
      return; // dev mode など build/client が存在しない場合はスキップ
    }
    const metaTags = [
      '<meta name="description" content="「また同じ店になってしまった」を卒業したい人へ。現在地周辺の未訪問スポットをランダム提案し、訪問するたびにXP・レベルアップ・バッジを獲得できるお店開拓アプリ。">',
      '<meta property="og:title" content="Roamble：「いつも同じ店」を抜け出す、新しいお店開拓アプリ">',
      '<meta property="og:description" content="「また同じ店になってしまった」を卒業したい人へ。現在地周辺の未訪問スポットをランダム提案し、訪問するたびにXP・レベルアップ・バッジを獲得できるお店開拓アプリ。">',
      '<meta property="og:type" content="website">',
      '<meta property="og:url" content="https://roamble.app/lp">',
      '<meta property="og:image" content="https://roamble.app/ogp.png">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta property="og:site_name" content="Roamble">',
      '<meta property="og:locale" content="ja_JP">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:site" content="@roamble_app">',
      '<meta name="twitter:title" content="Roamble：「いつも同じ店」を抜け出す、新しいお店開拓アプリ">',
      '<meta name="twitter:description" content="「また同じ店になってしまった」を卒業したい人へ。現在地周辺の未訪問スポットをランダム提案し、訪問するたびにXP・レベルアップ・バッジを獲得できるお店開拓アプリ。">',
      '<meta name="twitter:image" content="https://roamble.app/ogp.png">',
    ].join("\n    ");
    const patched = html
      .replace('lang="en"', 'lang="ja"')
      .replace(
        "<title>Loading...</title>",
        "<title>Roamble：「いつも同じ店」を抜け出す、新しいお店開拓アプリ</title>",
      )
      .replace("</head>", `    ${metaTags}\n  </head>`);
    writeFileSync(indexPath, patched, "utf-8");
  },
};

export default defineConfig({
  plugins: [
    injectOgpPlugin,
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "Roamble",
        short_name: "Roamble",
        description: "「いつも同じ店」を抜け出す、新しいお店開拓アプリ",
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
      injectManifest: {
        // フォントを除外: JS/CSS/HTML/アイコンのみプリキャッシュ（フォントは_headersのimmutableキャッシュを使用）
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
});
