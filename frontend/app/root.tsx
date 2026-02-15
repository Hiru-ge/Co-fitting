import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { ToastProvider } from "~/components/toast";

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
        <ToastProvider>
          <Outlet />
        </ToastProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
