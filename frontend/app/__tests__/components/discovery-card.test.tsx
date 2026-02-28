import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DiscoveryCard from "~/components/discovery-card";

vi.mock("~/utils/geolocation", () => ({
  calcDistance: vi.fn().mockReturnValue(500),
}));

vi.mock("~/utils/helpers", () => ({
  formatDistance: vi.fn().mockReturnValue("500m"),
}));

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
  test("is_interest_match=true の場合、ジャンルバッジにオレンジカラーが適用される", () => {
    const { container } = renderCard({ is_interest_match: true });
    // オレンジカラーのクラスが適用されていることを確認（Issue #222: 興味タグ一致バッジ視認性改善）
    const badge = container.querySelector("[data-testid='genre-badge']");
    expect(badge).not.toBeNull();
    expect(badge?.className).toMatch(/orange/);
  });

  test("is_interest_match=false の場合、ジャンルバッジが通常スタイル（bg-white/20）で表示される", () => {
    const { container } = renderCard({ is_interest_match: false });
    const badge = container.querySelector("[data-testid='genre-badge']");
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("bg-white/20");
    expect(badge?.className).not.toMatch(/orange/);
  });

  test("is_interest_match が未指定の場合、ジャンルバッジが通常スタイルで表示される", () => {
    const { container } = renderCard();
    const badge = container.querySelector("[data-testid='genre-badge']");
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("bg-white/20");
    expect(badge?.className).not.toMatch(/orange/);
  });

  test("ジャンルラベルが表示される", () => {
    renderCard({ is_interest_match: true });
    // カフェのラベルが表示されていること
    const labels = screen.getAllByText("カフェ");
    expect(labels.length).toBeGreaterThan(0);
  });
});

// === Issue #198: 熟練度ベース脱却モードバッジテスト ===
describe("DiscoveryCard 脱却モードバッジ（熟練度ベース）", () => {
  test("is_comfort_zone=true の場合に脱却モードバッジが表示される", () => {
    renderCard({ is_comfort_zone: true });
    expect(screen.getByText("脱却モード")).toBeTruthy();
  });

  test("is_comfort_zone=true の場合、脱却モードバッジに赤系カラーが適用される（Issue #222: 視認性改善）", () => {
    const { container } = renderCard({ is_comfort_zone: true });
    const badge = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent === "脱却モード"
    );
    expect(badge).toBeTruthy();
    expect(badge?.className).toMatch(/red/);
  });

  test("is_comfort_zone=false の場合は脱却モードバッジが表示されない", () => {
    renderCard({ is_comfort_zone: false });
    expect(screen.queryByText("脱却モード")).toBeNull();
  });

  test("is_comfort_zone 未指定の場合は脱却モードバッジが表示されない", () => {
    renderCard();
    expect(screen.queryByText("脱却モード")).toBeNull();
  });

  test("is_interest_match=false でも is_comfort_zone が設定されていなければ脱却モードバッジは表示されない", () => {
    renderCard({ is_interest_match: false });
    expect(screen.queryByText("脱却モード")).toBeNull();
  });
});
