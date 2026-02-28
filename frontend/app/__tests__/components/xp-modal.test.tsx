import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  // --- Issue #227: XP計算内訳の表示 ---

  test("xpBreakdown が渡されない場合、内訳セクションが表示されない", () => {
    render(<XpModal {...defaultProps} />);
    expect(screen.queryByTestId("xp-breakdown")).not.toBeInTheDocument();
  });

  test("通常訪問のxpBreakdownを渡すとベースXPが表示される", () => {
    render(
      <XpModal
        {...defaultProps}
        xpEarned={50}
        xpBreakdown={{ base_xp: 50, first_genre_bonus: 0, first_area_bonus: 0, memo_bonus: 0, streak_bonus: 0 }}
      />
    );
    const breakdownEl = screen.getByTestId("xp-breakdown");
    expect(breakdownEl).toBeInTheDocument();
    expect(screen.getByText(/通常訪問/)).toBeInTheDocument();
    expect(within(breakdownEl).getByText("+50")).toBeInTheDocument();
  });

  test("脱却ボーナスがある場合に「脱却ボーナス」が表示される", () => {
    render(
      <XpModal
        {...defaultProps}
        xpEarned={100}
        xpBreakdown={{ base_xp: 100, first_genre_bonus: 0, first_area_bonus: 0, memo_bonus: 0, streak_bonus: 0 }}
      />
    );
    expect(screen.getByText(/脱却ボーナス/)).toBeInTheDocument();
  });

  test("初ジャンルボーナスがある場合に内訳に表示される", () => {
    render(
      <XpModal
        {...defaultProps}
        xpEarned={150}
        xpBreakdown={{ base_xp: 100, first_genre_bonus: 50, first_area_bonus: 0, memo_bonus: 0, streak_bonus: 0 }}
      />
    );
    expect(screen.getByText(/初ジャンル/)).toBeInTheDocument();
    expect(screen.getAllByText(/\+50/).length).toBeGreaterThan(0);
  });

  test("複数ボーナスがある場合にすべて表示される", () => {
    render(
      <XpModal
        {...defaultProps}
        xpEarned={190}
        xpBreakdown={{ base_xp: 100, first_genre_bonus: 50, first_area_bonus: 30, memo_bonus: 10, streak_bonus: 0 }}
      />
    );
    expect(screen.getByText(/脱却ボーナス/)).toBeInTheDocument();
    expect(screen.getByText(/初ジャンル/)).toBeInTheDocument();
    expect(screen.getByText(/初エリア/)).toBeInTheDocument();
    expect(screen.getByText(/メモ/)).toBeInTheDocument();
  });

  test("ストリークボーナスがある場合に内訳に表示される", () => {
    render(
      <XpModal
        {...defaultProps}
        xpEarned={60}
        xpBreakdown={{ base_xp: 50, first_genre_bonus: 0, first_area_bonus: 0, memo_bonus: 0, streak_bonus: 10 }}
      />
    );
    expect(screen.getByText(/ストリーク/)).toBeInTheDocument();
    expect(screen.getByText(/\+10/)).toBeInTheDocument();
  });
});
