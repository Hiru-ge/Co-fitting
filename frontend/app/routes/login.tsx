import { Form, redirect } from "react-router";
import { setToken } from "~/lib/auth";
import type { Route } from "./+types/login";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const res = await fetch("http://localhost:8000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return { error: "メールアドレスまたはパスワードが正しくありません" };
    }

    const { access_token, refresh_token } = await res.json();
    setToken(access_token, refresh_token);

    return redirect("/home");
  } catch {
    return { error: "ネットワークエラーが発生しました" };
  }
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <Form method="post">
      <label htmlFor="email">メールアドレス</label>
      <input name="email" type="email" required />
      <label htmlFor="password">パスワード</label>
      <input name="password" type="password" required />
      <button type="submit">ログイン</button>
      {actionData?.error && <p className="error">{actionData.error}</p>}
    </Form>
  );
}
