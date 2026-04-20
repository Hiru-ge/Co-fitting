import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppHeader from "~/components/AppHeader";

describe("AppHeader", () => {
  test("Roamble のタイトルが表示される", () => {
    render(<AppHeader />);
    expect(screen.getByText("Roamble")).toBeInTheDocument();
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
