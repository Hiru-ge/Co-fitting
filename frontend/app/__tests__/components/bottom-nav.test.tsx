import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BottomNav from "~/components/BottomNav";

// useLocation をモックして現在のパスを制御する
const mockPathname = vi.fn().mockReturnValue("/home");
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useLocation: () => ({ pathname: mockPathname() }),
    NavLink: ({
      to,
      children,
      className,
    }: {
      to: string;
      children: React.ReactNode;
      className?: string | ((args: { isActive: boolean }) => string);
    }) => {
      const isActive = to === mockPathname();
      const resolvedClass =
        typeof className === "function" ? className({ isActive }) : className;
      return (
        <a
          href={to}
          className={resolvedClass}
          data-testid={`nav-${to.replace("/", "")}`}
        >
          {children}
        </a>
      );
    },
  };
});

describe("BottomNav", () => {
  test("3つのナビゲーションアイテムがレンダリングされる", () => {
    render(<BottomNav />);
    expect(screen.getByText("発見")).toBeInTheDocument();
    expect(screen.getByText("履歴")).toBeInTheDocument();
    expect(screen.getByText("マイページ")).toBeInTheDocument();
  });

  test("各リンクが正しい href を持つ", () => {
    render(<BottomNav />);
    const homeLink = screen.getByTestId("nav-home");
    const historyLink = screen.getByTestId("nav-history");
    const profileLink = screen.getByTestId("nav-profile");

    expect(homeLink).toHaveAttribute("href", "/home");
    expect(historyLink).toHaveAttribute("href", "/history");
    expect(profileLink).toHaveAttribute("href", "/profile");
  });

  test("/home のとき発見リンクがアクティブクラスを持つ", () => {
    mockPathname.mockReturnValue("/home");
    render(<BottomNav />);
    const homeLink = screen.getByTestId("nav-home");
    expect(homeLink.className).toContain("text-primary");
  });

  test("/history のとき履歴リンクがアクティブクラスを持つ", () => {
    mockPathname.mockReturnValue("/history");
    render(<BottomNav />);
    const historyLink = screen.getByTestId("nav-history");
    expect(historyLink.className).toContain("text-primary");
  });

  test("/profile のとき非アクティブリンクはグレー", () => {
    mockPathname.mockReturnValue("/profile");
    render(<BottomNav />);
    const homeLink = screen.getByTestId("nav-home");
    expect(homeLink.className).toContain("text-gray-400");
  });

  test("nav 要素として描画される", () => {
    render(<BottomNav />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
