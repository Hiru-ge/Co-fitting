// Issue #165: 3件完了時に達成感のあるコンプリートカードを表示する
// Issue #300: コンプリートカードのデザイン刷新（宇宙テーマ・スワイプでスピン）
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...props}>{children}</a>
    ),
  };
});

import CompleteCard from "~/components/complete-card";

beforeEach(() => {
  // JSDOM は setPointerCapture を実装していないためモック
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

describe("CompleteCard 表示", () => {
  test("コンプリートカードが aria-label='コンプリート' で表示される", () => {
    render(<CompleteCard />);
    expect(screen.getByRole("region", { name: "コンプリート" })).toBeInTheDocument();
  });

  test("コンプリートメッセージが表示される", () => {
    render(<CompleteCard />);
    expect(screen.getByText("今日の3件コンプリート！")).toBeInTheDocument();
  });

  test("明日への案内メッセージが表示される", () => {
    render(<CompleteCard />);
    expect(screen.getByText(/明日また/)).toBeInTheDocument();
  });

  test("訪問履歴へのリンクが表示される", () => {
    render(<CompleteCard />);
    const link = screen.getByRole("link", { name: /訪問した場所を振り返る/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/history");
  });
});

describe("CompleteCard スワイプ動作（Issue #300）", () => {
  test("スワイプ閾値（120px）未満で離した場合、スピンしない", async () => {
    render(<CompleteCard />);
    const card = screen.getByRole("region", { name: "コンプリート" });

    await act(async () => {
      fireEvent.pointerDown(card, { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(card, { clientX: 50, clientY: 0 }); // 50px < 120px
      fireEvent.pointerUp(card);
    });

    expect(card).not.toHaveClass("isSpinning");
  });

  test("スワイプ閾値超過で離した場合、スピンアニメーションが発火する（isSpinning クラスが付与される）", async () => {
    render(<CompleteCard />);
    const card = screen.getByRole("region", { name: "コンプリート" });

    await act(async () => {
      fireEvent.pointerDown(card, { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(card, { clientX: 150, clientY: 0 }); // 150px > 120px
      fireEvent.pointerUp(card);
    });

    expect(card).toHaveClass("isSpinning");
    expect(card).toHaveClass("animate-card-spin");
  });

  test("スワイプ閾値超過でも、アニメーション終了後に isSpinning が解除され onSwipe は呼ばれない", async () => {
    const onSwipe = vi.fn();

    render(<CompleteCard onSwipe={onSwipe} />);
    const card = screen.getByRole("region", { name: "コンプリート" });

    await act(async () => {
      fireEvent.pointerDown(card, { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(card, { clientX: 150, clientY: 0 });
      fireEvent.pointerUp(card);
    });

    // スピン中は isSpinning クラスあり
    expect(card).toHaveClass("isSpinning");

    // CSS animation 終了イベントを発火 → isSpinning 解除・onSwipe 未呼び出し
    await act(async () => {
      fireEvent.animationEnd(card);
    });

    expect(card).not.toHaveClass("isSpinning");
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
