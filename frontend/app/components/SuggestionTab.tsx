import { useState } from "react";
import { updateInterests, updateSearchRadius } from "~/api/users";
import { sendInterestsUpdated, sendSearchRadiusUpdated } from "~/lib/gtag";
import type { GenreTag, Interest } from "~/types/genre";
import FormMessageDisplay from "~/components/FormMessageDisplay";
import LocationPermissionSection from "~/components/LocationPermissionSection";
import { useFormMessage } from "~/hooks/use-form-message";

const SUBMIT_CLASS = "settings-submit";

// 提案半径スライダーの設定（メートル単位）
const RADIUS_MIN = 3000;
const RADIUS_MAX = 30000;
const RADIUS_STEP = 1000;

interface SuggestionTabProps {
  authToken: string;
  genres: GenreTag[];
  initialInterests: Interest[];
  initialRadius: number;
}

function RefreshSuggestionsModal({
  onClose,
  onConfirm,
  isSaving,
}: {
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-gray-200 mb-2">
          提案が更新されます
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          設定を保存すると、新しい設定で提案が更新されます。リロード1回分を消費します。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full border border-gray-700 text-gray-300 font-bold text-sm transition-colors active:scale-95"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1 py-3 rounded-full bg-primary text-black font-bold text-sm transition-colors active:scale-95 disabled:opacity-50"
          >
            {isSaving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuggestionTab({
  authToken,
  genres,
  initialInterests,
  initialRadius,
}: SuggestionTabProps) {
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>(
    initialInterests.map((i) => i.genre_tag_id),
  );
  const interestForm = useFormMessage();
  const [isSaving, setIsSaving] = useState(false);

  const [selectedRadius, setSelectedRadius] = useState<number>(initialRadius);
  const radiusForm = useFormMessage();
  const [isSavingRadius, setIsSavingRadius] = useState(false);

  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [pendingSave, setPendingSave] = useState<"interests" | "radius" | null>(
    null,
  );

  function updateSelectedGenres(id: number) {
    setSelectedGenreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function saveInterests(withRefresh: boolean) {
    setIsSaving(true);
    try {
      await updateInterests(authToken, selectedGenreIds, withRefresh);
      sendInterestsUpdated(selectedGenreIds.length);
      interestForm.setMsg(
        withRefresh
          ? "興味ジャンルを保存しました"
          : "設定は保存されました。提案は明日リセット時に反映されます",
      );
    } catch {
      interestForm.setError("興味ジャンルの保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRadius(withRefresh: boolean) {
    setIsSavingRadius(true);
    try {
      await updateSearchRadius(authToken, selectedRadius, withRefresh);
      sendSearchRadiusUpdated(selectedRadius / 1000);
      radiusForm.setMsg(
        withRefresh
          ? "提案半径を保存しました"
          : "設定は保存されました。提案は明日リセット時に反映されます",
      );
    } catch {
      radiusForm.setError("提案半径の保存に失敗しました");
    } finally {
      setIsSavingRadius(false);
    }
  }

  async function handleSaveInterests(e: React.FormEvent) {
    e.preventDefault();
    interestForm.reset();
    setPendingSave("interests");
    setShowRefreshModal(true);
  }

  async function handleSaveRadius(e: React.FormEvent) {
    e.preventDefault();
    radiusForm.reset();
    setPendingSave("radius");
    setShowRefreshModal(true);
  }

  async function handleConfirmRefresh() {
    setShowRefreshModal(false);
    if (pendingSave === "interests") {
      await saveInterests(true);
    } else if (pendingSave === "radius") {
      await saveRadius(true);
    }
    setPendingSave(null);
  }

  return (
    <div className="space-y-6">
      <LocationPermissionSection />

      <section className="bg-white/5 rounded-2xl border border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-200 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            radar
          </span>
          提案半径
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          現在地からどの範囲の施設を提案するか設定します。
        </p>
        <form onSubmit={handleSaveRadius} className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">
                {RADIUS_MIN / 1000}km
              </span>
              <span className="text-lg font-bold text-primary">
                {selectedRadius / 1000}km
              </span>
              <span className="text-xs text-gray-400">
                {RADIUS_MAX / 1000}km
              </span>
            </div>
            <input
              type="range"
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={RADIUS_STEP}
              value={selectedRadius}
              onChange={(e) => setSelectedRadius(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="提案半径"
            />
          </div>
          <FormMessageDisplay
            success={radiusForm.msg}
            error={radiusForm.error}
          />
          <button
            type="submit"
            disabled={isSavingRadius}
            className={SUBMIT_CLASS}
          >
            {isSavingRadius ? "保存中..." : "半径を保存"}
          </button>
        </form>
      </section>

      <section className="bg-white/5 rounded-2xl border border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-200 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            interests
          </span>
          興味ジャンル
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          3つ以上選択してください。提案に反映されます。
        </p>
        <form onSubmit={handleSaveInterests} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => {
              const selected = selectedGenreIds.includes(genre.id);
              return (
                <button
                  key={genre.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateSelectedGenres(genre.id)}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-all border ${
                    selected
                      ? "bg-primary text-bg-dark border-primary"
                      : "bg-white/10 border-gray-600 text-gray-200 hover:bg-white/20 hover:border-primary/60"
                  }`}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
          <FormMessageDisplay
            success={interestForm.msg}
            error={interestForm.error}
          />
          <button
            type="submit"
            disabled={selectedGenreIds.length < 3 || isSaving}
            className={SUBMIT_CLASS}
          >
            {isSaving ? "保存中..." : "興味ジャンルを保存"}
          </button>
        </form>
      </section>

      {showRefreshModal && (
        <RefreshSuggestionsModal
          onClose={() => {
            setShowRefreshModal(false);
            setPendingSave(null);
          }}
          onConfirm={handleConfirmRefresh}
          isSaving={isSaving || isSavingRadius}
        />
      )}
    </div>
  );
}
