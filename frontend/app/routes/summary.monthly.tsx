import { useEffect, useState } from "react";
import type { Route } from "./+types/summary.monthly";
import { protectedLoader } from "~/lib/protected-loader";
import { listVisits } from "~/api/visits";
import { getUserBadges } from "~/api/users";
import { getPlacePhoto } from "~/api/places";
import type { Visit } from "~/types/visit";
import type { EarnedBadge } from "~/types/auth";
import SummaryLayout from "~/components/SummaryLayout";

export { protectedLoader as clientLoader };

/** 先月1日0時 JST〜今月1日0時 JST の ISO 文字列と月ラベルを返す */
function getMonthRange(): { from: string; until: string; label: string } {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const nowJST = new Date(Date.now() + JST_OFFSET_MS);

  const year = nowJST.getUTCFullYear();
  const month = nowJST.getUTCMonth(); // 0-indexed

  // 先月1日 00:00 JST
  const fromUTC = Date.UTC(year, month - 1, 1) - JST_OFFSET_MS;
  // 今月1日 00:00 JST (= 先月末の翌日0時)
  const untilUTC = Date.UTC(year, month, 1) - JST_OFFSET_MS;

  // labelは fromUTC から計算（1月の場合に前年12月を正しく表示するため）
  const fromDate = new Date(fromUTC + JST_OFFSET_MS);
  const label = `${fromDate.getUTCFullYear()}年${fromDate.getUTCMonth() + 1}月`;

  return {
    from: new Date(fromUTC).toISOString(),
    until: new Date(untilUTC).toISOString(),
    label,
  };
}

type VisitWithPhoto = Visit & { photoUrl?: string };

async function loadPhotos(
  visits: Visit[],
  token: string,
): Promise<VisitWithPhoto[]> {
  return Promise.all(
    visits.map(async (v) => {
      try {
        const photoUrl = await getPlacePhoto(token, v.place_id);
        return { ...v, photoUrl };
      } catch {
        return { ...v };
      }
    }),
  );
}

export default function SummaryMonthly({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;
  const [isLoading, setIsLoading] = useState(true);
  const [visits, setVisits] = useState<VisitWithPhoto[]>([]);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { from, until, label } = getMonthRange();

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
      title={`${label}の冒険まとめ`}
      greeting={`${user.display_name}さん、先月もいろんな場所を冒険したね!`}
      period={label}
      isLoading={isLoading}
      visits={visits}
      badges={badges}
      ctaLabel="来月も冒険しよう"
      errorMessage={errorMessage}
    />
  );
}
