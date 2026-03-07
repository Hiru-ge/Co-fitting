import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

const AUTO_CLOSE_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "error", action?: ToastAction) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, type, message, action }]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, AUTO_CLOSE_MS);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  // クリーンアップ
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-9999 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
        role="region"
        aria-label="通知"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const config = toastConfig[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg backdrop-blur-md transition-all animate-slide-in ${config.bg}`}
      role="alert"
    >
      <span className={`material-symbols-outlined text-xl shrink-0 mt-0.5 ${config.iconColor}`}>
        {config.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${config.textColor}`}>
          {toast.message}
        </p>
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); onClose(); }}
            className={`mt-1.5 text-xs font-bold underline underline-offset-2 ${config.iconColor}`}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={onClose}
        className={`shrink-0 rounded-full p-1 transition-colors ${config.closeHover}`}
        aria-label="閉じる"
      >
        <span className={`material-symbols-outlined text-base ${config.iconColor}`}>
          close
        </span>
      </button>
    </div>
  );
}

const toastConfig = {
  success: {
    bg: "bg-green-50 border border-green-200",
    icon: "check_circle",
    iconColor: "text-green-600",
    textColor: "text-green-800",
    closeHover: "hover:bg-green-100",
  },
  error: {
    bg: "bg-red-50 border border-red-200",
    icon: "error",
    iconColor: "text-red-600",
    textColor: "text-red-800",
    closeHover: "hover:bg-red-100",
  },
  info: {
    bg: "bg-blue-50 border border-blue-200",
    icon: "info",
    iconColor: "text-blue-600",
    textColor: "text-blue-800",
    closeHover: "hover:bg-blue-100",
  },
} as const;

/**
 * Toast 表示用フック
 * ToastProvider 内で使用する
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast は ToastProvider 内で使用してください");
  }
  return ctx;
}
