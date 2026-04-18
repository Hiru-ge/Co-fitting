import { useState } from "react";
import { snoozePlace } from "~/api/places";

interface UseSnoozeOptions {
  authToken: string;
  onConfirmed: () => void;
}

export function useSnooze({ authToken, onConfirmed }: UseSnoozeOptions) {
  const [snoozeTarget, setSnoozeTarget] = useState<{
    placeId: string;
    placeName: string;
  } | null>(null);

  function openSnoozeModal(placeId: string, placeName: string) {
    setSnoozeTarget({ placeId, placeName });
  }

  async function confirmSnooze() {
    if (!snoozeTarget) return;
    const { placeId } = snoozeTarget;
    setSnoozeTarget(null);
    onConfirmed();
    try {
      await snoozePlace(authToken, placeId, 7);
    } catch {
      // 楽観的更新済みのためカードは消えたまま。サイレントに失敗させる
    }
  }

  function cancelSnooze() {
    setSnoozeTarget(null);
  }

  return {
    isModalOpen: snoozeTarget !== null,
    targetPlaceName: snoozeTarget?.placeName ?? null,
    openSnoozeModal,
    confirmSnooze,
    cancelSnooze,
  };
}
