import { Form, Link, redirect, useNavigation } from "react-router";
import { setToken } from "~/lib/auth";
import { API_BASE_URL } from "~/utils/constants";
import type { Route } from "./+types/signup";

function validate(displayName: string, email: string, password: string) {
  if (!displayName || displayName.trim().length === 0) {
    return "表示名を入力してください。";
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "有効なメールアドレスを入力してください。";
  }
  if (!password || password.length < 8) {
    return "パスワードは8文字以上で入力してください。";
  }
  return null;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const display_name = formData.get("display_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const validationError = validate(display_name, email, password);
  if (validationError) {
    return { error: validationError };
  }

  try {    const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name, email, password }),
    });

    if (!res.ok) {
      if (res.status === 409) {
        return { error: "このメールアドレスは既に使用されています。" };
      }
      return { error: "サインアップに失敗しました。もう一度お試しください。" };
    }

    const { access_token, refresh_token } = await res.json();
    setToken(access_token, refresh_token);

    return redirect("/home");
  } catch {
    return { error: "ネットワークエラーが発生しました。時間をおいて再度お試しください。" };
  }
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="w-full space-y-6 bg-white/95 rounded-lg p-6 shadow-md">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-text-main">アカウント作成</h2>
        <p className="text-sm text-text-main/60">
          Roambleで新しい場所を発見しよう
        </p>
      </div>

      <Form method="post" className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="display_name"
            className="block text-sm font-medium text-text-main"
          >
            表示名
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            required
            placeholder="あなたのニックネーム"
            className="w-full rounded-md border border-text-main/20 bg-white px-3 py-2.5 text-sm text-text-main placeholder:text-text-main/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

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
            minLength={8}
            placeholder="8文字以上"
            autoComplete="new-password"
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
          {isSubmitting ? "作成中..." : "サインアップ"}
        </button>
      </Form>

      <p className="text-center text-sm text-text-main/60">
        すでにアカウントをお持ちですか？{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
