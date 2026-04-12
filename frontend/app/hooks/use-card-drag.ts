import { useCallback, useRef, useState } from "react";

const SWIPE_OUT_DISTANCE = 800;

interface UseCardDragOptions {
  cardRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  swipeThreshold: number;
  onThresholdExceeded: (offset: { x: number; y: number }) => void;
}

export function useCardDrag({
  cardRef,
  enabled,
  swipeThreshold,
  onThresholdExceeded,
}: UseCardDragOptions) {
  const startPosRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const resetOffset = useCallback(() => {
    offsetRef.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      draggingRef.current = true;
      setIsDragging(true);
      startPosRef.current = { x: e.clientX, y: e.clientY };
      resetOffset();
      cardRef.current?.setPointerCapture(e.pointerId);
    },
    [cardRef, enabled, resetOffset],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const nextOffset = {
      x: e.clientX - startPosRef.current.x,
      y: e.clientY - startPosRef.current.y,
    };
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);

    const { x, y } = offsetRef.current;
    const dist = Math.sqrt(x ** 2 + y ** 2);

    if (dist > swipeThreshold) {
      const angle = Math.atan2(y, x);
      const flyOut = {
        x: Math.cos(angle) * SWIPE_OUT_DISTANCE,
        y: Math.sin(angle) * SWIPE_OUT_DISTANCE,
      };
      offsetRef.current = flyOut;
      setOffset(flyOut);
      onThresholdExceeded({ x, y });
      return;
    }

    resetOffset();
  }, [onThresholdExceeded, resetOffset, swipeThreshold]);

  return {
    offset,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
