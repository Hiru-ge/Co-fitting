import { useState } from "react";
import { Link, useNavigate, redirect } from "react-router";
import { isBetaUnlocked, unlockBeta } from "~/lib/beta-access";
import { Icon } from "~/components/Icon";

export async function clientLoader() {
  if (isBetaUnlocked()) {
    throw redirect("/");
  }
  return null;
}

export default function BetaGate() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const ok = await unlockBeta(input);
    setLoading(false);

    if (ok) {
      navigate("/", { replace: true });
    } else {
      setError("合言葉が違います。もう一度お試しください");
    }
  }

  return (
    <div className="min-h-dvh bg-bg-dark text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* ヘッダー */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display-alt tracking-tight text-primary">
            Roamble
          </h1>
          <p className="text-sm text-white/60">限定ベータ版</p>
        </div>

        {/* フォーム */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">合言葉を入力</h2>
            <p className="text-sm text-white/60">
              ベータテスターの方は受け取った合言葉を入力してください。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="passphrase" className="sr-only">
                合言葉
              </label>
              <input
                id="passphrase"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="合言葉を入力..."
                autoComplete="off"
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-full py-3 rounded-lg bg-primary text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              {loading ? "確認中..." : "入力する"}
            </button>
          </form>
        </div>

        {/* LPリンク */}
        <div className="max-w-sm mx-auto">
          <Link
            to="/lp"
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 transition-colors hover:bg-white/10"
          >
            <span className="text-sm text-white/70">Roamble ってなに？</span>
            <Icon name="arrow_forward" className="text-white/40 text-lg" />
          </Link>
        </div>

        {/* フッター */}
        <p className="text-center text-xs text-white/30">
          ベータ版への参加は
          <Link
            to="/lp#request-access"
            className="underline hover:text-white/50"
          >
            紹介ページ
          </Link>
          からリクエストを送信してください
        </p>
      </div>
    </div>
  );
}
