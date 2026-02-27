import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BadgeModal from "~/components/badge-modal";
import type { BadgeInfo } from "~/types/visit";

const badge: BadgeInfo = {
  id: 1,
  name: "最初の一歩",
  description: "初めての訪問を達成！",
  icon_url: "",
};

describe("BadgeModal", () => {
  test("バッジ名が表示される", () => {
    render(<BadgeModal badge={badge} onClose={vi.fn()} />);
    expect(screen.getByText("最初の一歩")).toBeInTheDocument();
  });

  test("バッジ説明が表示される", () => {
    render(<BadgeModal badge={badge} onClose={vi.fn()} />);
    expect(screen.getByText("初めての訪問を達成！")).toBeInTheDocument();
  });

  test("「バッジ獲得」ラベルが表示される", () => {
    render(<BadgeModal badge={badge} onClose={vi.fn()} />);
    expect(screen.getByText(/バッジ獲得/)).toBeInTheDocument();
  });

  test("dialog role で表示される", () => {
    render(<BadgeModal badge={badge} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("aria-label が「バッジ獲得」になっている", () => {
    render(<BadgeModal badge={badge} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "バッジ獲得" })).toBeInTheDocument();
  });

  test("「バッジを獲得」ボタンで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<BadgeModal badge={badge} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /バッジを獲得/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("未定義バッジでもデフォルトアイコンで表示される", () => {
    const unknownBadge: BadgeInfo = {
      id: 99,
      name: "新しいバッジ",
      description: "未知のバッジです",
      icon_url: "",
    };
    render(<BadgeModal badge={unknownBadge} onClose={vi.fn()} />);
    expect(screen.getByText("新しいバッジ")).toBeInTheDocument();
    expect(screen.getByText("未知のバッジです")).toBeInTheDocument();
  });

  test("Escapeキーで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<BadgeModal badge={badge} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("背景オーバーレイクリックで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<BadgeModal badge={badge} onClose={onClose} />);
    const overlay = screen.getByTestId("modal-overlay");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
