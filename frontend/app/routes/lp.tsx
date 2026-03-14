import { useEffect } from "react";
import { Link } from "react-router";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Roamble：一歩踏み出す体験を経験値に" },
  { name: "description", content: "「新しい場所に行きたいけど、勇気が出ない」そんな背中を押し、一歩踏み出す体験を経験値（XP）に変えるWebアプリ。" },
];

export default function LP() {

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-bg-dark text-white">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center">
        <h1 className="text-5xl font-bold font-display-alt tracking-tight text-primary mb-4">
          Roamble
        </h1>
        <p className="text-2xl font-bold font-display leading-snug max-w-md mb-6">
          一歩踏み出す体験を経験値に
        </p>
        <p className="text-base text-white/70 max-w-sm leading-relaxed mb-8">
          「新しい場所に行きたいけど、勇気が出ない」
          <br />
          そんなあなたの背中を押し、一歩踏み出す体験を
          <span className="font-semibold text-primary"> 経験値（XP）</span>
          に変える。
        </p>
        {/* Hero Screenshots */}
        <div className="mt-12 flex items-end justify-center gap-3 px-2">
          <img
            src="/images/lp/history.png"
            alt="訪問履歴画面"
            className="w-28 sm:w-36 rounded-2xl shadow-lg -rotate-3"
          />
          <img
            src="/images/lp/home.png"
            alt="スポット提案画面"
            className="w-32 sm:w-40 rounded-2xl shadow-xl z-10"
          />
          <img
            src="/images/lp/profile.png"
            alt="マイページ画面"
            className="w-28 sm:w-36 rounded-2xl shadow-lg rotate-3"
          />
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Pain Points ── */}
      <section className="px-6 py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold font-display mb-6 text-center">
            こんな経験、ありませんか？
          </h2>
          <ul className="space-y-4 text-sm text-white/80">
            {[
              "気になる店があるのに一人で入る勇気が出ない",
              "結局いつものチェーン店、いつもの行動範囲に落ち着く",
              "「新しい場所に行きたい」のに、いざとなると足が動かない",
              "知らない場所に飛び込んで新しい経験をしたい",
            ].map((text) => (
              <li key={text} className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-lg mt-0.5 shrink-0">
                  chevron_right
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-center text-white/60 leading-relaxed">
            それは、あなたの
            <span className="font-semibold text-white">「コンフォートゾーン」</span>
            が壁になっているサインです。
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Features ── */}
      <section className="px-6 py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold font-display mb-8 text-center">
            Roambleで、日常をクエストにする
          </h2>

          <div className="space-y-8">
            {/* Feature 1 */}
            <div className="flex items-start gap-5">
              <div className="shrink-0 w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">
                  explore
                </span>
              </div>
              <div>
                <h3 className="font-bold text-base mb-1">1. 背中を押す</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  現在地の近くから「まだ行ったことのない場所」を提案します。それはただの目的地ではなく、コンフォートゾーンを広げるための小さなクエストになります。
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src="/images/lp/home.png"
                alt="スポット提案画面"
                className="w-48 sm:w-56 rounded-2xl shadow-lg"
              />
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-5">
              <div className="shrink-0 w-12 h-12 rounded-full bg-primary-purple/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-purple text-2xl">
                  flag
                </span>
              </div>
              <div>
                <h3 className="font-bold text-base mb-1">2. 一歩を記録する</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  提案された場所に実際に行き、「行った！」ボタンを押すことで
                  <span className="font-semibold text-primary"> XP（経験値）</span>
                  を獲得できます。「怖かったけど行けた」という成功体験が、確かな数値として積み上がります。
                </p>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <img
                src="/images/lp/xp-modal.png"
                alt="XP獲得画面"
                className="w-40 sm:w-48 rounded-2xl shadow-lg"
              />
              <img
                src="/images/lp/batch-modal.png"
                alt="バッジ獲得画面"
                className="w-40 sm:w-48 rounded-2xl shadow-lg"
              />
            </div>

            {/* Feature 3 */}
            <div className="flex items-start gap-5">
              <div className="shrink-0 w-12 h-12 rounded-full bg-accent-orange/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-accent-orange text-2xl">
                  trending_up
                </span>
              </div>
              <div>
                <h3 className="font-bold text-base mb-1">3. 成長を実感する</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  訪問履歴が増えるたび、レベルアップやバッジ獲得を通じて、行動範囲とともに
                  <span className="font-semibold text-white">自分自身の可能性</span>
                  も広がっていく実感が得られます。
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src="/images/lp/profile-batch.png"
                alt="バッジ一覧画面"
                className="w-48 sm:w-56 rounded-2xl shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Demo Video ── */}
      <section className="px-6 py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold font-display mb-6 text-center">
            使ってみた動画
          </h2>
          <div className="flex justify-center">
            <blockquote
              className="tiktok-embed"
              cite="https://www.tiktok.com/@roamble/video/7613356529164504341"
              data-video-id="7613356529164504341"
              style={{ maxWidth: "325px", minWidth: "325px" }}
            >
              <section />
            </blockquote>
          </div>
          <p className="mt-3 text-center text-sm">
            <a
              href="https://www.tiktok.com/@roamble/video/7613356529164504341"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              TikTokで見る →
            </a>
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── About the Developer ── */}
      <section className="px-6 py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold font-display mb-6 text-center">
            作っている人
          </h2>
          <p className="text-sm text-white/70 leading-relaxed text-center mb-6">
            コンフォートゾーンから出られない課題を持つ個人開発者が、「自分自身が使いたいと思えるアプリを作る」前提で開発に取り組んでいます。
            <br />
            開発の過程は X (Twitter) で #BuildInPublic として公開しています。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://x.com/Hiru_ge"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm transition-colors hover:bg-white/10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>@Hiru_ge</span>
            </a>
            <a
              href="https://x.com/roamble_app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm transition-colors hover:bg-white/10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>@roamble_app</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Start Now CTA ── */}
      <section className="px-6 py-12 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold font-display mb-4">
            さっそく始める
          </h2>
          <p className="text-sm text-white/60 mb-6">
            現在Webベータ版を公開中です。<br />合言葉をお持ちの方はそのまま始められます。
          </p>
          <a
            href="/beta-gate"
            className="inline-block px-8 py-3 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90"
          >
            さっそく始める
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-6 text-center text-xs text-white/30">
        <Link to="/privacy" className="hover:underline">
          プライバシーポリシー
        </Link>
      </footer>
    </div>
  );
}
