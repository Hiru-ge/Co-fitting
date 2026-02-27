import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DiscoveryCard from "~/components/discovery-card";

vi.mock("~/utils/geolocation", () => ({
  calcDistance: vi.fn().mockReturnValue(500),
}));

vi.mock("~/utils/helpers", () => ({
  formatDistance: vi.fn().mockReturnValue("500m"),
}));

import DiscoveryCard from "~/components/discovery-card";

const basePlace = {
  place_id: "place_1",
  name: "テストスポット",
  vicinity: "渋谷区1-1",
  lat: 35.66,
  lng: 139.7,
  rating: 4.2,
  types: ["cafe"],
};

function renderCard(overrides = {}) {
  return render(
    <DiscoveryCard
      place={{ ...basePlace, ...overrides }}
      isVisited={false}
      userLat={35.658}
      userLng={139.7016}
      stackIndex={0}
    />
  );
}

// === Issue #178: ジャンルバッジの興味タグ一致強調表示テスト ===
describe("DiscoveryCard ジャンルバッジ", () => {
  test("is_interest_match=true の場合、ジャンルバッジにブランドカラーが適用される", () => {
    const { container } = renderCard({ is_interest_match: true });
    // ブランドカラー (#525BBB) のクラスが適用されていることを確認
    const badge = container.querySelector("[data-testid='genre-badge']");
    expect(badge).not.toBeNull();
    expect(badge?.className).toMatch(/brand|525BBB|interest-match/);
  });

  test("is_interest_match=false の場合、ジャンルバッジが通常スタイル（bg-white/20）で表示される", () => {
    const { container } = renderCard({ is_interest_match: false });
    const badge = container.querySelector("[data-testid='genre-badge']");
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("bg-white/20");
    expect(badge?.className).not.toMatch(/brand|525BBB|interest-match/);
  });

  test("is_interest_match が未指定の場合、ジャンルバッジが通常スタイルで表示される", () => {
    const { container } = renderCard();
    const badge = container.querySelector("[data-testid='genre-badge']");
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("bg-white/20");
    expect(badge?.className).not.toMatch(/brand|525BBB|interest-match/);
  });

  test("ジャンルラベルが表示される", () => {
    renderCard({ is_interest_match: true });
    // カフェのラベルが表示されていること
    const labels = screen.getAllByText("カフェ");
    expect(labels.length).toBeGreaterThan(0);
  });
});
