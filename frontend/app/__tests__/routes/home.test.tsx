import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPlaces = [
  {
    place_id: "place_1",
    name: "テストカフェ",
    vicinity: "渋谷区1-1",
    lat: 35.66,
    lng: 139.7,
    rating: 4.2,
    types: ["cafe"],
  },
  {
    place_id: "place_2",
    name: "テスト公園",
    vicinity: "渋谷区2-2",
    lat: 35.661,
    lng: 139.701,
    rating: 4.0,
    types: ["park"],
  },
  {
    place_id: "place_3",
    name: "テストバー",
    vicinity: "渋谷区3-3",
    lat: 35.662,
    lng: 139.702,
    rating: 3.8,
    types: ["bar"],
  },
];

vi.mock("~/utils/geolocation", () => ({
  getPositionWithFallback: vi.fn().mockResolvedValue({ lat: 35.658, lng: 139.7016 }),
  calcDistance: vi.fn().mockReturnValue(500),
}));

let callCount = 0;
vi.mock("~/api/suggestions", () => ({
  getSuggestions: vi.fn().mockImplementation(() => {
    callCount++;
    return Promise.resolve([...mockPlaces]);
  }),
}));

vi.mock("~/api/visits", () => ({
  createVisit: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(),
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...props}>{children}</a>
    ),
  };
});

vi.mock("~/lib/auth", () => ({
  getToken: vi.fn().mockReturnValue("test-token"),
  getUser: vi.fn().mockResolvedValue({
    id: 1,
    email: "test@example.com",
    display_name: "テストユーザー",
    avatar_url: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  }),
}));

import Home from "~/routes/home";

function renderHome() {
  const loaderData = {
    user: {
      id: 1,
      email: "test@example.com",
      display_name: "テストユーザー",
      avatar_url: null,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
    token: "test-token",
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<Home loaderData={loaderData as any} params={{} as any} matches={[] as any} />);
}

describe("Home画面", () => {
  beforeEach(() => {
    callCount = 0;
    vi.clearAllMocks();
  });

  test("提案カード1枚目が表示される", async () => {
    renderHome();
    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });
  });

  test("スキップ → 2枚目のカードが表示される", async () => {
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const skipButton = screen.getByRole("button", { name: /スキップ/ });
    await user.click(skipButton);

    expect(screen.getByText("テスト公園")).toBeInTheDocument();
  });

  test("3枚目でスキップ → 1枚目に戻る（循環）", async () => {
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const skipButton = screen.getByRole("button", { name: /スキップ/ });
    await user.click(skipButton); // → 2枚目
    await user.click(skipButton); // → 3枚目
    expect(screen.getByText("テストバー")).toBeInTheDocument();

    await user.click(skipButton); // → 1枚目に戻る
    expect(screen.getByText("テストカフェ")).toBeInTheDocument();
  });

  test("「行ってきた！」→ createVisit実行 → カードが消えて次のカードが表示される", async () => {
    const { createVisit } = await import("~/api/visits");
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    const checkInButton = screen.getByRole("button", { name: /行ってきた/ });
    await user.click(checkInButton);

    await waitFor(() => {
      expect(createVisit).toHaveBeenCalled();
    });

    // 訪問済みカードが消えて、次のカードが先頭になる
    await waitFor(() => {
      expect(screen.queryByText("テストカフェ")).not.toBeInTheDocument();
      expect(screen.getByText("テスト公園")).toBeInTheDocument();
    });
  });

  test("全カードを訪問するとスポット無し表示になる", async () => {
    const user = userEvent.setup();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("テストカフェ")).toBeInTheDocument();
    });

    // 3枚全て訪問
    for (let i = 0; i < 3; i++) {
      const checkInButton = screen.getByRole("button", { name: /行ってきた/ });
      await user.click(checkInButton);
      // 少し待つ
      await waitFor(() => {
        expect(checkInButton).not.toBeDisabled();
      }, { timeout: 500 }).catch(() => {});
    }

    await waitFor(() => {
      expect(screen.getByText("近くのスポットが見つかりませんでした。または、今日の3件をコンプリートしています")).toBeInTheDocument();
    });
  });
});
