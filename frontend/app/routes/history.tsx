import { useState, useEffect, useCallback } from "react";
import type { Route } from "./+types/history";
import { redirect, useNavigate } from "react-router";
import { getToken, getUser } from "~/lib/auth";
import { listVisits } from "~/api/visits";
import type { Visit } from "~/types/visit";
import { formatShortDate, groupByMonth } from "~/utils/helpers";
import { API_BASE_URL } from "~/utils/constants";

const ITEMS_PER_PAGE = 20;

const FILTER_CATEGORIES = [
  { key: "all", label: "すべて", icon: null },
  { key: "cafe", label: "カフェ", icon: "coffee" },
  { key: "park", label: "公園", icon: "park" },
  { key: "tourist_attraction", label: "観光", icon: "photo_camera" },
  { key: "restaurant", label: "飲食店", icon: "restaurant" },
  { key: "store", label: "ショップ", icon: "storefront" },
] as const;

type VisitWithPhoto = Visit & { photoUrl?: string };

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const user = await getUser(token);
  return { user, token };
}

export default function History({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;
  const navigate = useNavigate();
  const [visits, setVisits] = useState<VisitWithPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const loadVisits = useCallback(
    async (offset = 0, append = false) => {
      if (!append) setIsLoading(true);
      else setIsLoadingMore(true);

      try {
        const data = await listVisits(token, ITEMS_PER_PAGE, offset);
        const visitsWithPhotos = await loadPhotos(data.visits, token);

        if (append) {
          setVisits((prev) => [...prev, ...visitsWithPhotos]);
        } else {
          setVisits(visitsWithPhotos);
        }
        setTotal(data.total);
      } catch {
        // エラー時は空のまま
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  function handleLoadMore() {
    if (isLoadingMore || visits.length >= total) return;
    loadVisits(visits.length, true);
  }

  const filteredVisits =
    activeFilter === "all"
      ? visits
      : visits.filter((v) =>
          v.place_name.toLowerCase().includes(activeFilter)
        );

  const grouped = groupByMonth(filteredVisits, (v) => v.visited_at);

  return (
    <div className="flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-2 backdrop-blur-md px-4 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center -ml-2 p-2 rounded-full active:bg-gray-100"
            >
              <span className="material-symbols-outlined text-2xl">
                arrow_back_ios_new
              </span>
            </button>
            <h1 className="text-2xl font-bold tracking-tight">
              これまでの旅路
            </h1>
          </div>
          <button className="flex items-center justify-center size-10 rounded-full">
            <span className="material-symbols-outlined text-xl font-bold">
              search
            </span>
          </button>
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTER_CATEGORIES.map(({ key, label, icon }) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 transition-colors ${
                  isActive
                    ? "bg-primary-purple text-white"
                    : "bg-bg-light-purple text-text-main-purple"
                }`}
              >
                {icon && (
                  <span className="material-symbols-outlined text-lg">
                    {icon}
                  </span>
                )}
                <span className="text-sm font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Content ── */}
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
              <span className="material-symbols-outlined text-6xl text-gray-300">
                explore
              </span>
              <p className="text-gray-400 text-center text-sm">
                まだ訪問記録がありません
                <br />
                新しい場所を発見しに行きましょう！
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

              {visits.length < total && (
                <div className="flex justify-center pb-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="px-6 py-2 rounded-full bg-bg-light-purple text-text-main-purple text-sm font-medium transition-opacity disabled:opacity-50"
                  >
                    {isLoadingMore ? "読み込み中..." : "もっと見る"}
                  </button>
                </div>
              )}
            </>
          )}
          <div className="h-10" />
        </main>
      )}
    </div>
  );
}

function VisitHistoryItem({ visit }: { visit: VisitWithPhoto }) {
  return (
    <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-gray-100 shadow-sm transition-transform active:scale-[0.98]">
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
            <span className="material-symbols-outlined text-3xl">
              photo_camera
            </span>
          </div>
        )}
      </div>

      {/* テキスト情報 */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex justify-between items-start">
          <p className="text-text-main-purple text-base font-bold truncate">
            {visit.place_name}
          </p>
        </div>
        <p className="text-[#75608a] text-xs mt-0.5">
          {/* エリア表示 */}
          {latLngToArea(visit.lat, visit.lng)}
        </p>
        <div className="flex items-center gap-1 mt-2 text-[#75608a]">
          <span className="material-symbols-outlined text-xs">
            calendar_today
          </span>
          <p className="text-xs font-medium">
            {formatShortDate(visit.visited_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 緯度・経度から簡易的なエリア表示を生成する。
 * Phase 1 で逆ジオコーディングに置き換え予定。
 */
function latLngToArea(lat: number, lng: number): string {
  if (lat === 0 && lng === 0) return "";
  return `${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`;
}

async function loadPhotos(
  visits: Visit[],
  token: string
): Promise<VisitWithPhoto[]> {
  return Promise.all(
    visits.map(async (visit) => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/places/${visit.place_id}/photo`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const json = await res.json();
          return { ...visit, photoUrl: json.photo_url };
        }
      } catch {
        // 写真取得失敗はスキップ
      }
      return visit;
    })
  );
}
