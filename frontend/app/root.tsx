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
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastProvider } from "~/components/toast";
import { isBetaUnlocked } from "~/lib/beta-access";
import { GA4_ID, sendPageView } from "~/lib/gtag";

/** /beta-gate 以外の全ルートでベータ版合言葉を確認する */
export async function clientLoader({ request }: { request: Request }) {
  const { pathname } = new URL(request.url);
  if (pathname !== "/beta-gate" && !isBetaUnlocked()) {
    throw redirect("/beta-gate");
  }
  return null;
}

// ── Local font imports (@fontsource) ──
import "@fontsource/plus-jakarta-sans";
import "@fontsource/space-grotesk";
import "@fontsource/noto-sans-jp";
import "@fontsource/material-symbols-outlined";

import "./app.css";

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    sendPageView(location.pathname);
  }, [location.pathname]);
  return null;
}

export default function Root() {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* PWA */}
        <meta name="theme-color" content="#525BBB" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Roamble" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        {GA4_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}');`,
              }}
            />
          </>
        )}
        <Meta />
        <Links />
      </head>
      <body>
        <GoogleOAuthProvider
          clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""}
        >
          <ToastProvider>
            <PageViewTracker />
            <Outlet />
          </ToastProvider>
        </GoogleOAuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
