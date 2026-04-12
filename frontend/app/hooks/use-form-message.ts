import { useCallback, useState } from "react";

export interface FormMessageState {
  msg: string;
  error: string;
  setMsg: (msg: string) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export function useFormMessage(): FormMessageState {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const reset = useCallback(() => {
    setMsg("");
    setError("");
  }, []);

  return { msg, error, setMsg, setError, reset };
}
