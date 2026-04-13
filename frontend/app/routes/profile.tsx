import { useState } from "react";
import { Icon } from "~/components/Icon";
import type { Route } from "./+types/profile";
import { useNavigate, Link, useLocation } from "react-router";
import { logout, authRequiredLoader } from "~/lib/auth";
import { getUserStats, getUserBadges, getProficiency } from "~/api/users";
import { getAllBadges } from "~/api/badges";
import { getLevelInfo, getLevelTitle } from "~/utils/level";
import { getBadgeIcon } from "~/utils/badge-icon";
import {
  HOME_TOUR_SEEN_KEY,
  ONBOARDING_STAGE_KEY,
  ONBOARDING_STAGE,
} from "~/utils/constants";
import ProfileTourStep from "~/components/ProfileTourStep";

export async function clientLoader() {
  const { user, token } = await authRequiredLoader();
  const [statsData, badgesData, proficiencyData, allBadgesData] =
    await Promise.all([
      getUserStats(token),
      getUserBadges(token),
      getProficiency(token),
      getAllBadges(token),
    ]);
  const levelInfo = getLevelInfo(statsData.total_xp);
  const levelTitle = getLevelTitle(statsData.level);
  return {
    user,
    stats: statsData,
    badges: badgesData,
    proficiency: proficiencyData,
    totalBadgeCount: allBadgesData.length,
    levelInfo,
    levelTitle,
  };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const {
    user,
    stats,
    badges,
    proficiency,
    totalBadgeCount,
    levelInfo,
    levelTitle,
  } = loaderData;
  const navigate = useNavigate();
  const location = useLocation();
  const fromTour =
    (location.state as { fromTour?: boolean } | null)?.fromTour === true;
  const [showProfileTour, setShowProfileTour] = useState(
    () =>
      fromTour ||
      localStorage.getItem(ONBOARDING_STAGE_KEY) ===
        ONBOARDING_STAGE.PROFILE_TOUR,
  );
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function finishProfileTour() {
    localStorage.setItem(HOME_TOUR_SEEN_KEY, "true");
    localStorage.setItem(ONBOARDING_STAGE_KEY, ONBOARDING_STAGE.COMPLETED);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="flex flex-col pb-12">
      {/* ── Header ── */}
      <header className="sticky top-0 z-2 backdrop-blur-md px-4 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/settings")}
            className="flex size-10 items-center justify-center rounded-full bg-white/10"
            aria-label="設定"
          >
            <Icon name="settings" className="text-xl text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-center">マイページ</h1>
          <button
            onClick={() => {
              /* TODO: 共有機能 */
            }}
            className="flex size-10 items-center justify-center rounded-full bg-white/10 btn-unimplemented"
            aria-label="共有"
            disabled
          >
            <Icon name="share" className="text-xl text-gray-600" />
          </button>
        </div>
      </header>

      {/* ── Profile Section ── */}
      <div className="flex flex-col items-center px-4 pt-8 pb-4">
        {/* アバター（レベルバッジ付き） */}
        <div className="relative">
          <div className="size-28 rounded-full border-4 border-primary p-1 bg-gray-900 overflow-hidden shadow-xl">
            {user.avatar_url ? (
              <img
                alt="ユーザーアイコン"
                className="w-full h-full object-cover rounded-full"
                src={user.avatar_url}
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
                <Icon name="person" className="text-5xl text-gray-400" />
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0 bg-primary text-black text-[10px] font-black px-2 py-1 rounded-full border-2 border-gray-900 shadow">
            LV.{stats.level}
          </div>
        </div>

        {/* 名前・称号 */}
        <div className="mt-4 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight">
            {user.display_name}
          </h2>
          <p className="text-primary font-bold text-sm mt-1">
            レベル{stats.level}: {levelTitle}
          </p>
        </div>
      </div>

      {/* ── XP プログレスバー ── */}
      <div data-tour="xp-section" className="px-6 py-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-bold text-gray-500">現在のXP</span>
          <span className="text-sm font-bold text-primary">
            {stats.total_xp} / {stats.total_xp + levelInfo.xpToNextLevel} XP
          </span>
        </div>
        <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(19,236,236,0.5)]"
            style={{
              width: `${Math.min(levelInfo.progressPercent, 100)}%`,
            }}
          />
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          {levelInfo.isMaxLevel
            ? "最大レベルに到達しました！"
            : `次のレベルまであと ${levelInfo.xpToNextLevel} XP`}
        </p>
      </div>

      {/* ── Quick Menu (探索履歴 / ランキング) ── */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        <Link
          to="/history"
          className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl border border-white/10 shadow-sm active:scale-95 transition-transform border-l-4 border-l-primary"
        >
          <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Icon name="history" className="text-primary text-xl" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Activity
            </p>
            <p className="font-bold text-sm text-gray-200">探索履歴</p>
          </div>
        </Link>
        <button
          onClick={() => {
            /* TODO: ランキング機能 */
          }}
          className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl border border-white/10 shadow-sm active:scale-95 transition-transform btn-unimplemented"
          disabled
        >
          <div className="size-10 rounded-full bg-amber-400/20 flex items-center justify-center">
            <Icon name="trophy" className="text-amber-500 text-xl" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Rank
            </p>
            <p className="font-bold text-sm text-gray-200">ランキング</p>
          </div>
        </button>
      </div>

      {/* ── 脱却チャレンジ統計 ── */}
      <div className="px-4 pb-2">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Challenge Stats
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-extrabold text-primary">
                {stats.total_visits}
              </p>
              <p className="text-[10px] text-gray-500">総訪問</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-amber-500">
                {stats.challenge_visits}
              </p>
              <p className="text-[10px] text-gray-500">脱却チャレンジ</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-indigo-500">
                {stats.streak_count}
              </p>
              <p className="text-[10px] text-gray-500">週連続</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── ジャンル熟練度トップ ── */}
      {proficiency.length > 0 && (
        <div className="px-4 py-4">
          <h3 className="text-base font-bold tracking-tight mb-3 px-1">
            得意ジャンル
          </h3>
          <div className="space-y-2">
            {proficiency.map((p) => (
              <div
                key={p.genre_tag_id}
                className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10"
              >
                <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                  <Icon name={p.icon} fill className="text-primary text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold truncate">
                      {p.genre_name}
                    </span>
                    <span className="text-xs font-bold text-primary ml-2 shrink-0">
                      Lv.{p.level}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${Math.min((p.xp % 100) + (p.level > 1 ? 100 : 0), 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-mono shrink-0">
                  {p.xp} XP
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 獲得バッジ ── */}
      <div className="mx-4 px-4 py-4 bg-gray-50/50 mt-2 rounded-xl">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-base font-bold tracking-tight">獲得バッジ</h3>
          <span className="text-xs text-gray-500 font-bold bg-white/10 px-2 py-1 rounded-full">
            {badges.length} / {totalBadgeCount} 個
          </span>
        </div>
        {badges.length === 0 ? (
          <div className="text-center py-6">
            <Icon name="military_tech" className="text-4xl text-gray-300" />
            <p className="text-sm text-gray-400 mt-2">まだバッジがありません</p>
            <p className="text-xs text-gray-400">
              探索してバッジを獲得しましょう！
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {badges.map((badge) => {
              const { icon, color, border } = getBadgeIcon(badge.name);
              return (
                <div
                  key={badge.id}
                  className="flex flex-col items-center gap-2"
                >
                  <div
                    className={`size-20 rounded-full bg-white flex items-center justify-center shadow-md border-b-4 ${border}`}
                  >
                    <Icon name={icon} fill className={`text-4xl ${color}`} />
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight">
                    {badge.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 探索を開始 ── */}
      <div className="px-6 pt-6 pb-4">
        <Link
          to="/home"
          className="w-full bg-primary text-black font-extrabold h-14 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-95 transition-transform"
        >
          <Icon name="explore" fill />
          探索を開始
        </Link>
      </div>

      {/* ── Logout Button ── */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-40">
        <button
          onClick={() => setShowLogoutModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-full border border-red-200 text-red-500 font-bold text-sm transition-colors active:bg-red-50"
        >
          <Icon name="logout" className="text-xl" />
          ログアウト
        </button>
      </div>

      {/* ── Logout Confirmation Modal ── */}
      {showLogoutModal && (
        <LogoutModal
          isLoggingOut={isLoggingOut}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
        />
      )}

      {/* ── ツアーステップ3：XP・バッジ説明 ── */}
      {showProfileTour && (
        <ProfileTourStep
          onClose={() => setShowProfileTour(false)}
          onFinish={finishProfileTour}
        />
      )}
    </div>
  );
}

function LogoutModal({
  isLoggingOut,
  onClose,
  onConfirm,
}: {
  isLoggingOut: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl p-6 mx-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-center mb-2 text-white">
          ログアウトしますか？
        </h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          利用の際には再ログインが必要になります
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full border border-gray-700 font-bold text-sm text-gray-300 transition-colors active:bg-gray-800"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoggingOut}
            className="flex-1 py-3 rounded-full bg-red-500 text-white font-bold text-sm transition-colors active:bg-red-600 disabled:opacity-50"
          >
            {isLoggingOut ? "処理中..." : "ログアウトする"}
          </button>
        </div>
      </div>
    </div>
  );
}
