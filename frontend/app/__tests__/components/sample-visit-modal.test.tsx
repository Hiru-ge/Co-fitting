import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SampleVisitModal from "~/components/SampleVisitModal";

describe("SampleVisitModal", () => {
  test("「Cafe Roamble」のカード名が表示される", () => {
    render(<SampleVisitModal />);
    expect(screen.getByText("Cafe Roamble")).toBeInTheDocument();
  });

  test("カフェカテゴリのバッジが表示される", () => {
    render(<SampleVisitModal />);
    const badges = screen.getAllByText("カフェ");
    expect(badges.length).toBeGreaterThan(0);
  });

  test("NEW SPOT バッジが表示される", () => {
    render(<SampleVisitModal />);
    expect(screen.getByText("NEW SPOT")).toBeInTheDocument();
  });

  test("data-tour属性が設定される", () => {
    const { container } = render(<SampleVisitModal />);
    expect(
      container.querySelector('[data-tour="sample-visit-card"]'),
    ).not.toBeNull();
  });

  test("モックアクションボタンが表示される", () => {
    const { container } = render(<SampleVisitModal />);
    expect(
      container.querySelector('[data-tour="sample-action-buttons"]'),
    ).not.toBeNull();
  });

  test("ダミーカードの「行ってきた！」ボタンが表示される", () => {
    render(<SampleVisitModal />);
    expect(
      screen.getByRole("button", { name: "行ってきた！" }),
    ).toBeInTheDocument();
  });
});
