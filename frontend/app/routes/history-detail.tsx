import { useState, useEffect, useCallback } from "react";
import { redirect, useNavigate } from "react-router";
import { getToken, getUser } from "~/lib/auth";
import { getVisit, updateVisit } from "~/api/visits";
import { toUserMessage } from "~/utils/error";
import { useToast } from "~/components/toast";
import { formatDate } from "~/utils/helpers";
import { getCategoryInfoByKey } from "~/utils/category-map";
import { apiCall } from "~/api/client";
import type { Visit } from "~/types/visit";

// React Router v7 の型は +types/ から自動生成される想定だが、
// worktreeではまだ生成されていないためinlineで型を定義する
interface LoaderData {
  user: Awaited<ReturnType<typeof getUser>>;
  token: string;
  visitId: number;
}

interface ComponentProps {
  loaderData: LoaderData;
  params: Record<string, string | undefined>;
  matches: unknown[];
}

export async function clientLoader({
  params,
}: {
  params: Record<string, string | undefined>;
}) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const user = await getUser(token);

  const visitId = Number(params.id);
  if (!params.id || isNaN(visitId) || visitId <= 0) {
    throw redirect("/history");
  }

  return { user, token, visitId };
}

export default function HistoryDetail({ loaderData }: ComponentProps) {
  const { token, visitId } = loaderData;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [memo, setMemo] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const loadVisit = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getVisit(token, visitId);
      setVisit(data);
      setMemo(data.memo ?? "");
      setRating(data.rating ?? null);

      // 写真を取得
      try {
        const json = await apiCall(`/api/places/${data.place_id}/photo`, token);
        setPhotoUrl(json.photo_url);
      } catch {
        // 写真取得失敗はスキップ
      }
    } catch (err) {
      showToast(toUserMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [token, visitId, showToast]);

  useEffect(() => {
    loadVisit();
  }, [loadVisit]);

  const handleSave = async () => {
    if (!visit) return;
    setIsSaving(true);
    try {
      const updated = await updateVisit(token, visitId, {
        memo: memo || null,
        rating: rating ?? null,
      });
      setVisit(updated);
      setMemo(updated.memo ?? "");
      setRating(updated.rating ?? null);
      showToast("保存しました", "success");
    } catch (err) {
      showToast(toUserMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SkeletonLoader />;
  }

  if (!visit) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-outlined text-6xl text-gray-300">
          error_outline
        </span>
        <p className="text-gray-400 text-sm">訪問記録が見つかりません</p>
        <button
          onClick={() => navigate(-1)}
          aria-label="戻る"
          className="px-6 py-2 rounded-full bg-bg-light-purple text-text-main-purple text-sm font-medium"
        >
          戻る
        </button>
      </div>
    );
  }

  const categoryInfo = getCategoryInfoByKey(visit.category);

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 backdrop-blur-md px-4 pt-6 pb-4 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              aria-label="戻る"
              className="flex items-center justify-center -ml-2 p-2 rounded-full active:bg-gray-100"
            >
              <span className="material-symbols-outlined text-2xl">
                arrow_back_ios_new
              </span>
            </button>
            <h1 className="text-xl font-bold tracking-tight truncate max-w-48">
              訪問詳細
            </h1>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-6 px-4 pt-6 pb-20">
        {/* ── 場所情報カード ── */}
        <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm overflow-hidden">
          {/* 写真 */}
          <div
            className="w-full h-48 bg-gray-200 dark:bg-gray-700 bg-center bg-cover bg-no-repeat"
            style={
              photoUrl
                ? { backgroundImage: `url("${photoUrl}")` }
                : undefined
            }
          >
            {!photoUrl && (
              <div className="flex items-center justify-center h-full text-gray-400">
                <span className="material-symbols-outlined text-5xl">
                  photo_camera
                </span>
              </div>
            )}
          </div>

          {/* 詳細情報 */}
          <div className="p-4 space-y-3 text-gray-600 dark:text-gray-200">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">
                  {visit.place_name}
                </h2>
                <p className="text-sm mt-0.5">{visit.vicinity}</p>
              </div>
              {visit.xp_earned > 0 && (
                <span className="shrink-0 text-primary font-bold text-sm">
                  +{visit.xp_earned} XP
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">
                  calendar_today
                </span>
                <span>{formatDate(visit.visited_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">
                  {categoryInfo.icon}
                </span>
                <span>{categoryInfo.label}</span>
              </div>
              {visit.is_comfort_zone && (
                <div className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-sm">
                    emoji_events
                  </span>
                  <span>コンフォートゾーン脱却</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 評価 ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold">評価</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() =>
                  setRating((prev) => (prev === star ? null : star))
                }
                aria-label={`★${star}`}
                aria-pressed={rating !== null && rating >= star}
                className={`text-3xl transition-colors ${
                  rating !== null && rating >= star
                    ? "text-yellow-400"
                    : "text-gray-200 dark:text-gray-600"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* ── 感想メモ ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold">感想メモ</h3>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="どんな体験でしたか？"
            rows={5}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-text-main-purple placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-purple/30 focus:border-primary resize-none"
          />
        </div>

        {/* 保存ボタン */}
        <div className="space-y-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 rounded-full bg-primary text-white font-extrabold disabled:opacity-50 transition-opacity"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </main>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="flex flex-col animate-pulse">
      <header className="px-4 pt-6 pb-4 border-b border-gray-100 dark:border-white/10">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32" />
      </header>
      <main className="flex flex-col gap-6 px-4 pt-6">
        <div className="rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="w-full h-48 bg-gray-200 dark:bg-gray-700" />
          <div className="p-4 space-y-3">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="size-8 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </main>
    </div>
  );
}
