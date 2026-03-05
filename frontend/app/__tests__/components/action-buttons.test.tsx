import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ActionButtons from "~/components/action-buttons";

// === Issue #257: 訪問ボタンは施設周辺でのみ押せるようにする ===
describe("ActionButtons: 訪問ボタンの近接制限", () => {
  const baseProps = {
    onCheckIn: vi.fn(),
    onReload: vi.fn(),
    isVisited: false,
    isCheckingIn: false,
    reloadCountRemaining: 3,
    isReloading: false,
  };

  test("isNearPlace=true のとき、訪問ボタンが有効（disabled でない）", () => {
    render(<ActionButtons {...baseProps} isNearPlace={true} />);
    const buttons = screen.getAllByRole("button");
    const checkInButton = buttons[1]; // リロードボタンの次
    expect(checkInButton).not.toBeDisabled();
  });

  test("isNearPlace=false のとき、訪問ボタンが disabled になる", () => {
    render(<ActionButtons {...baseProps} isNearPlace={false} />);
    const buttons = screen.getAllByRole("button");
    const checkInButton = buttons[1];
    expect(checkInButton).toBeDisabled();
  });

  test("isNearPlace=false のとき、「到着してから記録できます」メッセージが表示される", () => {
    render(<ActionButtons {...baseProps} isNearPlace={false} />);
    expect(screen.getByText(/到着してから記録できます/)).toBeTruthy();
  });

  test("isNearPlace=true の通常状態で「行ってきた！」が表示される", () => {
    render(<ActionButtons {...baseProps} isNearPlace={true} />);
    expect(screen.getByText("行ってきた！")).toBeTruthy();
  });

  test("isNearPlace=false でも isVisited=true のときは「記録済み」が表示される", () => {
    render(<ActionButtons {...baseProps} isNearPlace={false} isVisited={true} />);
    expect(screen.getByText("記録済み")).toBeTruthy();
  });

  test("isNearPlace=false でも isCheckingIn=true のときは「記録中...」が表示される", () => {
    render(<ActionButtons {...baseProps} isNearPlace={false} isCheckingIn={true} />);
    expect(screen.getByText("記録中...")).toBeTruthy();
  });
});
