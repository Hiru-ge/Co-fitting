interface NotificationToggleProps {
  id: string;
  label: string;
  ariaLabel?: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export default function NotificationToggle({
  id,
  label,
  ariaLabel,
  description,
  checked,
  disabled = false,
  onChange,
}: NotificationToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className={`text-sm font-medium cursor-pointer ${disabled ? "text-gray-500" : "text-gray-200"}`}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        } ${checked ? "bg-primary" : "bg-gray-600"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
          aria-hidden="true"
        />
        {/* スクリーンリーダー用の hidden input */}
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </button>
    </div>
  );
}
