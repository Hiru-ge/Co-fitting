import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: vi.fn(() => mockNavigate),
  };
});

import Privacy from "~/routes/privacy";

describe("privacy route", () => {
  test("主要見出しが表示される", () => {
    render(<Privacy />);

    expect(
      screen.getByRole("heading", { name: "プライバシーポリシー" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /第1条 取得する情報/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /第2条 利用目的/ }),
    ).toBeInTheDocument();
  });

  test("戻るボタンでnavigate(-1)が呼ばれる", async () => {
    render(<Privacy />);

    await userEvent.click(screen.getByRole("button", { name: "戻る" }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
