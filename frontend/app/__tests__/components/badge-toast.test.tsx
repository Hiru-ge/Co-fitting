import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import BadgeToast from "~/components/badge-toast";
import type { BadgeInfo } from "~/types/visit";

const badge: BadgeInfo = {
  id: 1,
  name: "初めの一歩",
  description: "初めての訪問を達成！",
  icon_url: "",
};

describe("BadgeToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("バッジ名と説明が表示される", () => {
    render(<BadgeToast badge={badge} onClose={vi.fn()} />);
    expect(screen.getByText("初めの一歩")).toBeInTheDocument();
    expect(screen.getByText("初めての訪問を達成！")).toBeInTheDocument();
  });

  test("バッジ獲得ラベルが表示される", () => {
    render(<BadgeToast badge={badge} onClose={vi.fn()} />);
    expect(screen.getByText(/バッジ獲得/)).toBeInTheDocument();
  });

  test("5秒後に onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<BadgeToast badge={badge} onClose={onClose} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("閉じるボタンで即時 onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<BadgeToast badge={badge} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
