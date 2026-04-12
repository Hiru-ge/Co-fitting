export default function FormMessageDisplay({
  success,
  error,
}: {
  success?: string;
  error?: string;
}) {
  if (success) {
    return (
      <p className="text-sm text-green-600 flex items-center gap-1">
        <span className="material-symbols-outlined text-base">
          check_circle
        </span>
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
