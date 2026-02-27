import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useModalClose } from "~/hooks/use-modal-close";

describe("useModalClose", () => {
  test("Escapeキーでoncloseが呼ばれる", () => {
    const onClose = vi.fn();
    renderHook(() => useModalClose(onClose));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Escape以外のキーではonCloseが呼ばれない", () => {
    const onClose = vi.fn();
    renderHook(() => useModalClose(onClose));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  test("アンマウント後はイベントリスナーが解除される", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useModalClose(onClose));

    unmount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
