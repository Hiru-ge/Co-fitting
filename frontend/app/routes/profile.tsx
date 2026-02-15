import { useState, useEffect, useCallback } from "react";
import type { Route } from "./+types/profile";
import { redirect, useNavigate } from "react-router";
import { getToken, getUser, logout } from "~/lib/auth";
import { listVisits } from "~/api/visits";
import { toUserMessage } from "~/utils/error";
import { useToast } from "~/components/toast";
import { formatDate } from "~/utils/helpers";

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
  const [totalVisits, setTotalVisits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listVisits(token, 1, 0);
      setTotalVisits(data.total);
    } catch (err) {
      setTotalVisits(0);
      showToast(toUserMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      navigate("/login", { replace: true });
    }
  }

  const startDate = user.created_at
    ? (() => {
        const d = new Date(user.created_at);
        return `${d.getFullYear()}年${d.getMonth() + 1}月`;
      })()
    : "—";

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
            className="flex size-10 items-center justify-center rounded-full bg-gray-100"
            aria-label="共有"
          >
            <span className="material-symbols-outlined text-xl text-gray-600">
              share
            </span>
          </button>
        </div>
      </header>

      {/* ── Profile Section ── */}
      <div className="flex flex-col items-center px-4 pt-8 pb-4">
        {/* アバター */}
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

        {/* 名前 */}
        <div className="mt-4 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight">
            {user.display_name}
          </h2>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
        </div>

        {/* 統計（訪問スポット数・利用開始） */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500">訪問スポット</span>
            {isLoading ? (
              <div className="h-7 w-10 bg-gray-200 rounded animate-pulse mt-0.5" />
            ) : (
              <span className="font-bold text-lg">{totalVisits ?? 0} スポット</span>
            )}
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500">利用開始</span>
            <span className="font-bold text-lg">{startDate}</span>
          </div>
        </div>
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
          className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-transform opacity-60"
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
