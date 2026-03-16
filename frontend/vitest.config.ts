/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // vite-plugin-pwa の virtual モジュールはテスト環境に存在しないためスタブ化
      "virtual:pwa-register": "/vitest.pwa-stub.ts",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    passWithNoTests: true,
    exclude: ["e2e/**", "node_modules/**"],
  },
});
