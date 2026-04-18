import type { Config } from "@react-router/dev/config";

export default {
  ssr: false, // SPAモードで動かすため、サーバーサイドレンダリングは無効化
  prerender: ["/lp", "/lp/en"],
} satisfies Config;
