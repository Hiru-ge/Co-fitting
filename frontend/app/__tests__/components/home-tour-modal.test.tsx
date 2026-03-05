import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = value; },
  removeItem: (key: string) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); },
};
vi.stubGlobal("localStorage", localStorageMock);

const sessionStorageData: Record<string, string> = {};
const sessionStorageMock = {
  getItem: (key: string) => sessionStorageData[key] ?? null,
  setItem: (key: string, value: string) => { sessionStorageData[key] = value; },
  removeItem: (key: string) => { delete sessionStorageData[key]; },
  clear: () => { Object.keys(sessionStorageData).forEach(k => delete sessionStorageData[k]); },
};
vi.stubGlobal("sessionStorage", sessionStorageMock);

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: vi.fn().mockReturnValue(mockNavigate),
  };
});

import HomeTourModal from "~/components/HomeTourModal";

describe("HomeTourModal", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  test("最初のステップが表示される", () => {
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);
    expect(screen.getByText(/近くの場所が提案されます/)).toBeInTheDocument();
  });

  test("「次へ」ボタンで次のステップに進む", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText(/訪問を記録/)).toBeInTheDocument();
  });

  test("ステップ2にも「次へ」ボタンが表示される（マイページへ遷移するため）", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("button", { name: "次へ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "はじめる" })).not.toBeInTheDocument();
  });

  test("ステップ2「次へ」押下で profile_tour_active がsessionStorageに書き込まれる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" })); // step 2
    await user.click(screen.getByRole("button", { name: "次へ" })); // → profile

    expect(sessionStorage.getItem("profile_tour_active")).toBe("true");
  });

  test("ステップ2「次へ」押下で /profile に遷移する", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "次へ" }));

    expect(mockNavigate).toHaveBeenCalledWith("/profile");
  });

  test("ステップ2「次へ」押下では home_tour_seen は書き込まれない（プロフィールで完了するため）", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "次へ" }));

    expect(localStorage.getItem("home_tour_seen")).toBeNull();
  });

  test("「スキップ」を押すと home_tour_seen フラグが書き込まれ onClose が呼ばれる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "スキップ" }));

    expect(localStorage.getItem("home_tour_seen")).toBe("true");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("ステップ2でも「スキップ」でフラグが書き込まれ onClose が呼ばれる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "スキップ" }));

    expect(localStorage.getItem("home_tour_seen")).toBe("true");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("dialog role と aria-label が設定されている", () => {
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "使い方ツアー" })).toBeInTheDocument();
  });

  test("ステップ数インジケーターが正しく表示される（1/3）", () => {
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  test("次へを押すとインジケーターが更新される（2/3）", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
});
