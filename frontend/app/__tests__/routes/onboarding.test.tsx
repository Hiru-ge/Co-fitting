import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = value; },
  removeItem: (key: string) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); },
};
vi.stubGlobal("localStorage", localStorageMock);

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((to: string) => ({ type: "redirect", location: to })),
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...props}>{children}</a>
    ),
  };
});

const mockGenres = vi.hoisted(() => [
  { id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
  { id: 2, name: "ラーメン", category: "食べる・飲む", icon: "🍜" },
  { id: 3, name: "公園", category: "自然・観光", icon: "🌳" },
  { id: 4, name: "美術館", category: "自然・観光", icon: "🎨" },
  { id: 5, name: "ジム", category: "スポーツ・健康", icon: "💪" },
]);

vi.mock("~/api/genres", () => ({
  getGenreTags: vi.fn().mockResolvedValue(mockGenres),
  getInterests: vi.fn().mockResolvedValue([]),
  updateInterests: vi.fn().mockResolvedValue([]),
}));

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

import Onboarding from "~/routes/onboarding";
import { updateInterests } from "~/api/genres";

function renderOnboarding(overrideLoaderData?: object) {
  const loaderData = {
    token: "test-token",
    genres: mockGenres,
    selectedIds: [],
    ...overrideLoaderData,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<Onboarding loaderData={loaderData as any} params={{} as any} matches={[] as any} />);
}

describe("Onboarding画面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    localStorageMock.clear();
  });

  test("興味タグ一覧が表示される", async () => {
    renderOnboarding();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /カフェ/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /ラーメン/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /公園/ })).toBeInTheDocument();
    });
  });

  test("カテゴリ別にグループ化されて表示される", () => {
    renderOnboarding();
    expect(screen.getByText("食べる・飲む")).toBeInTheDocument();
    expect(screen.getByText("自然・観光")).toBeInTheDocument();
    expect(screen.getByText("スポーツ・健康")).toBeInTheDocument();
  });

  test("タグをクリックすると選択状態になる", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    const cafeButton = screen.getByRole("button", { name: /カフェ/ });
    await user.click(cafeButton);

    expect(cafeButton).toHaveAttribute("aria-pressed", "true");
  });

  test("選択済みタグを再クリックすると選択解除される", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    const cafeButton = screen.getByRole("button", { name: /カフェ/ });
    await user.click(cafeButton);
    expect(cafeButton).toHaveAttribute("aria-pressed", "true");

    await user.click(cafeButton);
    expect(cafeButton).toHaveAttribute("aria-pressed", "false");
  });

  test("3つ未満の選択では保存ボタンが無効になる", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    // 2つ選択
    await user.click(screen.getByRole("button", { name: /カフェ/ }));
    await user.click(screen.getByRole("button", { name: /ラーメン/ }));

    const saveButton = screen.getByRole("button", { name: /選択して始める/ });
    expect(saveButton).toBeDisabled();
  });

  test("3つ以上選択すると保存ボタンが有効になる", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.click(screen.getByRole("button", { name: /カフェ/ }));
    await user.click(screen.getByRole("button", { name: /ラーメン/ }));
    await user.click(screen.getByRole("button", { name: /公園/ }));

    const saveButton = screen.getByRole("button", { name: /選択して始める/ });
    expect(saveButton).not.toBeDisabled();
  });

  test("選択数がカウントとして保存ボタンに表示される", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.click(screen.getByRole("button", { name: /カフェ/ }));
    await user.click(screen.getByRole("button", { name: /ラーメン/ }));
    await user.click(screen.getByRole("button", { name: /公園/ }));

    expect(screen.getByRole("button", { name: /選択して始める \(3\)/ })).toBeInTheDocument();
  });

  test("保存ボタン押下でupdateInterestsが呼ばれ /home に遷移する", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.click(screen.getByRole("button", { name: /カフェ/ }));
    await user.click(screen.getByRole("button", { name: /ラーメン/ }));
    await user.click(screen.getByRole("button", { name: /公園/ }));

    const saveButton = screen.getByRole("button", { name: /選択して始める/ });
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateInterests).toHaveBeenCalledWith("test-token", [1, 2, 3]);
      expect(mockNavigate).toHaveBeenCalledWith("/home");
    });
  });

  test("スキップボタン押下で /home に遷移する", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    const skipButton = screen.getByRole("button", { name: /スキップ/ });
    await user.click(skipButton);

    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  test("スキップボタン押下でlocalStorageにonboarding_skippedフラグが設定される", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    const skipButton = screen.getByRole("button", { name: /スキップ/ });
    await user.click(skipButton);

    expect(localStorage.getItem("onboarding_skipped")).toBe("true");
  });

  test("updateInterests失敗時にエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    vi.mocked(updateInterests).mockRejectedValueOnce(new Error("API Error"));
    renderOnboarding();

    await user.click(screen.getByRole("button", { name: /カフェ/ }));
    await user.click(screen.getByRole("button", { name: /ラーメン/ }));
    await user.click(screen.getByRole("button", { name: /公園/ }));

    await user.click(screen.getByRole("button", { name: /選択して始める/ }));

    await waitFor(() => {
      expect(screen.getByText(/保存に失敗しました/)).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("初期選択済みタグがある場合、選択状態で表示される", () => {
    renderOnboarding({ selectedIds: [1, 3] });

    expect(screen.getByRole("button", { name: /カフェ/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /公園/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /ラーメン/ })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Onboarding clientLoader", () => {
  test("未認証時に /login へリダイレクトする", async () => {
    const { getToken } = await import("~/lib/auth");
    vi.mocked(getToken).mockReturnValueOnce(null);

    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/routes/onboarding");

    try {
      await clientLoader({} as Parameters<typeof clientLoader>[0]);
    } catch (e) {
      expect(redirect).toHaveBeenCalledWith("/login");
    }
  });

  test("興味タグが3つ以上設定済みなら /home にリダイレクトする", async () => {
    const { getInterests } = await import("~/api/genres");
    vi.mocked(getInterests).mockResolvedValueOnce([
      { genre_tag_id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
      { genre_tag_id: 2, name: "ラーメン", category: "食べる・飲む", icon: "🍜" },
      { genre_tag_id: 3, name: "公園", category: "自然・観光", icon: "🌳" },
    ]);

    const { redirect } = await import("react-router");
    const { clientLoader } = await import("~/routes/onboarding");

    try {
      await clientLoader({} as Parameters<typeof clientLoader>[0]);
    } catch (e) {
      expect(redirect).toHaveBeenCalledWith("/home");
    }
  });

  test("興味タグが3つ未満なら正常にloaderDataを返す", async () => {
    const { getInterests, getGenreTags } = await import("~/api/genres");
    vi.mocked(getInterests).mockResolvedValueOnce([
      { genre_tag_id: 1, name: "カフェ", category: "食べる・飲む", icon: "☕" },
    ]);
    vi.mocked(getGenreTags).mockResolvedValueOnce(mockGenres);

    const { clientLoader } = await import("~/routes/onboarding");
    const result = await clientLoader({} as Parameters<typeof clientLoader>[0]);

    expect(result).toEqual({
      token: "test-token",
      genres: mockGenres,
      selectedIds: [1],
    });
  });
});
