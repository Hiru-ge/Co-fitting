import { useState } from "react";
import type { Route } from "./+types/settings";
import { redirect, useNavigate } from "react-router";
import { getToken, getUser } from "~/lib/auth";
import { updateDisplayName, changePassword } from "~/api/users";

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const token = getToken();
  if (!token) throw redirect("/login");
  const user = await getUser(token);
  return { user, token };
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { user, token } = loaderData;
  const navigate = useNavigate();

  // 表示名変更
  const [displayName, setDisplayName] = useState(user.display_name);
  const [displayNameMsg, setDisplayNameMsg] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // パスワード変更
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg("");
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("パスワードは8文字以上で入力してください");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("パスワードが一致しません");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePassword(token, currentPassword, newPassword);
      setPasswordMsg("パスワードを変更しました");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("パスワードの変更に失敗しました");
    } finally {
      setIsUpdatingPassword(false);
    }
  }

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

      <div className="px-4 py-6 space-y-8">
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
                className="w-full px-4 py-3 rounded-xl border text-black border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="表示名を入力"
              />
            </div>
            {displayNameMsg && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">
                  check_circle
                </span>
                {displayNameMsg}
              </p>
            )}
            {displayNameError && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">
                  error
                </span>
                {displayNameError}
              </p>
            )}
            <button
              type="submit"
              disabled={isUpdatingName}
              className="w-full py-3 rounded-full bg-primary text-black font-bold text-sm transition-colors active:scale-95 disabled:opacity-50"
            >
              {isUpdatingName ? "変更中..." : "表示名を変更"}
            </button>
          </form>
        </section>

        {/* パスワード変更セクション */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">
              lock
            </span>
            パスワードの変更
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label
                htmlFor="current-password"
                className="block text-sm font-medium text-gray-600 mb-1"
              >
                現在のパスワード
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="現在のパスワード"
              />
            </div>
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-gray-600 mb-1"
              >
                新しいパスワード
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="8文字以上"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-600 mb-1"
              >
                新しいパスワード（確認）
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="もう一度入力"
              />
            </div>
            {passwordMsg && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">
                  check_circle
                </span>
                {passwordMsg}
              </p>
            )}
            {passwordError && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">
                  error
                </span>
                {passwordError}
              </p>
            )}
            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="w-full py-3 rounded-full bg-primary text-black font-bold text-sm transition-colors active:scale-95 disabled:opacity-50"
            >
              {isUpdatingPassword ? "変更中..." : "パスワードを変更"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
