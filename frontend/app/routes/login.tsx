import { Form, Link, redirect, useNavigation } from "react-router";
import { setToken } from "~/lib/auth";
import { API_BASE_URL } from "~/utils/constants";
import { isNetworkError } from "~/utils/error";
import type { Route } from "./+types/login";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 400) {
        return { error: "メールアドレスまたはパスワードが正しくありません" };
      }
      if (res.status === 500 || res.status === 502 || res.status === 503) {
        return { error: "サーバーエラーが発生しました。時間をおいて再度お試しください" };
      }
      return { error: "ログインに失敗しました。もう一度お試しください" };
    }

    const { access_token, refresh_token } = await res.json();
    setToken(access_token, refresh_token);

    return redirect("/home");
  } catch (err) {
    if (isNetworkError(err)) {
      return { error: "ネットワークに接続できません。通信環境をご確認ください" };
    }
    return { error: "予期しないエラーが発生しました" };
  }
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="w-full space-y-6 bg-white/95 rounded-lg p-6 shadow-md">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-text-main">おかえりなさい</h2>
        <p className="text-sm text-text-main/60">
          ログインして冒険を続けよう
        </p>
      </div>

      <Form method="post" className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-text-main"
          >
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="example@email.com"
            autoComplete="email"
            className="w-full rounded-md border border-text-main/20 bg-white px-3 py-2.5 text-sm text-text-main placeholder:text-text-main/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-text-main"
          >
            パスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="パスワード"
            autoComplete="current-password"
            className="w-full rounded-md border border-text-main/20 bg-white px-3 py-2.5 text-sm text-text-main placeholder:text-text-main/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {actionData?.error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {actionData.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-bg-dark transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "ログイン中..." : "ログイン"}
        </button>
      </Form>

      <p className="text-center text-sm text-text-main/60">
        アカウントをお持ちでないですか？{" "}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
