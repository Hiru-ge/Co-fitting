import type { Route } from "./+types/history";
import { redirect, Link } from "react-router";
import { getToken, getUser } from "~/lib/auth";

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const user = await getUser(token);
  return { user, token };
}

export default function History({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div>
      <p>ようこそ、{user.display_name}さん</p>
      <p>ここは訪問履歴画面です</p>
      <Link to="/home">ホーム</Link>
    </div>
  );
}
