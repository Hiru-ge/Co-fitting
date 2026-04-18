import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link } from "react-router";
import type { LinksFunction, MetaFunction } from "react-router";
import { Icon } from "~/components/Icon";
import {
  sendIosNotifySubmitted,
  sendLpCtaClicked,
  sendLpSectionViewed,
} from "~/lib/gtag";

export const links: LinksFunction = () => [
  {
    rel: "preload",
    as: "image",
    href: "/images/lp/home.webp",
    fetchPriority: "high",
  },
];

export const meta: MetaFunction = () => [
  { title: "Roamble: Discover New Spots, Break Your Usual Routine" },
  {
    name: "description",
    content:
      "For those who always end up at the same place. Roamble suggests undiscovered spots nearby, and every visit earns you XP, level-ups, and badges.",
  },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://roamble.app/lp/en" },
  {
    property: "og:title",
    content: "Roamble: Discover New Spots, Break Your Usual Routine",
  },
  {
    property: "og:description",
    content:
      "For those who always end up at the same place. Roamble suggests undiscovered spots nearby, and every visit earns you XP, level-ups, and badges.",
  },
  { property: "og:image", content: "https://roamble.app/ogp.png" },
  { property: "og:site_name", content: "Roamble" },
  { property: "og:locale", content: "en_US" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:site", content: "@roamble_app" },
  {
    name: "twitter:title",
    content: "Roamble: Discover New Spots, Break Your Usual Routine",
  },
  {
    name: "twitter:description",
    content:
      "For those who always end up at the same place. Roamble suggests undiscovered spots nearby, and every visit earns you XP, level-ups, and badges.",
  },
  { name: "twitter:image", content: "https://roamble.app/ogp.png" },
  { tagName: "link", rel: "canonical", href: "https://roamble.app/lp/en" },
  {
    tagName: "link",
    rel: "alternate",
    hrefLang: "ja",
    href: "https://roamble.app/lp",
  },
  {
    tagName: "link",
    rel: "alternate",
    hrefLang: "en",
    href: "https://roamble.app/lp/en",
  },
  {
    tagName: "link",
    rel: "alternate",
    hrefLang: "x-default",
    href: "https://roamble.app/lp",
  },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Roamble",
      description:
        "For those who always end up at the same place. Roamble suggests undiscovered spots nearby, and every visit earns you XP, level-ups, and badges.",
      url: "https://roamble.app/lp/en",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      inLanguage: "en",
      author: {
        "@type": "Person",
        name: "Hiru_ge",
        url: "https://x.com/Hiru_ge",
      },
    },
  },
];

type FormState = "idle" | "submitting" | "success" | "error";

