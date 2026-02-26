// Issue #165: 3件完了時に達成感のあるコンプリートカードを表示する
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

describe("CompleteCard", () => {
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
