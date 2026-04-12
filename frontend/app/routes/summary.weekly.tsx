import { useEffect, useState } from "react";
import type { Route } from "./+types/summary.weekly";
import { protectedLoader } from "~/lib/auth";
import { listVisits } from "~/api/visits";
import { getUserBadges } from "~/api/users";
import { getPlacePhoto } from "~/api/places";
import type { Visit } from "~/types/visit";
import type { EarnedBadge } from "~/types/auth";
import SummaryLayout from "~/components/SummaryLayout";

export { protectedLoader as clientLoader };

/** 直近月曜0時 JST の ISO 文字列を返す */
function getWeekRange(): { from: string; until: string; label: string } {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const nowJST = new Date(Date.now() + JST_OFFSET_MS);
  const dayOfWeek = nowJST.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // 直近月曜 00:00 JST (= 前日 15:00 UTC のケースあり)
  const mondayMidnightUTC =
    Date.UTC(
      nowJST.getUTCFullYear(),
      nowJST.getUTCMonth(),
      nowJST.getUTCDate() - daysFromMonday,
    ) - JST_OFFSET_MS;

  const lastMondayMidnightUTC = mondayMidnightUTC - 7 * 24 * 60 * 60 * 1000;
  const from = new Date(lastMondayMidnightUTC).toISOString();
  const until = new Date(mondayMidnightUTC).toISOString();

  const mondayDate = new Date(lastMondayMidnightUTC + JST_OFFSET_MS);
  const sundayDate = new Date(
    lastMondayMidnightUTC + JST_OFFSET_MS + 6 * 24 * 60 * 60 * 1000,
  );
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  const label = `${fmt(mondayDate)}（月）〜 ${fmt(sundayDate)}（日）`;

  return { from, until, label };
}

type VisitWithPhoto = Visit & { photoUrl?: string };

async function loadPhotos(
  visits: Visit[],
  token: string,
): Promise<VisitWithPhoto[]> {
  return Promise.all(
    visits.map(async (v) => {
      try {
        const photoUrl = await getPlacePhoto(
          token,
          v.place_id,
          v.photo_reference as string,
        );
        return { ...v, photoUrl };
      } catch {
        return { ...v };
      }
    }),
  );
}

export default function SummaryWeekly({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;
  const [isLoading, setIsLoading] = useState(true);
  const [visits, setVisits] = useState<VisitWithPhoto[]>([]);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { from, until, label } = getWeekRange();

  useEffect(() => {
    async function load() {
      try {
        const [visitRes, badgeRes] = await Promise.all([
          listVisits(token, 100, 0, from, until),
          getUserBadges(token),
        ]);
        const visitsWithPhotos = await loadPhotos(visitRes.visits, token);
        setVisits(visitsWithPhotos);
        setBadges(
          badgeRes.filter((b) => b.earned_at >= from && b.earned_at < until),
        );
      } catch {
        setErrorMessage(
          "データの取得に失敗しました。しばらくしてから再度お試しください。",
        );
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [token, from, until]);

  const { user } = loaderData;

  return (
    <SummaryLayout
      title="先週の冒険、どうだった?"
      greeting={`${user.display_name}さん、先週もお疲れ!`}
      period={label}
      isLoading={isLoading}
      visits={visits}
      badges={badges}
      ctaLabel="来週も行ってみよう"
      errorMessage={errorMessage}
    />
  );
}
