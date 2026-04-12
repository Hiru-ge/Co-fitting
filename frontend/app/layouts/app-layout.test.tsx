import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet-content">outlet</div>,
  };
});

vi.mock("~/components/BottomNav", () => ({
  default: () => <nav data-testid="bottom-nav">BottomNav</nav>,
}));

import AppLayout from "~/layouts/app-layout";

describe("app-layout", () => {
  test("OutletとBottomNavが表示される", () => {
    render(<AppLayout />);

    expect(screen.getByTestId("outlet-content")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
  });

  test("フィードバックリンクが正しいURLを持つ", () => {
    render(<AppLayout />);

    const link = screen.getByRole("link", { name: "フィードバックを送る" });
    expect(link).toHaveAttribute("href", "https://forms.gle/upcMz6uV97hmLn9n9");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
