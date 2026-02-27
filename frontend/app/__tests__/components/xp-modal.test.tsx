import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import XpModal from "~/components/xp-modal";

const defaultProps = {
  xpEarned: 50,
  totalXp: 150,
  currentLevel: 2,
  levelUp: false,
  newLevel: 2,
  onClose: vi.fn(),
};

describe("XpModal", () => {
  test("XP獲得量が表示される", () => {
    render(<XpModal {...defaultProps} />);
    expect(screen.getByText("+50 XP")).toBeInTheDocument();
  });

  test("クエスト完了テキストが表示される", () => {
    render(<XpModal {...defaultProps} />);
    expect(screen.getByText("クエスト完了！")).toBeInTheDocument();
  });

  test("現在のレベルが表示される", () => {
    render(<XpModal {...defaultProps} />);
    expect(screen.getByText(/LEVEL 2/i)).toBeInTheDocument();
  });

  test("「次の冒険へ」ボタンで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<XpModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /次の冒険へ/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("レベルアップ時にレベルアップメッセージが表示される", () => {
    render(<XpModal {...defaultProps} levelUp={true} newLevel={3} currentLevel={3} />);
    expect(screen.getByText(/LEVEL UP/i)).toBeInTheDocument();
    expect(screen.getByText(/LEVEL 3/i)).toBeInTheDocument();
  });

  test("バッジ名はXPモーダルに表示されない（BadgeModalで別途表示）", () => {
    render(<XpModal {...defaultProps} />);
    expect(screen.queryByText("初めの一歩")).not.toBeInTheDocument();
  });

  test("ダイアログ role で表示される", () => {
    render(<XpModal {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("Escapeキーで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<XpModal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("背景オーバーレイクリックで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<XpModal {...defaultProps} onClose={onClose} />);
    const overlay = screen.getByTestId("modal-overlay");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
