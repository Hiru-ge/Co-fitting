import { useState } from "react";
import { Icon } from "~/components/Icon";
import { Link, useNavigate } from "react-router";
import { clearToken } from "~/lib/auth";
import { deleteAccount, updateDisplayName } from "~/api/users";
import FormMessageDisplay from "~/components/FormMessageDisplay";
import { useFormMessage } from "~/hooks/use-form-message";

const INPUT_CLASS = "settings-input";
const SUBMIT_CLASS = "settings-submit";

interface UserInfoTabProps {
  authToken: string;
  user: { display_name: string };
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-gray-200 mb-2">
          本当にアカウントを削除しますか？
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          すべての訪問記録・バッジ・設定が完全に削除されます。この操作は取り消せません。
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

export default function UserInfoTab({ authToken, user }: UserInfoTabProps) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user.display_name);
  const displayNameForm = useFormMessage();
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleUpdateDisplayName(e: React.FormEvent) {
    e.preventDefault();
    displayNameForm.reset();

    if (!displayName.trim()) {
      displayNameForm.setError("表示名を入力してください");
      return;
    }

    setIsUpdatingName(true);
    try {
      await updateDisplayName(authToken, displayName.trim());
      displayNameForm.setMsg("表示名を変更しました");
    } catch {
      displayNameForm.setError("表示名の変更に失敗しました");
    } finally {
      setIsUpdatingName(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      await deleteAccount(authToken);
      clearToken();
      navigate("/login", { replace: true });
    } catch {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white/5 rounded-2xl border border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
          <Icon name="badge" className="text-primary text-xl" />
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
          <FormMessageDisplay
            success={displayNameForm.msg}
            error={displayNameForm.error}
          />
          <button
            type="submit"
            disabled={isUpdatingName}
            className={SUBMIT_CLASS}
          >
            {isUpdatingName ? "変更中..." : "表示名を変更"}
          </button>
        </form>
      </section>

      <section className="bg-white/5 rounded-2xl border border-white/10 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
          <Icon name="policy" className="text-primary text-xl" />
          法的情報・サポート
        </h2>
        <Link
          to="/privacy"
          className="flex items-center justify-between py-3 text-sm text-gray-300 hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-2">
            <Icon name="description" className="text-lg text-gray-400" />
            プライバシーポリシー
          </span>
          <Icon name="chevron_right" className="text-lg text-gray-400" />
        </Link>
        <div className="border-t border-white/10" />
        <a
          href="https://forms.gle/upcMz6uV97hmLn9n9"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between py-3 text-sm text-gray-300 hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-2">
            <Icon name="feedback" className="text-lg text-gray-400" />
            お問い合わせ・フィードバック
          </span>
          <Icon name="open_in_new" className="text-lg text-gray-400" />
        </a>
      </section>

      <section className="bg-white/5 rounded-2xl border border-red-900/30 shadow-sm p-5">
        <h2 className="text-base font-bold text-red-400 mb-2 flex items-center gap-2">
          <Icon name="warning" className="text-red-500 text-xl" />
          アカウントの削除
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消せません。
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full py-3 rounded-full bg-red-500 text-white font-bold text-sm transition-colors active:scale-95 hover:bg-red-600"
        >
          アカウントを削除
        </button>
      </section>

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
