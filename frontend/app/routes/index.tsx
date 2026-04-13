import { Link, redirect } from "react-router";
import { getToken } from "~/lib/auth";
import { isStandalone, isPWAPromptDismissed } from "~/lib/pwa";
import { Icon } from "~/components/Icon";

export async function clientLoader() {
  const authToken = getToken();
  if (authToken) {
    throw redirect("/home");
  }
  if (!isStandalone() && !isPWAPromptDismissed()) {
    throw redirect("/pwa-prompt");
  }
  return null;
}

export default function Index() {
  return (
    <div className="min-h-dvh bg-bg-dark text-white flex flex-col">
      {/* ── Hero Section ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8 text-center">
        <h1 className="text-4xl font-bold font-display-alt tracking-tight text-primary mb-3">
          Roamble
        </h1>
        <p className="text-lg text-white/80 max-w-xs leading-relaxed">
          いつもと違う場所へ、一歩踏み出そう
        </p>
      </section>

      {/* ── How it Works ── */}
      <section className="px-6 pb-8">
        <div className="max-w-sm mx-auto space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Icon name="explore" className="text-primary text-xl" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">提案</p>
              <p className="text-xs text-white/60">
                現在地の近くからスポットを提案
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Icon name="directions_walk" className="text-primary text-xl" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">訪問</p>
              <p className="text-xs text-white/60">
                気になったら実際に足を運んでみよう
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Icon name="check_circle" className="text-primary text-xl" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">記録</p>
              <p className="text-xs text-white/60">
                「行ってきた！」で訪問を記録しよう
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section className="px-6 pb-8">
        <div className="max-w-sm mx-auto">
          <Link
            to="/lp"
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 transition-colors hover:bg-white/10"
          >
            <span className="text-sm text-white/70">Roamble ってなに？</span>
            <Icon name="arrow_forward" className="text-white/40 text-lg" />
          </Link>
        </div>
      </section>

      {/* ── CTA Buttons ── */}
      <section className="px-6 pb-10">
        <div className="max-w-sm mx-auto">
          <Link
            to="/login"
            className="block w-full text-center py-3 rounded-lg bg-primary text-bg-dark font-bold text-sm transition-colors hover:bg-primary/90"
          >
            さっそく始める
          </Link>
        </div>
      </section>
    </div>
  );
}
