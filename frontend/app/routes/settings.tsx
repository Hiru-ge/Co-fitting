import { useState, useEffect } from "react";
import type { Route } from "./+types/settings";
import { useNavigate, Link } from "react-router";
import { clearToken } from "~/lib/auth";
import { protectedLoader } from "~/lib/protected-loader";
import { updateDisplayName, deleteAccount, updateSearchRadius } from "~/api/users";
import { getGenreTags, getInterests, updateInterests } from "~/api/genres";
import type { GenreTag, Interest } from "~/types/genre";
import { useModalClose } from "~/hooks/use-modal-close";
import { useFormMessage } from "~/hooks/use-form-message";
import { sendInterestsUpdated, sendSearchRadiusUpdated } from "~/lib/gtag";

type TabId = "user" | "suggestion";

const INPUT_CLASS =
  "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-black dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors";
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
  const { user, token } = await protectedLoader();
  const [genres, interests] = await Promise.all([
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
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-2 backdrop-blur-md px-4 pt-6 pb-4 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10"
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
        <div className="flex gap-1 bg-gray-100 dark:bg-white/10 rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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
            initialRadius={user.search_radius ?? 10000}
          />
        )}
      </div>
    </div>
  );
}

// 提案半径スライダーの設定（メートル単位）
const RADIUS_MIN = 3000;
const RADIUS_MAX = 30000;
const RADIUS_STEP = 1000;

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
  const { msg: displayNameMsg, error: displayNameError, setMsg: setDisplayNameMsg, setError: setDisplayNameError, reset: resetDisplayNameMsg } = useFormMessage();
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleUpdateDisplayName(e: React.FormEvent) {
    e.preventDefault();
    resetDisplayNameMsg();

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
      <section className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
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

      {/* プライバシーポリシー・法的情報 */}
      <section className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            policy
          </span>
          法的情報・サポート
        </h2>
        <Link
          to="/privacy"
          className="flex items-center justify-between py-3 text-sm text-gray-700 dark:text-gray-300 hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-gray-400">
              description
            </span>
            プライバシーポリシー
          </span>
          <span className="material-symbols-outlined text-lg text-gray-400">
            chevron_right
          </span>
        </Link>
        <div className="border-t border-gray-100 dark:border-white/10" />
        <a
          href="https://forms.gle/upcMz6uV97hmLn9n9"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between py-3 text-sm text-gray-700 dark:text-gray-300 hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-gray-400">
              feedback
            </span>
            お問い合わせ・フィードバック
          </span>
          <span className="material-symbols-outlined text-lg text-gray-400">
            open_in_new
          </span>
        </a>
      </section>

      {/* アカウント削除セクション */}
      <section className="bg-white dark:bg-white/5 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm p-5">
        <h2 className="text-base font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500 text-xl">
            warning
          </span>
          アカウントの削除
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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
        <DeleteAccountModal
          isDeleting={isDeleting}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  );
}

// === 位置情報許可セクション ===
function LocationPermissionSection() {
  const [permState, setPermState] = useState<PermissionState | "unsupported" | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (!navigator.permissions) {
      setPermState("unsupported");
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        setPermState(result.state);
        result.onchange = () => setPermState(result.state);
      })
      .catch(() => setPermState("unsupported"));
  }, []);

  async function handleRequestPermission() {
    setIsRequesting(true);
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(() => resolve(), reject, { timeout: 10000 });
      });
      setPermState("granted");
    } catch {
      // ユーザーが拒否した場合はpermissions APIのonchangeが発火するため再取得は不要
    } finally {
      setIsRequesting(false);
    }
  }

  // OSの判定（denied時の案内用）
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);

  const statusDisplay = () => {
    if (permState === null) return null;
    if (permState === "granted") {
      return (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
          <span className="material-symbols-outlined text-base">check_circle</span>
          許可済み — 現在地を使って提案しています
        </div>
      );
    }
    if (permState === "denied") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
            <span className="material-symbols-outlined text-base">location_off</span>
            拒否されています
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isIOS
              ? "「設定」→「プライバシーとセキュリティ」→「位置情報サービス」→「Safari Webサイト」から「このAppの使用中のみ許可」に変更してください。"
              : "ブラウザのアドレスバー左の鍵マーク（または情報アイコン）→「サイトの設定」→「位置情報」→「許可」に変更してください。"}
          </p>
        </div>
      );
    }
    if (permState === "unsupported") {
      return (
        <p className="text-sm text-gray-400">このブラウザは位置情報に対応していません。</p>
      );
    }
    // "prompt" state
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          まだ許可されていません。ボタンを押すとブラウザの確認ダイアログが表示されます。
        </p>
        <button
          type="button"
          onClick={handleRequestPermission}
          disabled={isRequesting}
          className="w-full py-3 rounded-full bg-primary text-black font-bold text-sm transition-colors active:scale-95 disabled:opacity-50"
        >
          {isRequesting ? "確認中..." : "位置情報を許可する"}
        </button>
      </div>
    );
  };

  return (
    <section className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
      <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-xl">my_location</span>
        位置情報
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        現在地をもとにスポットを提案します。許可しない場合はデフォルト位置（渋谷駅付近）が使われます。
      </p>
      {statusDisplay()}
    </section>
  );
}

