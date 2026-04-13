import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "~/components/Icon";
import type { Route } from "./+types/history";
import { useNavigate, Link } from "react-router";
import { authRequiredLoader } from "~/lib/auth";
import { RouteErrorBoundary } from "~/components/RouteErrorBoundary";
import { listVisits, getMapVisits } from "~/api/visits";
import { toUserMessage } from "~/utils/error";
import { useToast } from "~/components/Toast";
import type { Visit, MapVisit } from "~/types/visit";
import { formatShortDate, groupByMonth } from "~/utils/date";
import { getCategoryInfo } from "~/lib/category-map";
import { getPlacePhoto } from "~/api/places";
import VisitMap from "~/components/VisitMap";

type ViewMode = "list" | "map";
type VisitWithPhoto = Visit & { photoUrl?: string };

type HistoryCategoryFilter = {
  label: string;
  info: ReturnType<typeof getCategoryInfo>;
};

export { authRequiredLoader as clientLoader };
export { RouteErrorBoundary as ErrorBoundary };
const PHOTO_BATCH_SIZE = 5;

async function loadPhotos(
  visits: Visit[],
  token: string,
): Promise<VisitWithPhoto[]> {
  const results: VisitWithPhoto[] = [];

  for (let i = 0; i < visits.length; i += PHOTO_BATCH_SIZE) {
    const batch = visits.slice(i, i + PHOTO_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (visit) => {
        if (!visit.photo_reference) return visit;
        try {
          const photoUrl = await getPlacePhoto(
            token,
            visit.place_id,
            visit.photo_reference,
          );
          return { ...visit, photoUrl };
        } catch {
          // 写真取得失敗はスキップ
        }
        return visit;
      }),
    );
    results.push(...batchResults);
  }

  return results;
}

