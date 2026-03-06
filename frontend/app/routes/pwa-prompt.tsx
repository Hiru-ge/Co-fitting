import { useState, useEffect } from "react";
import { redirect, useNavigate } from "react-router";
import {
  isStandalone,
  isPWAPromptDismissed,
  dismissPWAPrompt,
  detectPlatform,
  getInstallPrompt,
  triggerInstallPrompt,
  type Platform,
} from "~/lib/pwa";

export async function clientLoader() {
  if (isStandalone() || isPWAPromptDismissed()) {
    throw redirect("/");
  }
  return null;
}

export default function PWAPrompt() {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<Platform>("other");
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setCanInstall(getInstallPrompt() !== null);

    // beforeinstallprompt がこの後に来る場合に備えてリッスン
    const handler = () => setCanInstall(true);
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    setIsInstalling(true);
    const accepted = await triggerInstallPrompt();
    if (accepted) {
      dismissPWAPrompt();
      navigate("/");
    } else {
      setIsInstalling(false);
    }
  }

  function handleSkip() {
    dismissPWAPrompt();
    navigate("/");
  }

  return (
    <div className="min-h-dvh bg-bg-dark flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* ロゴ */}
        <div className="text-center">
          <p className="text-5xl font-bold font-display-alt text-primary mb-2">
            Roamble
          </p>
          <p className="text-sm text-white/50">コンフォートゾーンを抜け出そう</p>
        </div>

        {/* メインカード */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
          <div className="text-center space-y-1">
            <div className="text-4xl mb-3">📲</div>
            <h1 className="text-lg font-bold text-white">
              アプリとして使おう
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              ホーム画面に追加すると、<br />
              ネイティブアプリのように使えます。
            </p>
          </div>

          {/* 特徴 */}
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              ホーム画面からすぐ起動
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              全画面表示でスッキリ
            </li>
          </ul>

          {/* プラットフォーム別のインストール手順 */}
          {platform === "ios" && (
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                追加手順
              </p>
              <ol className="space-y-2 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  <span>
                    画面下の
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-white/10 rounded text-xs mx-0.5">共有</span>
                    をタップ
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>「ホーム画面に追加」を選択</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                    3
                  </span>
                  <span>右上の「追加」をタップして完了</span>
                </li>
              </ol>
            </div>
          )}

          {/* Android: ネイティブインストールボタン */}
          {platform === "android" && canInstall && (
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full py-3 rounded-xl bg-primary text-bg-dark font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isInstalling ? "インストール中..." : "インストールする"}
            </button>
          )}

          {/* その他 or Android で beforeinstallprompt が来ていない場合 */}
          {(platform === "other" || (platform === "android" && !canInstall)) && (
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                追加手順
              </p>
              <p className="text-sm text-white/70 leading-relaxed">
                ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選択してください。
              </p>
            </div>
          )}
        </div>

        {/* スキップ */}
        <button
          onClick={handleSkip}
          className="text-sm text-white/30 hover:text-white/50 transition-colors"
        >
          ブラウザで続ける →
        </button>
      </div>
    </div>
  );
}
