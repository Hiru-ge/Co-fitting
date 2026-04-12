import type { Route } from "./+types/summary.monthly";
import { authRequiredLoader } from "~/lib/auth";
import { listVisits } from "~/api/visits";
import { getUserBadges } from "~/api/users";
import { getPlacePhoto } from "~/api/places";
import type { Visit } from "~/types/visit";
import type { EarnedBadge } from "~/types/auth";
import { getYearMonthRange } from "~/utils/date";
import SummaryReport from "~/components/SummaryReport";

export async function clientLoader() {
  const { user, token } = await authRequiredLoader();
  const { from, until, label } = getYearMonthRange(new Date());
  const [visitRes, badgeRes] = await Promise.all([
    listVisits(token, 100, 0, from, until),
    getUserBadges(token),
  ]);
  const visits = await Promise.all(
    visitRes.visits.map(async (v: Visit) => {
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
  const badges: EarnedBadge[] = badgeRes.filter(
    (b) => b.earned_at >= from && b.earned_at < until,
  );
  return { user, visits, badges, label };
}

export default function SummaryMonthly({ loaderData }: Route.ComponentProps) {
  const { user, visits, badges, label } = loaderData;
  return (
    <SummaryReport
      title={`${label}の冒険まとめ`}
      greeting={`${user.display_name}さん、先月もいろんな場所を冒険したね!`}
      period={label}
      isLoading={false}
      visits={visits}
      badges={badges}
      ctaLabel="来月も冒険しよう"
    />
  );
}
