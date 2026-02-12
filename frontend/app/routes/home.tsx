import type { Route } from "./+types/home";
import { redirect, Link } from "react-router";
import { getToken, getUser } from "~/lib/auth";

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const user = await getUser(token);
  return { user, token };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div>
      <p>ようこそ、{user.display_name}さん</p>
      <p>ここはホーム画面です</p>
      <Link to="/history">履歴</Link>
    </div>
  );
}
