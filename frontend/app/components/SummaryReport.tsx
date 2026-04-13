import { Link } from "react-router";
import { Icon } from "~/components/Icon";
import type { Visit } from "~/types/visit";
import type { EarnedBadge } from "~/types/auth";
import { getBadgeIcon } from "~/utils/badge-icon";

interface SummaryReportProps {
  title: string;
  greeting: string;
  period: string;
  isLoading: boolean;
  visits: (Visit & { photoUrl?: string })[];
  badges: EarnedBadge[];
  ctaLabel: string;
  errorMessage?: string | null;
}

interface StatCardProps {
  icon: string;
  value: number;
  label: string;
  accentClass: string;
  labelClass: string;
}

function StatCard({
  icon,
  value,
  label,
  accentClass,
  labelClass,
}: StatCardProps) {
  return (
    <div className="bg-surface rounded-2xl px-4 py-6 text-center">
      <Icon name={icon} className={`text-[28px] block mb-1 ${accentClass}`} />
      <div
        className={`text-[52px] font-black leading-none tracking-[-2px] ${accentClass}`}
      >
        {value}
      </div>
      <div className={`text-sm mt-1.5 font-bold ${labelClass}`}>{label}</div>
    </div>
  );
}

function VisitRow({ visit }: { visit: Visit & { photoUrl?: string } }) {
  return (
    <div className="flex items-center">
      <div className="w-11 h-11 bg-surface rounded-l-lg shrink-0 flex items-center justify-center overflow-hidden">
        {visit.photoUrl ? (
          <img
            src={visit.photoUrl}
            alt={visit.place_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon name="location_on" className="text-[20px] text-dim" />
        )}
      </div>
      <div className="flex-1 bg-surface rounded-r-lg px-4 py-2.5 flex items-center justify-between">
        <span className="text-secondary text-[15px]">{visit.place_name}</span>
        <span className="text-primary text-[13px] font-bold shrink-0 ml-2">
          +{visit.xp_earned} XP
        </span>
      </div>
    </div>
  );
}

function BadgeRow({ badge }: { badge: EarnedBadge }) {
  const { icon } = getBadgeIcon(badge.name);
  return (
    <div className="flex items-center">
      <div className="w-11 h-11 bg-surface rounded-l-lg shrink-0 flex items-center justify-center">
        <Icon name={icon} fill className="text-[20px] text-brand" />
      </div>
      <div className="flex-1 bg-surface rounded-r-lg px-4 py-2.5">
        <span className="text-secondary text-[15px]">{badge.name}</span>
      </div>
    </div>
  );
}

export default function SummaryReport({
  title,
  greeting,
  period,
  isLoading,
  visits,
  badges,
  ctaLabel,
  errorMessage,
}: SummaryReportProps) {
  const totalXP = visits.reduce((sum, v) => sum + (v.xp_earned ?? 0), 0);
  const visitCount = visits.length;

  return (
    <div className="bg-bg-dark min-h-dvh pb-8">
      <div className="p-4 pb-0">
        <Link
          to="/history"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/8 text-white/70"
        >
          <Icon name="arrow_back" className="text-[22px]" />
        </Link>
      </div>

      <div className="max-w-150 mx-auto px-6 py-8">
        {isLoading && (
          <div className="text-center py-12">
            <Icon
              name="progress_activity"
              className="animate-spin text-[40px] text-primary"
            />
          </div>
        )}

        {!isLoading && (
          <>
            <p className="text-secondary text-base leading-relaxed mb-2">
              {greeting}
            </p>
            <h2 className="text-white text-xl font-bold mb-6">{title}</h2>

            {errorMessage && (
              <div className="text-center py-8 text-[#ff6b6b]">
                <Icon name="error_outline" className="text-[48px] block mb-3" />
                <p className="text-[15px] m-0">{errorMessage}</p>
              </div>
            )}

            {!errorMessage && (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <StatCard
                    icon="location_on"
                    value={visitCount}
                    label="か所を冒険!"
                    accentClass="text-accent-visit"
                    labelClass="text-secondary"
                  />
                  <StatCard
                    icon="bolt"
                    value={totalXP}
                    label="XP 獲得!"
                    accentClass="text-primary"
                    labelClass="text-dim"
                  />
                </div>

                <p className="text-dim text-[13px] text-center mb-6">
                  {period}
                </p>

                {visits.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-white text-base font-bold mb-3">
                      訪れた場所
                    </h3>
                    <div className="flex flex-col gap-2">
                      {visits.map((visit) => (
                        <VisitRow key={visit.id} visit={visit} />
                      ))}
                    </div>
                  </div>
                )}

                {badges.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-white text-base font-bold mb-3">
                      ゲットしたバッジ
                    </h3>
                    <div className="flex flex-col gap-2">
                      {badges.map((badge) => (
                        <BadgeRow key={badge.id} badge={badge} />
                      ))}
                    </div>
                  </div>
                )}

                {visits.length === 0 && (
                  <div className="text-center py-8 text-dim">
                    <Icon
                      name="explore_off"
                      className="text-[48px] block mb-3"
                    />
                    <p className="text-base mb-1 text-secondary">
                      この期間の冒険記録がありません
                    </p>
                    <p className="text-[13px]">
                      次の期間もどこかへ行ってみよう！
                    </p>
                  </div>
                )}

                <div className="text-center mt-8">
                  <Link
                    to="/home"
                    className="bg-brand text-white no-underline px-8 py-3.5 rounded-lg text-base font-bold inline-block"
                  >
                    {ctaLabel}
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
