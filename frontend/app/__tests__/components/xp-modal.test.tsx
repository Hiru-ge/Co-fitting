import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import XpModal from "~/components/xp-modal";
import type { BadgeInfo } from "~/types/visit";

const defaultProps = {
  xpEarned: 50,
  totalXp: 150,
  currentLevel: 2,
  levelUp: false,
  newLevel: 2,
  newBadges: [] as BadgeInfo[],
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

  test("バッジなし時はバッジセクションが表示されない", () => {
    render(<XpModal {...defaultProps} newBadges={[]} />);
    expect(screen.queryByRole("img", { name: /バッジ/ })).not.toBeInTheDocument();
  });

  test("バッジがある場合はバッジ名が表示される", () => {
    const badge: BadgeInfo = {
      id: 1,
      name: "初めの一歩",
      description: "初めての訪問を達成！",
      icon_url: "",
    };
    render(<XpModal {...defaultProps} newBadges={[badge]} />);
    expect(screen.getByText("初めの一歩")).toBeInTheDocument();
  });

  test("複数バッジ獲得時に最初のバッジが表示される", () => {
    const badges: BadgeInfo[] = [
      { id: 1, name: "初めの一歩", description: "最初の訪問", icon_url: "" },
      { id: 2, name: "探索者", description: "10か所訪問", icon_url: "" },
    ];
    render(<XpModal {...defaultProps} newBadges={badges} />);
    expect(screen.getByText("初めの一歩")).toBeInTheDocument();
  });

  test("ダイアログ role で表示される", () => {
    render(<XpModal {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
