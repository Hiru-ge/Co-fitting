import { Outlet } from "react-router";

export default function Root() {
  return (
    <html lang="ja">
      <body>
        <Outlet />
      </body>
    </html>
  );
}
