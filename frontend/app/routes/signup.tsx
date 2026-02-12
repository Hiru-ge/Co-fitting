import { Form, redirect } from "react-router";
import { setToken } from "~/lib/auth";
import type { Route } from "./+types/signup";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const display_name = formData.get("display_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const res = await fetch("http://localhost:8000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name, email, password }),
    });

    if (!res.ok) {
      return { error: "サインアップに失敗しました。メールアドレスが既に使用されている可能性があります。" };
    }

    const { access_token, refresh_token } = await res.json();
    setToken(access_token, refresh_token);

    return redirect("/home");
  } catch {
    return { error: "ネットワークエラーが発生しました" };
  }
}

export default function Signup({ actionData }: Route.ComponentProps) {
  return (
    <Form method="post">
      <label htmlFor="display_name">ユーザー名</label>
      <input name="display_name" type="text" required />
      <label htmlFor="email">メールアドレス</label>
      <input name="email" type="email" required />
      <label htmlFor="password">パスワード</label>
      <input name="password" type="password" required />
      <button type="submit">サインアップ</button>
      {actionData?.error && <p className="error">{actionData.error}</p>}
    </Form>
  );
}
