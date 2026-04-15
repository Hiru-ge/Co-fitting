import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link } from "react-router";
import type { LinksFunction, MetaFunction } from "react-router";
import { Icon } from "~/components/Icon";

export const links: LinksFunction = () => [
  {
    rel: "preload",
    as: "image",
    href: "/images/lp/home.webp",
    fetchPriority: "high",
  },
];

export const meta: MetaFunction = () => [
  { title: "Roamble：「いつも同じ店」を抜け出す、新しいお店開拓アプリ" },
  {
    name: "description",
    content:
      "「また同じ店になってしまった」を卒業したい人へ。現在地周辺の知らなかったお店をランダム提案し、訪問するたびにXP・レベルアップ・バッジを獲得できるお店開拓アプリ。",
  },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://roamble.app/lp" },
  {
    property: "og:title",
    content: "Roamble：「いつも同じ店」を抜け出す、新しいお店開拓アプリ",
  },
  {
    property: "og:description",
    content:
      "「また同じ店になってしまった」を卒業したい人へ。現在地周辺の知らなかったお店をランダム提案し、訪問するたびにXP・レベルアップ・バッジを獲得できるお店開拓アプリ。",
  },
  { property: "og:image", content: "https://roamble.app/ogp.png" },
  { property: "og:site_name", content: "Roamble" },
  { property: "og:locale", content: "ja_JP" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:site", content: "@roamble_app" },
  {
    name: "twitter:title",
    content: "Roamble：「いつも同じ店」を抜け出す、新しいお店開拓アプリ",
  },
  {
    name: "twitter:description",
    content:
      "「また同じ店になってしまった」を卒業したい人へ。現在地周辺の知らなかったお店をランダム提案し、訪問するたびにXP・レベルアップ・バッジを獲得できるお店開拓アプリ。",
  },
  { name: "twitter:image", content: "https://roamble.app/ogp.png" },
  { tagName: "link", rel: "canonical", href: "https://roamble.app/lp" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Roamble",
      description:
        "「また同じ店になってしまった」を卒業したい人へ。現在地周辺の知らなかったお店をランダム提案し、訪問するたびにXP・レベルアップ・バッジを獲得できるお店開拓アプリ。",
      url: "https://roamble.app/lp",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      inLanguage: "ja",
      author: {
        "@type": "Person",
        name: "Hiru_ge",
        url: "https://x.com/Hiru_ge",
      },
    },
  },
];

type FormState = "idle" | "submitting" | "success" | "error";

