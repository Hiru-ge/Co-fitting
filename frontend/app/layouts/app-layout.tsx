import { Outlet } from "react-router";
import BottomNav from "~/components/bottom-nav";

const FEEDBACK_URL = "https://forms.gle/upcMz6uV97hmLn9n9";

// レイアウト規約:
// - BottomNav の高さ分 (pb-24) はこのレイアウトが一括管理する
// - 各ページコンポーネントは独自の pb-32 等の下部余白を追加しないこと
// - ページ内スクロールが不要な画面 (e.g. Home) は min-h-max / min-h-dvh を使わず
//   コンテンツ高さに委ねること
export default function AppLayout() {
  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col">
      <div className="flex-1 pb-24">
        <Outlet />
      </div>
      <BottomNav />
      {/* フィードバックFAB: BottomNav（h-16=64px）の上に配置 */}
      <a
        href={FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="フィードバックを送る"
        className="fixed bottom-20 right-4 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-violet-500 text-white shadow-lg hover:bg-violet-600 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-[22px]">mail</span>
      </a>
    </div>
  );
}
