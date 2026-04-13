import { Icon } from "~/components/Icon";

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
        <Icon name="check_circle" className="text-base" />
        {success}
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-500 flex items-center gap-1">
        <Icon name="error" className="text-base" />
        {error}
      </p>
    );
  }

  return null;
}
