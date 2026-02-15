import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider, useToast } from "~/components/toast";

// テスト用トースト発火コンポーネント
function ToastTrigger({ message, type }: { message: string; type?: "success" | "error" | "info" }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(message, type)}>トースト</button>;
}

describe("Toast コンポーネント", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("showToast でトーストが表示される", () => {
    render(
      <ToastProvider>
        <ToastTrigger message="テストメッセージ" />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText("トースト"));
    });

    expect(screen.getByText("テストメッセージ")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("3秒後に自動で非表示になる", () => {
    render(
      <ToastProvider>
        <ToastTrigger message="一時メッセージ" />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText("トースト"));
    });
    expect(screen.getByText("一時メッセージ")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("一時メッセージ")).not.toBeInTheDocument();
  });

  test("閉じるボタンで即時非表示になる", () => {
    render(
      <ToastProvider>
        <ToastTrigger message="閉じるテスト" />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText("トースト"));
    });
    expect(screen.getByText("閉じるテスト")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByLabelText("閉じる"));
    });
    expect(screen.queryByText("閉じるテスト")).not.toBeInTheDocument();
  });

  test("成功トーストが正しい role で表示される", () => {
    render(
      <ToastProvider>
        <ToastTrigger message="成功です" type="success" />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText("トースト"));
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("成功です")).toBeInTheDocument();
  });

  test("複数のトーストを同時に表示できる", () => {
    function MultiTrigger() {
      const { showToast } = useToast();
      return (
        <>
          <button onClick={() => showToast("メッセージ1")}>発火1</button>
          <button onClick={() => showToast("メッセージ2", "success")}>発火2</button>
        </>
      );
    }

    render(
      <ToastProvider>
        <MultiTrigger />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText("発火1"));
      fireEvent.click(screen.getByText("発火2"));
    });

    expect(screen.getByText("メッセージ1")).toBeInTheDocument();
    expect(screen.getByText("メッセージ2")).toBeInTheDocument();
  });

  test("ToastProvider 外で useToast を使うとエラー", () => {
    // console.error を抑制
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<ToastTrigger message="テスト" />);
    }).toThrow("useToast は ToastProvider 内で使用してください");

    spy.mockRestore();
  });

  test("通知領域に aria-label がある", () => {
    render(
      <ToastProvider>
        <ToastTrigger message="テスト" />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText("トースト"));
    });

    expect(screen.getByRole("region", { name: "通知" })).toBeInTheDocument();
  });
});
