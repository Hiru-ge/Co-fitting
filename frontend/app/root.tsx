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
