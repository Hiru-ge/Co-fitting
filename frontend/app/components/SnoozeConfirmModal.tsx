interface SnoozeConfirmModalProps {
  onConfirm: () => void;
  onClose: () => void;
}

export default function SnoozeConfirmModal({
  onConfirm,
  onClose,
}: SnoozeConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-base font-bold text-gray-100 mb-1">
          このお店を7日間非表示にする
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          本当に非表示にしますか？
          <br />
          勇気を出して訪れてみたら新しい発見があるかもしれませんよ！
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full border border-gray-700 text-gray-300 font-bold text-sm active:scale-95 transition-transform"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-full bg-gray-700 text-white font-bold text-sm active:scale-95 transition-transform"
          >
            非表示にする
          </button>
        </div>
      </div>
    </div>
  );
}
