import { useState } from "react";
import type { Route } from "./+types/settings";
import { redirect, useNavigate } from "react-router";
import { getToken, getUser, clearToken } from "~/lib/auth";
import { updateDisplayName, deleteAccount } from "~/api/users";
import { getGenreTags, getInterests, updateInterests } from "~/api/genres";
import type { GenreTag, Interest } from "~/types/genre";

type TabId = "user" | "suggestion";

const INPUT_CLASS =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors";
const SUBMIT_CLASS =
  "w-full py-3 rounded-full bg-primary text-black font-bold text-sm transition-colors active:scale-95 disabled:opacity-50";

function FormMessage({ success, error }: { success?: string; error?: string }) {
  if (success) {
    return (
      <p className="text-sm text-green-600 flex items-center gap-1">
        <span className="material-symbols-outlined text-base">check_circle</span>
        {success}
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-red-500 flex items-center gap-1">
        <span className="material-symbols-outlined text-base">error</span>
        {error}
      </p>
    );
  }
  return null;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "user", label: "ユーザー情報", icon: "person" },
  { id: "suggestion", label: "提案設定", icon: "tune" },
];

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const [user, genres, interests] = await Promise.all([
    getUser(token),
    getGenreTags(token),
    getInterests(token),
  ]);
  return { user, token, genres, interests };
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { user, token, genres, interests } = loaderData;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("user");

  return (
    <div className="flex flex-col pb-32">
      {/* Header */}
      <header className="sticky top-0 z-2 backdrop-blur-md px-4 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-gray-100"
            aria-label="戻る"
          >
            <span className="material-symbols-outlined text-xl text-gray-600">
              arrow_back
            </span>
          </button>
          <h1 className="text-lg font-bold text-center">設定</h1>
          <div className="size-10" />
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="px-4 pt-4" role="tablist">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 py-6" role="tabpanel">
        {activeTab === "user" && (
          <UserInfoTab token={token} user={user} />
        )}
        {activeTab === "suggestion" && (
          <SuggestionTab
            token={token}
            genres={genres}
            initialInterests={interests}
          />
        )}
      </div>
    </div>
  );
}

// === ユーザー情報タブ ===
function UserInfoTab({
  token,
  user,
}: {
  token: string;
  user: { display_name: string };
}) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user.display_name);
  const [displayNameMsg, setDisplayNameMsg] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleUpdateDisplayName(e: React.FormEvent) {
    e.preventDefault();
    setDisplayNameMsg("");
    setDisplayNameError("");

    if (!displayName.trim()) {
      setDisplayNameError("表示名を入力してください");
      return;
    }

    setIsUpdatingName(true);
    try {
      await updateDisplayName(token, displayName.trim());
      setDisplayNameMsg("表示名を変更しました");
    } catch {
      setDisplayNameError("表示名の変更に失敗しました");
    } finally {
      setIsUpdatingName(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      await deleteAccount(token);
      clearToken();
      navigate("/login", { replace: true });
    } catch {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 表示名変更セクション */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            badge
          </span>
          表示名の変更
        </h2>
        <form onSubmit={handleUpdateDisplayName} className="space-y-4">
          <div>
            <label
              htmlFor="display-name"
              className="block text-sm font-medium text-gray-600 mb-1"
            >
              表示名
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={INPUT_CLASS}
              placeholder="表示名を入力"
            />
          </div>
          <FormMessage success={displayNameMsg} error={displayNameError} />
          <button
            type="submit"
            disabled={isUpdatingName}
            className={SUBMIT_CLASS}
          >
            {isUpdatingName ? "変更中..." : "表示名を変更"}
          </button>
        </form>
      </section>

      {/* アカウント削除セクション */}
      <section className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
        <h2 className="text-base font-bold text-red-600 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500 text-xl">
            warning
          </span>
          アカウントの削除
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消せません。
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full py-3 rounded-full bg-red-500 text-white font-bold text-sm transition-colors active:scale-95 hover:bg-red-600"
        >
          アカウントを削除
        </button>
      </section>

      {/* 削除確認モーダル */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              本当にアカウントを削除しますか？
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              すべての訪問記録・バッジ・設定が完全に削除されます。この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-full border border-gray-200 text-gray-600 font-bold text-sm transition-colors active:scale-95"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-full bg-red-500 text-white font-bold text-sm transition-colors active:scale-95 hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === 提案設定タブ ===
function SuggestionTab({
  token,
  genres,
  initialInterests,
}: {
  token: string;
  genres: GenreTag[];
  initialInterests: Interest[];
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    initialInterests.map((i) => i.genre_tag_id)
  );
  const [interestMsg, setInterestMsg] = useState("");
  const [interestError, setInterestError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function toggleGenre(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSaveInterests(e: React.FormEvent) {
    e.preventDefault();
    setInterestMsg("");
    setInterestError("");

    setIsSaving(true);
    try {
      await updateInterests(token, selectedIds);
      setInterestMsg("興味タグを保存しました");
    } catch {
      setInterestError("興味タグの保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            interests
          </span>
          興味タグ
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          3つ以上選択してください。提案に反映されます。
        </p>
        <form onSubmit={handleSaveInterests} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => {
              const selected = selectedIds.includes(genre.id);
              return (
                <button
                  key={genre.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleGenre(genre.id)}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-all border ${
                    selected
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
          <FormMessage success={interestMsg} error={interestError} />
          <button
            type="submit"
            disabled={selectedIds.length < 3 || isSaving}
            className={SUBMIT_CLASS}
          >
            {isSaving ? "保存中..." : "興味タグを保存"}
          </button>
        </form>
      </section>
    </div>
  );
}