// === 提案設定タブ ===
function SuggestionTab({
  token,
  genres,
  initialInterests,
  initialRadius,
}: {
  token: string;
  genres: GenreTag[];
  initialInterests: Interest[];
  initialRadius: number;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    initialInterests.map((i) => i.genre_tag_id)
  );
  const { msg: interestMsg, error: interestError, setMsg: setInterestMsg, setError: setInterestError, reset: resetInterestMsg } = useFormMessage();
  const [isSaving, setIsSaving] = useState(false);

  const [selectedRadius, setSelectedRadius] = useState<number>(initialRadius);
  const { msg: radiusMsg, error: radiusError, setMsg: setRadiusMsg, setError: setRadiusError, reset: resetRadiusMsg } = useFormMessage();
  const [isSavingRadius, setIsSavingRadius] = useState(false);

  function toggleGenre(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSaveInterests(e: React.FormEvent) {
    e.preventDefault();
    resetInterestMsg();

    setIsSaving(true);
    try {
      await updateInterests(token, selectedIds);
      sendInterestsUpdated(selectedIds.length);
      setInterestMsg("興味タグを保存しました");
    } catch {
      setInterestError("興味タグの保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveRadius(e: React.FormEvent) {
    e.preventDefault();
    resetRadiusMsg();

    setIsSavingRadius(true);
    try {
      await updateSearchRadius(token, selectedRadius);
      sendSearchRadiusUpdated(selectedRadius / 1000);
      setRadiusMsg("提案半径を保存しました");
    } catch {
      setRadiusError("提案半径の保存に失敗しました");
    } finally {
      setIsSavingRadius(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 位置情報セクション */}
      <LocationPermissionSection />

      {/* 提案半径セクション */}
      <section className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
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
              <span className="text-xs text-gray-400">{RADIUS_MIN / 1000}km</span>
              <span className="text-lg font-bold text-primary">
                {selectedRadius / 1000}km
              </span>
              <span className="text-xs text-gray-400">{RADIUS_MAX / 1000}km</span>
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
          <FormMessage success={radiusMsg} error={radiusError} />
          <button
            type="submit"
            disabled={isSavingRadius}
            className={SUBMIT_CLASS}
          >
            {isSavingRadius ? "保存中..." : "半径を保存"}
          </button>
        </form>
      </section>

      <section className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
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
                      ? "bg-primary text-bg-dark border-primary"
                      : "bg-gray-50 dark:bg-white/10 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/20 hover:border-primary/60"
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

function DeleteAccountModal({
  isDeleting,
  onClose,
  onConfirm,
}: {
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useModalClose(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
          本当にアカウントを削除しますか？
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          すべての訪問記録・バッジ・設定が完全に削除されます。この操作は取り消せません。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm transition-colors active:scale-95"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3 rounded-full bg-red-500 text-white font-bold text-sm transition-colors active:scale-95 hover:bg-red-600 disabled:opacity-50"
          >
            {isDeleting ? "削除中..." : "削除する"}
          </button>
        </div>
      </div>
    </div>
  );
}
