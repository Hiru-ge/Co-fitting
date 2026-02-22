import { useState } from "react";
import { redirect, useNavigate } from "react-router";
import type { Route } from "./+types/onboarding";
import { getToken } from "~/lib/auth";
import { getGenreTags, getInterests, updateInterests } from "~/api/genres";
import type { GenreTag } from "~/types/genre";

export async function clientLoader(_: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");

  const [genres, interests] = await Promise.all([
    getGenreTags(token),
    getInterests(token),
  ]);

  if (interests.length >= 3) {
    throw redirect("/home");
  }

  return {
    token,
    genres,
    selectedIds: interests.map((i) => i.genre_tag_id),
  };
}

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  const { token, genres, selectedIds: initialSelectedIds } = loaderData;
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (selectedIds.length < 3 || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateInterests(token, selectedIds);
      navigate("/home");
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSkip() {
    navigate("/home");
  }

  // カテゴリ別にグループ化
  const grouped = genres.reduce(
    (acc, genre) => {
      if (!acc[genre.category]) acc[genre.category] = [];
      acc[genre.category].push(genre);
      return acc;
    },
    {} as Record<string, GenreTag[]>
  );

  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col px-4 py-8">
      <div className="text-center mb-6 space-y-1">
        <p className="text-3xl font-bold font-display-alt text-primary mb-2">
          Roamble
        </p>
        <h1 className="text-xl font-bold text-primary">
          興味のあるジャンルを選ぼう
        </h1>
        <p className="text-sm text-gray-400">
          3つ以上選択してください。<br/>あなたに合った場所を提案します。
        </p>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5 mb-4">
        {Object.entries(grouped).map(([category, tags]) => (
          <div key={category}>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">
              {category}
            </h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = selectedIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    aria-pressed={isSelected}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      isSelected
                        ? "bg-primary text-bg-dark border-primary"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:border-primary/60"
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <button
          onClick={handleSave}
          disabled={selectedIds.length < 3 || isSubmitting}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-bg-dark transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isSubmitting
            ? "保存中..."
            : `選択して始める (${selectedIds.length})`}
        </button>
        <button
          onClick={handleSkip}
          className="w-full rounded-md border border-gray-200 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors bg-white"
        >
          スキップ
        </button>
      </div>
    </div>
  );
}
