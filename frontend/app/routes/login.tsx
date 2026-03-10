import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { GoogleLogin } from "@react-oauth/google";
import { setToken, googleOAuth } from "~/lib/auth";
import { isNetworkError } from "~/utils/error";
import { sendLogin } from "~/lib/gtag";

export default function Login() {
  const navigate = useNavigate();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleGoogleSuccess(credentialResponse: {
    credential?: string;
  }) {
    if (!credentialResponse.credential) {
      setGoogleError("Googleログインに失敗しました。もう一度お試しください");
      return;
    }

    setIsGoogleLoading(true);
    setGoogleError(null);

    try {
      const { access_token, refresh_token, is_new_user } = await googleOAuth(
        credentialResponse.credential
      );
      setToken(access_token, refresh_token);
      sendLogin("google_oauth", is_new_user);
      navigate(is_new_user ? "/onboarding" : "/home");
    } catch (err) {
      if (isNetworkError(err)) {
        setGoogleError("ネットワークに接続できません。通信環境をご確認ください");
      } else if (err instanceof Error && err.message === "server_error") {
        setGoogleError(
          "サーバーエラーが発生しました。時間をおいて再度お試しください"
        );
      } else {
        setGoogleError("Googleログインに失敗しました。もう一度お試しください");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }

  function handleGoogleError() {
    setGoogleError("Googleログインに失敗しました。もう一度お試しください");
  }

  return (
    <div className="w-full space-y-6 bg-white/5 rounded-lg p-6 shadow-md border border-white/10">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Roambleへようこそ</h2>
        <p className="text-sm text-white/60">
          Googleアカウントでログイン / 新規登録
        </p>
      </div>

      <div
        className={`flex justify-center ${isGoogleLoading ? "opacity-50 pointer-events-none" : ""}`}
      >
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          text="signin_with"
          shape="rectangular"
          width="297"
        />
      </div>

      {googleError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
          {googleError}
        </p>
      )}

      <p className="text-center text-xs text-white/40">
        ログインすることで、
        <Link to="/privacy" className="underline hover:text-white/60">
          プライバシーポリシー
        </Link>
        に同意したものとみなされます。
      </p>
    </div>
  );
}
