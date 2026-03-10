import { Link } from "react-router";

/**
 * 今日の3件提案をすべてコンプリートした際に表示するカード
 */
export default function CompleteCard() {
  return (
    <section
      role="region"
      aria-label="コンプリート"
      className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center"
    >
      {/* トロフィーアイコン */}
      <div className="w-28 h-28 rounded-full bg-yellow-400/10 flex items-center justify-center ring-2 ring-yellow-400/30">
        <span
          className="material-symbols-outlined text-yellow-400"
          style={{ fontSize: "4rem" }}
        >
          emoji_events
        </span>
      </div>

      {/* メッセージ */}
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          今日の3件コンプリート！
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          今日の冒険はすべて達成しました。
          <br />
          明日また新しいスポットが待っています！
        </p>
      </div>

      {/* 履歴リンク */}
      <Link
        to="/history"
        className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 transition-colors rounded-full text-white font-bold text-sm"
      >
        <span className="material-symbols-outlined text-base">history</span>
        訪問した場所を振り返る
      </Link>
    </section>
  );
}
