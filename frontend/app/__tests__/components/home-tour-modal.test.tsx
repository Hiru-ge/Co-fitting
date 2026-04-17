import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageData[key] = value;
  },
  removeItem: (key: string) => {
    delete localStorageData[key];
  },
  clear: () => {
    Object.keys(localStorageData).forEach((k) => delete localStorageData[k]);
  },
};
vi.stubGlobal("localStorage", localStorageMock);

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: vi.fn().mockReturnValue(mockNavigate),
  };
});

import HomeTourModal from "~/components/HomeTourModal";
import SampleVisitModal from "~/components/SampleVisitModal";

describe("HomeTourModal", () => {
  beforeEach(() => {
    localStorageMock.clear();
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

  test("ステップ2にも「次へ」ボタンが表示される", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("button", { name: "次へ" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "はじめる" }),
    ).not.toBeInTheDocument();
  });

  test("ステップ3ではツアーモーダルに「行ってきた！」ボタンが表示されない", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    // step 1 → step 2
    await user.click(screen.getByRole("button", { name: "次へ" }));
    // step 2 → step 3 (サンプル訪問)
    await user.click(screen.getByRole("button", { name: "次へ" }));

    expect(screen.getByText(/サンプル訪問を体験/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "行ってきた！" }),
    ).not.toBeInTheDocument();
  });

  test("ステップ3ではオーバーレイがクリックスルーになる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "次へ" }));

    expect(screen.getByRole("dialog", { name: "使い方ツアー" })).toHaveStyle({
      pointerEvents: "none",
    });
  });

  test("ステップ3でダミーカードの「行ってきた！」押下で疑似XPモーダルが表示される", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <>
        <SampleVisitModal />
        <HomeTourModal onClose={onClose} />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "行ってきた！" }));

    expect(screen.getByText("クエスト完了！")).toBeInTheDocument();
    expect(screen.getByText("+50 XP")).toBeInTheDocument();
  });

  test("サンプル訪問完了時にAPIが呼び出されない（履歴非反映）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <>
        <SampleVisitModal />
        <HomeTourModal onClose={onClose} />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "行ってきた！" }));

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("疑似XPモーダルを閉じると onboarding_stage が書き込まれ /profile に遷移する", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <>
        <SampleVisitModal />
        <HomeTourModal onClose={onClose} />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "行ってきた！" }));
    await user.click(screen.getByRole("button", { name: /次の冒険へ/ }));

    expect(localStorage.getItem("onboarding_stage")).toBe("profile_tour");
    expect(mockNavigate).toHaveBeenCalledWith("/profile", {
      state: { fromTour: true },
    });
  });

  test("ステップ3完了前に home_tour_seen は書き込まれない", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <>
        <SampleVisitModal />
        <HomeTourModal onClose={onClose} />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "次へ" }));
    await user.click(screen.getByRole("button", { name: "行ってきた！" }));

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
    expect(
      screen.getByRole("dialog", { name: "使い方ツアー" }),
    ).toBeInTheDocument();
  });

  test("ステップ数インジケーターが正しく表示される（1/4）", () => {
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  test("次へを押すとインジケーターが更新される（2/4）", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HomeTourModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
  });
});
