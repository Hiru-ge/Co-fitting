import { useState, useEffect, useCallback } from "react";
import type { Route } from "./+types/profile";
import { redirect, useNavigate } from "react-router";
import { getToken, getUser, logout } from "~/lib/auth";
import { getUserStats, getUserBadges, getProficiency } from "~/api/users";
import type { UserStats, EarnedBadge, Proficiency } from "~/types/auth";
import { toUserMessage } from "~/utils/error";
import { useToast } from "~/components/toast";
import { getLevelInfo, getLevelTitle } from "~/utils/level";
import { getBadgeIcon } from "~/utils/badge-icon";

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const user = await getUser(token);
  return { user, token };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user, token } = loaderData;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [proficiency, setProficiency] = useState<Proficiency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsData, badgesData, proficiencyData] = await Promise.all([
        getUserStats(token),
        getUserBadges(token),
        getProficiency(token),
      ]);
      setStats(statsData);
      setBadges(badgesData);
      setProficiency(proficiencyData);
    } catch (err) {
      showToast(toUserMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      navigate("/login", { replace: true });
    }
  }

  const levelInfo = stats ? getLevelInfo(stats.total_xp) : null;
  const levelTitle = stats ? getLevelTitle(stats.level) : null;

  return (
    <div className="flex flex-col pb-32">
      {/* ── Header ── */}
      <header className="sticky top-0 z-2 backdrop-blur-md px-4 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/settings")}
            className="flex size-10 items-center justify-center rounded-full bg-gray-100"
            aria-label="設定"
          >
            <span className="material-symbols-outlined text-xl text-gray-600">
              settings
            </span>
          </button>
          <h1 className="text-lg font-bold text-center">マイページ</h1>
          <button
            onClick={() => {/* TODO: 共有機能 */}}
            className="flex size-10 items-center justify-center rounded-full bg-gray-100 btn-unimplemented"
            aria-label="共有"
            disabled
          >
            <span className="material-symbols-outlined text-xl text-gray-600">
              share
            </span>
          </button>
        </div>
      </header>

      {/* ── Profile Section ── */}
      <div className="flex flex-col items-center px-4 pt-8 pb-4">
        {/* アバター（レベルバッジ付き） */}
        <div className="relative">
          <div className="size-28 rounded-full border-4 border-primary p-1 bg-white overflow-hidden shadow-xl">
            {user.avatar_url ? (
              <img
                alt="ユーザーアイコン"
                className="w-full h-full object-cover rounded-full"
                src={user.avatar_url}
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-gray-400">
                  person
                </span>
              </div>
            )}
          </div>
          {stats && (
            <div className="absolute bottom-0 right-0 bg-primary text-black text-[10px] font-black px-2 py-1 rounded-full border-2 border-white shadow">
              LV.{stats.level}
            </div>
          )}
        </div>

        {/* 名前・称号 */}
        <div className="mt-4 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight">
            {user.display_name}
          </h2>
          {isLoading ? (
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mt-1 mx-auto" />
          ) : levelTitle ? (
            <p className="text-primary font-bold text-sm mt-1">
              レベル{stats?.level}: {levelTitle}
            </p>
          ) : null}
        </div>

      </div>

      {/* ── XP プログレスバー ── */}
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          </div>
        ) : stats && levelInfo ? (
          <>
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-bold text-gray-500">現在のXP</span>
              <span className="text-sm font-bold text-primary">
                {stats.total_xp} / {stats.total_xp + levelInfo.xpToNextLevel} XP
              </span>
            </div>
            <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(19,236,236,0.5)]"
                style={{ width: `${Math.min(levelInfo.progressPercent, 100)}%` }}
              />
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              {levelInfo.isMaxLevel
                ? "最大レベルに到達しました！"
                : `次のレベルまであと ${levelInfo.xpToNextLevel} XP`}
            </p>
          </>
        ) : null}
      </div>

      {/* ── Quick Menu (探索履歴 / ランキング) ── */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        <a
          href="/history"
          className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-transform border-l-4 border-l-primary"
        >
          <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">
              history
            </span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Activity
            </p>
            <p className="font-bold text-sm text-gray-800">探索履歴</p>
          </div>
        </a>
        <button
          onClick={() => {/* TODO: ランキング機能 */}}
          className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-transform btn-unimplemented"
          disabled
        >
          <div className="size-10 rounded-full bg-amber-400/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-500 text-xl">
              trophy
            </span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Rank
            </p>
            <p className="font-bold text-sm text-gray-800">ランキング</p>
          </div>
        </button>
      </div>

      {/* ── 脱却チャレンジ統計 ── */}
      {!isLoading && stats && (
        <div className="px-4 pb-2">
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Challenge Stats</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-extrabold text-primary">{stats.total_visits}</p>
                <p className="text-[10px] text-gray-500">総訪問</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-amber-500">{stats.challenge_visits}</p>
                <p className="text-[10px] text-gray-500">脱却チャレンジ</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-indigo-500">{stats.streak_count}</p>
                <p className="text-[10px] text-gray-500">週連続</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ジャンル熟練度トップ ── */}
      {!isLoading && proficiency.length > 0 && (
        <div className="px-4 py-4">
          <h3 className="text-base font-bold tracking-tight mb-3 px-1">得意ジャンル</h3>
          <div className="space-y-2">
            {proficiency.slice(0, 3).map((p) => (
              <div key={p.genre_tag_id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {p.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold truncate">{p.genre_name}</span>
                    <span className="text-xs font-bold text-primary ml-2 shrink-0">Lv.{p.level}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min((p.xp % 100) + (p.level > 1 ? 100 : 0), 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-mono shrink-0">{p.xp} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 獲得バッジ ── */}
      <div className="mx-4 px-4 py-4 bg-gray-50/50 mt-2 rounded-xl">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-base font-bold tracking-tight">獲得バッジ</h3>
          {!isLoading && (
            <span className="text-xs text-gray-500 font-bold bg-gray-200 px-2 py-1 rounded-full">
              {badges.length} 個
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="size-20 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-3 w-14 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : badges.length === 0 ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-4xl text-gray-300">military_tech</span>
            <p className="text-sm text-gray-400 mt-2">まだバッジがありません</p>
            <p className="text-xs text-gray-400">探索してバッジを獲得しましょう！</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {badges.map((badge) => {
              const { icon, color, border } = getBadgeIcon(badge.name);
              return (
                <div key={badge.id} className="flex flex-col items-center gap-2">
                  <div className={`size-20 rounded-full bg-white flex items-center justify-center shadow-md border-b-4 ${border}`}>
                    <span
                      className={`material-symbols-outlined text-4xl ${color}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {icon}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight">{badge.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 探索を開始 ── */}
      <div className="px-6 pt-6 pb-4">
        <a
          href="/home"
          className="w-full bg-primary text-black font-extrabold h-14 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-95 transition-transform"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            explore
          </span>
          探索を開始
        </a>
      </div>

      {/* ── Logout Button ── */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-40">
        <button
          onClick={() => setShowLogoutModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-full border border-red-200 text-red-500 font-bold text-sm transition-colors active:bg-red-50"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          ログアウト
        </button>
      </div>

      {/* ── Logout Confirmation Modal ── */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 mx-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-center mb-2c text-black">
              ログアウトしますか？
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              利用の際には再ログインが必要になります
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 rounded-full border border-gray-200 font-bold text-sm text-gray-600 transition-colors active:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 py-3 rounded-full bg-red-500 text-white font-bold text-sm transition-colors active:bg-red-600 disabled:opacity-50"
              >
                {isLoggingOut ? "処理中..." : "ログアウトする"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
