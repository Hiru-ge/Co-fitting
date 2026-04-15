import "./app.css";

import { useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  redirect,
  useLocation,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "~/components/Toast";
import { isBetaUnlocked } from "~/lib/beta-access";
import { GA4_ID, sendPageView } from "~/lib/gtag";

const BETA_EXCLUDED_PATHS = ["/beta-gate", "/lp", "/privacy"] as const;
const queryClient = new QueryClient();

/** パスに応じてベータ版合言葉を要求する */
export async function clientLoader({ request }: { request: Request }) {
  const { pathname } = new URL(request.url);
  if (
    !BETA_EXCLUDED_PATHS.includes(
      pathname as (typeof BETA_EXCLUDED_PATHS)[number],
    ) &&
    !isBetaUnlocked()
  ) {
    throw redirect("/beta-gate");
  }
  return null;
}

/** clientLoader 実行中（API 待機中）に表示するスプラッシュ画面 */
export function HydrateFallback() {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Roamble</title>
        <meta name="theme-color" content="#525BBB" />
        <Links />
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:#102222;display:flex;align-items:center;justify-content:center;height:100dvh}
          .splash{display:flex;flex-direction:column;align-items:center;gap:24px}
          .splash-logo{width:80px;height:80px;border-radius:18px}
          .splash-spinner{width:28px;height:28px;border:3px solid rgba(82,91,187,.3);border-top-color:#525BBB;border-radius:50%;animation:spin .8s linear infinite}
          @keyframes spin{to{transform:rotate(360deg)}}
        `}</style>
      </head>
      <body>
        <div className="splash">
          <img
            className="splash-logo"
            src="/icons/icon-192x192.png"
            alt="Roamble"
          />
          <div className="splash-spinner" />
        </div>
        <Scripts />
      </body>
    </html>
  );
}

function GA4Initializer() {
  useEffect(() => {
    if (!GA4_ID) return;
    // ReactのJSXインラインスクリプトは実行されないためuseEffectで初期化する
    window.dataLayer = window.dataLayer || [];
    // GA4はargumentsオブジェクトをdataLayerにpushする必要がある
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    } as typeof window.gtag;
    window.gtag("js", new Date());
    window.gtag("config", GA4_ID);
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(script);
  }, []);
  return null;
}

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    sendPageView(location.pathname);
  }, [location.pathname]);
  return null;
}

function PWARegister() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/lp") return;

    let cancelled = false;

    void import("virtual:pwa-register").then(({ registerSW }) => {
      if (!cancelled) registerSW({ immediate: true });
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return null;
}

export default function Root() {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Roamble：「いつも同じ店」を抜け出す、新しいお店開拓アプリ</title>
        <meta
          name="description"
          content="「また同じ店になってしまった」を卒業したい人へ。現在地周辺の知らなかったお店をランダム提案し、訪問するたびにXP・レベルアップ・バッジを獲得できるお店開拓アプリ"
        />
        {/* beforeinstallprompt を早期キャプチャ */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__installPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e;});`,
          }}
        />
        {/* PWA */}
        <meta name="theme-color" content="#525BBB" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Roamble" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <PWARegister />
            <GA4Initializer />
            <PageViewTracker />
            <Outlet />
          </ToastProvider>
        </QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
