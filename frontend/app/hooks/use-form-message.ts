import { useState } from "react";

export interface FormMessageState {
  msg: string;
  error: string;
  setMsg: (msg: string) => void;
  setError: (error: string) => void;
  reset: () => void;
}

/**
 * フォームのメッセージ（成功・エラー）状態を管理する共通 hook。
 * settings.tsx などで複数フォームが重複する状態管理を DRY 化するために使用する。
 */
export function useFormMessage(): FormMessageState {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setMsg("");
    setError("");
  }

  return { msg, error, setMsg, setError, reset };
}
