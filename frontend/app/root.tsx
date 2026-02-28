import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  redirect,
} from "react-router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastProvider } from "~/components/toast";
import { isBetaUnlocked } from "~/lib/beta-access";

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

export default function Root() {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta />
        <Links />
      </head>
      <body>
        <GoogleOAuthProvider
          clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""}
        >
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </GoogleOAuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