function VisitHistoryItem({ visit }: { visit: VisitWithPhoto }) {
  return (
    <Link
      to={`/history/${visit.id}`}
      className="flex items-center gap-4 bg-white/10 p-3 rounded-lg border border-white/10 shadow-sm transition-transform active:scale-[0.98]"
    >
      {/* サムネイル */}
      <div
        className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-20 shrink-0 bg-gray-200"
        style={
          visit.photoUrl
            ? { backgroundImage: `url("${visit.photoUrl}")` }
            : undefined
        }
      >
        {!visit.photoUrl && (
          <div className="flex items-center justify-center size-full text-gray-400">
            <Icon name="photo_camera" className="text-3xl" />
          </div>
        )}
      </div>

      {/* テキスト情報 */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex justify-between items-start">
          <p className="text-white text-base font-bold truncate">
            {visit.place_name}
          </p>
        </div>
        <p className="text-gray-400 text-xs mt-0.5">{visit.vicinity}</p>
        <div className="flex items-center gap-1 mt-2 text-gray-400">
          <Icon name="calendar_today" className="text-xs" />
          <p className="text-xs font-medium">
            {formatShortDate(visit.visited_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function History({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [visits, setVisits] = useState<VisitWithPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [mapVisits, setMapVisits] = useState<MapVisit[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // DBから取得した訪問履歴から表示ラベルごとのユニークなカテゴリーを抽出
  const availableCategoryFilters = useMemo<HistoryCategoryFilter[]>(() => {
    const categories = new Map<string, HistoryCategoryFilter>();
    visits.forEach((visit) => {
      const info = getCategoryInfo(visit.category);
      if (!categories.has(info.label)) {
        categories.set(info.label, { label: info.label, info });
      }
    });
    return Array.from(categories.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "ja"),
    );
  }, [visits]);

  useEffect(() => {
    let isMounted = true;

    async function loadVisits() {
      setIsLoading(true);

      try {
        const data = await listVisits(token, 100, 0);
        const visitsWithPhotos = await loadPhotos(data.visits, token);
        if (isMounted) {
          setVisits(visitsWithPhotos);
        }
      } catch (err) {
        if (isMounted) {
          showToast(toUserMessage(err));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadVisits();

    return () => {
      isMounted = false;
    };
  }, [token, showToast]);

  // マップタブ選択時に初回のみマップデータをロード
  const handleSwitchToMap = useCallback(async () => {
    setViewMode("map");
    if (!isMapLoaded) {
      try {
        const data = await getMapVisits(token);
        setMapVisits(data.visits);
        setIsMapLoaded(true);
      } catch (err) {
        showToast(toUserMessage(err));
      }
    }
  }, [token, isMapLoaded, showToast]);

  const filteredVisits =
    activeFilter === "all"
      ? visits
      : visits.filter(
          (v) => getCategoryInfo(v.category).label === activeFilter,
        );

  const grouped = groupByMonth(filteredVisits, (v) => v.visited_at);

  return (
    <div className="flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-2 backdrop-blur-md px-4 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center -ml-2 p-2 rounded-full active:bg-gray-100"
            >
              <Icon name="arrow_back_ios_new" className="text-2xl" />
            </button>
            <h1 className="text-2xl font-bold tracking-tight">
              これまでの旅路
            </h1>
          </div>
          <div className="size-10" />
        </div>

        {/* ── View mode tab ── */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setViewMode("list")}
            aria-label="リスト表示"
            className={`flex items-center gap-1.5 flex-1 justify-center h-9 rounded-full text-sm font-medium transition-colors ${
              viewMode === "list"
                ? "bg-primary-purple text-white"
                : "bg-white/10 text-white/70"
            }`}
          >
            <Icon name="list" className="text-base" />
            <span>リスト</span>
          </button>
          <button
            onClick={handleSwitchToMap}
            aria-label="マップ表示"
            className={`flex items-center gap-1.5 flex-1 justify-center h-9 rounded-full text-sm font-medium transition-colors ${
              viewMode === "map"
                ? "bg-primary-purple text-white"
                : "bg-white/10 text-white/70"
            }`}
          >
            <Icon name="map" className="text-base" />
            <span>マップ</span>
          </button>
        </div>

        {/* ── Filter tabs (リスト時のみ表示) ── */}
        {viewMode === "list" && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {/* "すべて" ボタン */}
            <button
              onClick={() => setActiveFilter("all")}
              className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 transition-colors ${
                activeFilter === "all"
                  ? "bg-primary-purple text-white"
                  : "bg-white/10 text-white/70"
              }`}
            >
              <span className="text-sm font-medium">すべて</span>
            </button>

            {/* 動的カテゴリーボタン */}
            {availableCategoryFilters.map(({ label, info }) => {
              const isActive = activeFilter === label;
              return (
                <button
                  key={label}
                  onClick={() => setActiveFilter(label)}
                  className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 transition-colors ${
                    isActive
                      ? "bg-primary-purple text-white"
                      : "bg-white/10 text-white/70"
                  }`}
                >
                  <Icon name={info.icon} className="text-lg" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── Map view ── */}
      {viewMode === "map" && (
        <div className="flex-1">
          <VisitMap visits={mapVisits} />
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === "list" && (
        <>
          {isLoading ? (
            <main className="px-4 pt-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 rounded-md border border-gray-100 animate-pulse"
                >
                  <div className="size-20 rounded-md bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </main>
          ) : (
            <main className="flex flex-col px-4 pt-6 space-y-8">
              {filteredVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Icon name="explore" className="text-6xl text-gray-300" />
                  <p className="text-gray-400 text-center text-sm">
                    まだ訪問記録がありません
                    <br />
                    新しいお店を開拓しに行きましょう！
                  </p>
                </div>
              ) : (
                <>
                  {Array.from(grouped.entries()).map(([month, items]) => (
                    <div key={month} className="space-y-4">
                      <h3 className="text-sm font-bold text-[#75608a] uppercase tracking-wider pl-1">
                        {month}
                      </h3>
                      {items.map((visit) => (
                        <VisitHistoryItem key={visit.id} visit={visit} />
                      ))}
                    </div>
                  ))}
                </>
              )}
              <div className="h-10" />
            </main>
          )}
        </>
      )}
    </div>
  );
}
