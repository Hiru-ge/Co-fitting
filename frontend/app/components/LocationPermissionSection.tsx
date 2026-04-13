import { useEffect, useMemo, useState } from "react";
import { Icon } from "~/components/Icon";

function getAcceptSteps(
  isIOS: boolean,
  isStandalone: boolean,
  isIOSChrome: boolean,
): string[] {
  if (isIOS && isStandalone) {
    return [
      "iPhoneの「設定」を開く",
      "「プライバシーとセキュリティ」→「位置情報サービス」",
      "「Roamble」をタップ",
      "「このAppの使用中のみ許可」を選択",
      "Roambleに戻って確認する",
    ];
  }

  if (isIOS && isIOSChrome) {
    return [
      "iPhoneの「設定」を開く",
      "「プライバシーとセキュリティ」→「位置情報サービス」",
      "「Chrome」をタップ",
      "「このAppの使用中のみ許可」を選択",
      "Chromeに戻り「位置情報を許可する」を押す",
    ];
  }

  if (isIOS) {
    return [
      "iPhoneの「設定」を開く",
      "「プライバシーとセキュリティ」→「位置情報サービス」",
      "「Safari ウェブサイト」をタップ",
      "「次回確認」を選択",
      "Safariに戻り「位置情報を許可する」を押す",
    ];
  }

  return [
    "アドレスバー左の鍵マーク（または「i」）をタップ",
    "「サイトの設定」→「位置情報」",
    "「許可」に変更",
    "ページをリロード",
  ];
}

export default function LocationPermissionSection() {
  const [permissionState, setPermissionState] = useState<
    PermissionState | "unsupported" | null
  >(null);

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iP(hone|ad|od)/.test(userAgent);
  const isIOSChrome = /CriOS/.test(userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  const acceptSteps = useMemo(
    () => getAcceptSteps(isIOS, isStandalone, isIOSChrome),
    [isIOS, isStandalone, isIOSChrome],
  );

  useEffect(() => {
    async function checkPermission() {
      if (!navigator.permissions) {
        setPermissionState("unsupported");
        return;
      }

      try {
        const result = await navigator.permissions.query({
          name: "geolocation",
        });
        setPermissionState(result.state);
        result.onchange = () => setPermissionState(result.state);
      } catch {
        setPermissionState("unsupported");
      }
    }

    checkPermission();
  }, []);

  function renderStatusDisplay() {
    if (permissionState === null) return null;

    if (permissionState === "granted") {
      return (
        <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
          <Icon name="check_circle" className="text-base" />
          許可済み — 現在地を使って提案しています
        </div>
      );
    }

    if (permissionState === "denied") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
            <Icon name="location_off" className="text-base" />
            位置情報が拒否されています
          </div>
          <p className="text-xs text-gray-400">
            {isIOS
              ? "アプリ・ブラウザからは再許可できません。iPhoneの設定から変更してください。"
              : "ブラウザからは再許可できません。端末の設定から変更してください。"}
          </p>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              変更手順
            </p>
            <ol className="space-y-2">
              {acceptSteps.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-300"
                >
                  <span className="shrink-0 w-5 h-5 rounded-full bg-red-900/30 text-red-500 text-xs flex items-center justify-center font-bold mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      );
    }

    if (permissionState === "unsupported") {
      return (
        <p className="text-sm text-gray-400">
          このブラウザは位置情報に対応していません。
        </p>
      );
    }

    return (
      <div className="flex items-start gap-2 bg-blue-900/20 rounded-xl p-3">
        <Icon name="info" className="text-blue-500 text-base shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300">
          まだ許可されていません。ホーム画面でお店を読み込む際に許可ダイアログが表示されます。
          {isIOS &&
            (isStandalone
              ? "許可後は「設定 → 位置情報サービス → Roamble」で管理できます。"
              : isIOSChrome
                ? "許可後は「設定 → 位置情報サービス → Chrome」で管理できます。"
                : "許可後は「設定 → 位置情報サービス → Safari ウェブサイト」で管理できます。")}
        </p>
      </div>
    );
  }

  return (
    <section className="bg-white/5 rounded-2xl border border-white/10 shadow-sm p-5">
      <h2 className="text-base font-bold text-gray-200 mb-2 flex items-center gap-2">
        <Icon name="my_location" className="text-primary text-xl" />
        位置情報
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        現在地をもとにお店を提案します。許可しない場合はデフォルト位置（渋谷駅付近）が使われます。
      </p>
      {renderStatusDisplay()}
    </section>
  );
}
