import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppHeader from "~/components/AppHeader";

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    Link: ({
      to,
      children,
      ...props
    }: {
      to: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

describe("AppHeader", () => {
  test("Roamble のタイトルが表示される", () => {
    render(<AppHeader />);
    expect(screen.getByText("Roamble")).toBeInTheDocument();
  });

  test("プロフィールリンクが /profile を指す", () => {
    render(<AppHeader />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/profile");
  });

  test("locationLabel を渡すと現在地ラベルが表示される", () => {
    render(<AppHeader locationLabel="渋谷区" />);
    expect(screen.getByText("渋谷区")).toBeInTheDocument();
  });

  test("locationLabel がないとき現在地ラベルは表示されない", () => {
    render(<AppHeader />);
    expect(screen.queryByText("location_on")).not.toBeInTheDocument();
  });

  test("header 要素として描画される", () => {
    render(<AppHeader />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });
});