export default function LP() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [shouldLoadTikTok, setShouldLoadTikTok] = useState(false);
  const tiktokSectionRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("submitting");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_KEY,
          email,
          subject: "Roamble iOS版リリース通知リクエスト",
        }),
      });
      const data = await res.json();
      setFormState(data.success ? "success" : "error");
    } catch {
      setFormState("error");
    }
  }

  useEffect(() => {
    const target = tiktokSectionRef.current;
    if (!target || shouldLoadTikTok) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadTikTok(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px", threshold: 0.25 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoadTikTok]);

  useEffect(() => {
    if (!shouldLoadTikTok) return;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.tiktok.com/embed.js"]',
    );
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;

    const scheduleScriptLoad = () => document.body.appendChild(script);
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(scheduleScriptLoad, { timeout: 1500 });
    } else {
      setTimeout(scheduleScriptLoad, 800);
    }

    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, [shouldLoadTikTok]);

  return (
    <main
      className="min-h-dvh bg-bg-dark text-white"
      style={{ fontFamily: '"Hiragino Sans", "Yu Gothic", sans-serif' }}
    >
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-bg-dark/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-primary text-lg">Roamble</span>
          <a
            href="#ios-notify"
            className="px-4 py-1.5 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90"
          >
            iOS版通知を受け取る
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="px-6 pt-16 pb-12">
        <div className="max-w-5xl mx-auto">
          {/* PC: 2カラム、モバイル: 縦積み */}
          <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left lg:gap-16">
            {/* テキスト */}
            <div className="lg:flex-1">
              <h1 className="text-5xl font-bold tracking-tight text-primary mb-4">
                Roamble
              </h1>
              <p className="text-2xl font-bold leading-snug max-w-md mb-6 lg:max-w-none">
                「いつも同じ店」を抜け出そう
              </p>
              <p className="text-base text-white/70 max-w-sm leading-relaxed mb-8 lg:max-w-md mx-auto lg:mx-0">
                近くの知らなかったお店をランダム提案。
                <br />
                行くたびに
                <span className="font-semibold text-primary">経験値</span>
                が積み上がる。
                <br />
              </p>
              <div className="flex flex-col items-center lg:items-start gap-3">
                <a
                  href="/beta-gate"
                  className="inline-block px-8 py-3 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90"
                >
                  さっそく始める
                </a>
                <a
                  href="#ios-notify"
                  className="inline-block px-8 py-3 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90"
                >
                  iOS版リリース通知を受け取る
                </a>
              </div>
            </div>
            {/* スクリーンショット */}
            <div className="mt-12 lg:mt-0 flex items-end justify-center gap-3 px-2 lg:shrink-0">
              <img
                src="/images/lp/history.webp"
                alt="訪問履歴画面"
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
                className="w-28 sm:w-36 lg:w-40 rounded-2xl shadow-lg -rotate-3"
              />
              <img
                src="/images/lp/home.webp"
                alt="お店提案画面"
                width={390}
                height={844}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-32 sm:w-40 lg:w-48 rounded-2xl shadow-xl z-10"
              />
              <img
                src="/images/lp/profile.webp"
                alt="マイページ画面"
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
                className="w-28 sm:w-36 lg:w-40 rounded-2xl shadow-lg rotate-3"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Pain Points ── */}
      <section className="px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-6 text-center">
            こんな経験、ありませんか？
          </h2>
          <ul className="space-y-4 text-sm text-white/80 lg:grid lg:grid-cols-2 lg:gap-x-12 lg:space-y-0 lg:gap-y-4">
            {[
              "気になる店があるのに入る勇気が出ない",
              "結局いつもの店に落ち着く",
              "新しいお店に行きたいのに、なんだか億劫",
              "知らない店に飛び込んで新しい体験をしたい",
            ].map((text) => (
              <li key={text} className="flex items-start gap-3">
                <Icon
                  name="chevron_right"
                  className="text-primary text-lg mt-0.5 shrink-0"
                />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-center text-white/60 leading-relaxed">
            Roambleは、あなたの
            <span className="font-semibold text-white">勇気ある一歩</span>
            をサポートします
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Features ── */}
      <section className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold mb-12 text-center">
            Roambleで、日常をクエストにする
          </h2>

          <div className="space-y-16 lg:space-y-20">
            {/* Feature 1 */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:gap-16">
              <div className="lg:flex-1 space-y-8">
                <div className="flex items-start gap-5">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                    <Icon name="explore" className="text-primary text-2xl" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base mb-1">1. 背中を押す</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      現在地の近くから「まだ行ったことのない場所」をランダムに提案します。
                      <br></br>
                      選ぶ手間はゼロ。あとは勇気を出して踏み出すだけです。
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 lg:mt-0 flex justify-center lg:shrink-0">
                <img
                  src="/images/lp/home.webp"
                  alt="お店提案画面"
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                  className="w-48 sm:w-56 lg:w-64 rounded-2xl shadow-lg"
                />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col lg:flex-row-reverse lg:items-center lg:gap-16">
              <div className="lg:flex-1 space-y-8">
                <div className="flex items-start gap-5">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-primary-purple/15 flex items-center justify-center">
                    <Icon
                      name="flag"
                      className="text-primary-purple text-2xl"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-base mb-1">
                      2. 一歩を記録する
                    </h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      提案された場所に実際に行き、「行った！」ボタンを押すことで
                      <span className="font-semibold text-primary">
                        {" "}
                        経験値
                      </span>
                      を獲得できます。「怖かったけど行けた」という成功体験が、確かな数値として積み上がります。
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 lg:mt-0 flex justify-center gap-4 lg:shrink-0">
                <img
                  src="/images/lp/xp-modal.webp"
                  alt="XP獲得画面"
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                  className="w-40 sm:w-48 lg:w-52 rounded-2xl shadow-lg"
                />
                <img
                  src="/images/lp/badge-modal.webp"
                  alt="バッジ獲得画面"
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                  className="w-40 sm:w-48 lg:w-52 rounded-2xl shadow-lg"
                />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:gap-16">
              <div className="lg:flex-1 space-y-8">
                <div className="flex items-start gap-5">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-accent-orange/15 flex items-center justify-center">
                    <Icon
                      name="trending_up"
                      className="text-accent-orange text-2xl"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-base mb-1">
                      3. 成長を実感する
                    </h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      知らなかったお店が登録されるたび、レベルアップやバッジ獲得を通じて
                      <span className="font-semibold text-white">
                        自分自身の可能性
                      </span>
                      も広がっていく実感が得られます。
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 lg:mt-0 flex justify-center lg:shrink-0">
                <img
                  src="/images/lp/profile-badge.webp"
                  alt="バッジ一覧画面"
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                  className="w-48 sm:w-56 lg:w-64 rounded-2xl shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Demo Video ── */}
      <section className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold mb-6 text-center">使ってみた動画</h2>
          <div ref={tiktokSectionRef} className="flex justify-center">
            <div style={{ width: "325px", minHeight: "740px" }}>
              {shouldLoadTikTok ? (
                <blockquote
                  className="tiktok-embed"
                  cite="https://www.tiktok.com/@roamble/video/7613356529164504341"
                  data-video-id="7613356529164504341"
                  style={{
                    maxWidth: "325px",
                    minWidth: "325px",
                    minHeight: "740px",
                  }}
                >
                  <section style={{ minHeight: "740px" }} />
                </blockquote>
              ) : (
                <button
                  type="button"
                  onClick={() => setShouldLoadTikTok(true)}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-sm text-white/80 hover:bg-white/10"
                  style={{ width: "325px", minHeight: "740px" }}
                >
                  TikTok動画を読み込む
                </button>
              )}
            </div>
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
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-6 text-center">作っている人</h2>
          <p className="text-sm text-white/70 leading-relaxed text-center mb-6">
            <span className="font-semibold text-white">
              開発者自身、新しいお店を開拓できずにいる一人です
            </span>
            <br />
            Roambleは、「自分が使いたいと思うものを作る」...その一点で作り始めたアプリです。
            <br />
            同じようなモヤモヤを感じている人の背中を押す存在になれたら嬉しいです。
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

      {/* ── iOS Notify ── */}
      <section id="ios-notify" className="px-6 py-12">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-bold mb-3 text-center">
            iOS版リリース通知を受け取る
          </h2>
          <p className="text-sm text-white/60 mb-6 text-center">
            現在、iOS版の開発を進めています。
            <br />
            リリース時にメールでお知らせしますので、メールアドレスを登録してください。
          </p>

          {formState === "success" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Icon name="check_circle" className="text-primary text-4xl" />
              <p className="font-semibold">登録しました！</p>
              <p className="text-sm text-white/60">
                iOS版がリリースされたらメールでお知らせします。
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレスを入力"
                required
                disabled={formState === "submitting"}
                className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={formState === "submitting" || !email.trim()}
                className="px-6 py-3 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {formState === "submitting" ? "送信中..." : "通知を受け取る"}
              </button>
            </form>
          )}

          {formState === "error" && (
            <p className="mt-3 text-sm text-red-400 text-center">
              送信に失敗しました。しばらく時間をおいて再度お試しください。
            </p>
          )}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Start Now CTA ── */}
      <section className="px-6 py-12 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-bold mb-4">さっそく始める</h2>
          <p className="text-sm text-white/60 mb-6">
            現在Webベータ版を公開中です。
            <br />
            合言葉をお持ちの方はそのまま始められます。
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
    </main>
  );
}
