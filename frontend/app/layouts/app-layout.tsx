import { Outlet } from "react-router";
import BottomNav from "~/components/bottom-nav";

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
    </div>
  );
}