export default function LPEn() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [shouldLoadTikTok, setShouldLoadTikTok] = useState(false);
  const tiktokSectionRef = useRef<HTMLElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const painPointsSectionRef = useRef<HTMLElement>(null);
  const featuresSectionRef = useRef<HTMLElement>(null);
  const iosNotifySectionRef = useRef<HTMLElement>(null);

  function trackLpCtaClick(params: {
    ctaType: "start" | "ios_notify" | "tiktok";
    section: "header" | "hero" | "demo" | "final_cta";
  }) {
    sendLpCtaClicked(params);
  }

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
          subject: "Roamble iOS Launch Notification Request",
        }),
      });
      const data = await res.json();
      sendIosNotifySubmitted({
        sourceSection: "ios_notify",
        success: data.success,
      });
      setFormState(data.success ? "success" : "error");
    } catch {
      sendIosNotifySubmitted({ sourceSection: "ios_notify", success: false });
      setFormState("error");
    }
  }

  useEffect(() => {
    const sectionTargets: Array<{
      ref: { current: HTMLElement | null };
      sectionName: "hero" | "pain_points" | "features" | "demo" | "ios_notify";
    }> = [
      { ref: heroSectionRef, sectionName: "hero" },
      { ref: painPointsSectionRef, sectionName: "pain_points" },
      { ref: featuresSectionRef, sectionName: "features" },
      { ref: tiktokSectionRef, sectionName: "demo" },
      { ref: iosNotifySectionRef, sectionName: "ios_notify" },
    ];

    const viewedSections = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const sectionName = entry.target.getAttribute("data-lp-section");
          if (!sectionName || viewedSections.has(sectionName)) return;

          viewedSections.add(sectionName);
          sendLpSectionViewed({
            sectionName: sectionName as
              | "hero"
              | "pain_points"
              | "features"
              | "demo"
              | "ios_notify",
          });
        });
      },
      { threshold: 0.35 },
    );

    sectionTargets.forEach(({ ref, sectionName }) => {
      if (!ref.current) return;
      ref.current.setAttribute("data-lp-section", sectionName);
      observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

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
    <main className="min-h-dvh bg-bg-dark text-white">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-bg-dark/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold font-display-alt text-primary text-lg">
            Roamble
          </span>
          <a
            href="#ios-notify"
            onClick={() =>
              trackLpCtaClick({ ctaType: "ios_notify", section: "header" })
            }
            className="px-4 py-1.5 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90"
          >
            Get notified for iOS
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section ref={heroSectionRef} className="px-6 pt-16 pb-12">
        <div className="max-w-5xl mx-auto">
          {/* PC: 2カラム、モバイル: 縦積み */}
          <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left lg:gap-16">
            {/* テキスト */}
            <div className="lg:flex-1">
              <h1 className="text-5xl font-bold font-display-alt tracking-tight text-primary mb-4">
                Roamble
              </h1>
              <p className="text-xl font-bold font-display leading-snug max-w-md mb-6 lg:max-w-none">
                Break free from your usual spots
              </p>
              <p className="text-sm text-white/70 max-w-sm leading-relaxed mb-8 text-left lg:max-w-md mx-auto lg:mx-0">
                When you can&apos;t decide where to go, Roamble picks your next
                spot.
                <br />
                Keep discovering new restaurants and cafes without the
                hesitation.
                <br />
                Even when a new place feels intimidating, every visit builds
                your <span className="font-semibold text-primary">XP</span>.
                <br />
              </p>
              <div className="flex flex-col items-center lg:items-start gap-3">
                <a
                  href="/beta-gate"
                  onClick={() =>
                    trackLpCtaClick({ ctaType: "start", section: "hero" })
                  }
                  className="inline-block px-8 py-3 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90"
                >
                  Get started
                </a>
                <a
                  href="#ios-notify"
                  onClick={() =>
                    trackLpCtaClick({ ctaType: "ios_notify", section: "hero" })
                  }
                  className="inline-block px-8 py-3 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90"
                >
                  Get notified for iOS launch
                </a>
              </div>
            </div>
            {/* スクリーンショット */}
            <div className="mt-12 lg:mt-0 flex items-end justify-center gap-3 px-2 lg:shrink-0">
              <img
                src="/images/lp/history.webp"
                alt="Visit history screen"
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
                className="w-28 sm:w-36 lg:w-40 rounded-2xl shadow-lg -rotate-3"
              />
              <img
                src="/images/lp/home.webp"
                alt="Spot suggestion screen"
                width={390}
                height={844}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-32 sm:w-40 lg:w-48 rounded-2xl shadow-xl z-10"
              />
              <img
                src="/images/lp/profile.webp"
                alt="Profile screen"
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
                className="w-28 sm:w-36 lg:w-40 rounded-2xl shadow-lg rotate-3"
              />
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-white/40">
            Screenshots are in Japanese. English UI coming with the iOS version.
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Pain Points ── */}
      <section ref={painPointsSectionRef} className="px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold font-display mb-6 text-center">
            Sound familiar?
          </h2>
          <ul className="space-y-4 text-sm text-white/80 lg:grid lg:grid-cols-2 lg:gap-x-12 lg:space-y-0 lg:gap-y-4">
            {[
              "You're curious about a place, but stepping in takes courage",
              "You always end up at the same familiar spot",
              "Trying somewhere new feels unexpectedly nerve-wracking",
              "You want to explore unknown spots and have new experiences",
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
            Roamble is here to support that{" "}
            <span className="font-semibold text-white">brave first step</span>
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Features ── */}
      <section ref={featuresSectionRef} className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold font-display mb-12 text-center">
            Discover new spots with Roamble
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
                    <h3 className="font-bold text-base mb-1">
                      1. No more &quot;where should we go?&quot;
                    </h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      Roamble randomly suggests places near you that you
                      haven&apos;t visited yet.
                      <br />
                      Zero effort to choose. An occasional challenging
                      suggestion is thrown in to gently push you further.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 lg:mt-0 flex justify-center lg:shrink-0">
                <img
                  src="/images/lp/home.webp"
                  alt="Spot suggestion screen"
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
                      2. Step into places that once felt intimidating
                    </h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      Visit the suggested spot and tap &apos;I went!&apos; to
                      earn
                      <span className="font-semibold text-primary"> XP</span>.
                      <br />
                      New places can feel intimidating at first, but as your XP
                      builds up, that hesitation naturally fades.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 lg:mt-0 flex justify-center gap-4 lg:shrink-0">
                <img
                  src="/images/lp/xp-modal.webp"
                  alt="XP earned screen"
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                  className="w-40 sm:w-48 lg:w-52 rounded-2xl shadow-lg"
                />
                <img
                  src="/images/lp/badge-modal.webp"
                  alt="Badge earned screen"
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
                      3. Keep the exploration going
                    </h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      Each new spot you log brings level-ups and badges — and a
                      growing sense of{" "}
                      <span className="font-semibold text-white">
                        your own potential
                      </span>
                      .
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 lg:mt-0 flex justify-center lg:shrink-0">
                <img
                  src="/images/lp/profile-badge.webp"
                  alt="Badge collection screen"
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
      <section ref={tiktokSectionRef} className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold font-display mb-6 text-center">
            See it in action
          </h2>
          <div className="flex justify-center">
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
                  onClick={() => {
                    trackLpCtaClick({ ctaType: "tiktok", section: "demo" });
                    setShouldLoadTikTok(true);
                  }}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-sm text-white/80 hover:bg-white/10"
                  style={{ width: "325px", minHeight: "740px" }}
                >
                  Load TikTok video
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 text-center text-sm">
            <a
              href="https://www.tiktok.com/@roamble/video/7613356529164504341"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackLpCtaClick({ ctaType: "tiktok", section: "demo" })
              }
              className="text-primary hover:underline"
            >
              Watch on TikTok →
            </a>
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── About the Developer ── */}
      <section className="px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold font-display mb-6 text-center">
            About the Developer
          </h2>
          <p className="text-sm text-white/70 leading-relaxed text-center mb-6">
            <span className="font-semibold text-white">
              I&apos;m someone who still struggles to try new places.
            </span>
            <br />
            Roamble started from my own frustration — &quot;I want to try new
            spots, but I just never get around to it. Wish something would just
            push me.&quot;
            <br />I built it hoping it helps others in the same boat.
            <br />I share the dev journey on X (Twitter) as the Roamble dev log.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="flex items-center gap-3">
              <a
                href="https://x.com/Hiru_ge"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm transition-colors hover:bg-white/10"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
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
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>@roamble_app</span>
              </a>
            </span>
            <a
              href="https://x.com/search?q=from%3AHiru_ge%20Roamble%E9%96%8B%E7%99%BA%E3%83%AD%E3%82%B0&f=live"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm transition-colors hover:bg-white/10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <Icon name="history" className="text-white/80" />
              <span>See the dev log</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── iOS Notify ── */}
      <section id="ios-notify" ref={iosNotifySectionRef} className="px-6 py-12">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-bold font-display mb-3 text-center">
            Get notified when iOS launches
          </h2>
          <p className="text-sm text-white/60 mb-6 text-center">
            iOS version is currently in development.
            <br />
            Drop your email and we&apos;ll let you know when it&apos;s ready.
          </p>

          {formState === "success" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Icon name="check_circle" className="text-primary text-4xl" />
              <p className="font-semibold">You&apos;re in!</p>
              <p className="text-sm text-white/60">
                We&apos;ll email you when the iOS version launches.
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
                placeholder="Enter your email"
                required
                disabled={formState === "submitting"}
                className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={formState === "submitting" || !email.trim()}
                className="px-6 py-3 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {formState === "submitting" ? "Sending..." : "Notify me"}
              </button>
            </form>
          )}

          {formState === "error" && (
            <p className="mt-3 text-sm text-red-400 text-center">
              Something went wrong. Please try again later.
            </p>
          )}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-12 h-px bg-white/10" />

      {/* ── Start Now CTA ── */}
      <section className="px-6 py-12 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-bold font-display mb-4">Get started</h2>
          <p className="text-sm text-white/60 mb-6">
            The web beta is live now.
            <br />
            If you have the passphrase, you&apos;re ready to go.
          </p>
          <a
            href="/beta-gate"
            onClick={() =>
              trackLpCtaClick({ ctaType: "start", section: "final_cta" })
            }
            className="inline-block px-8 py-3 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90"
          >
            Get started
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-6 text-center text-xs text-white/30">
        <Link to="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}
