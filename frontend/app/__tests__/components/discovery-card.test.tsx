import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DiscoveryCard from "~/components/DiscoveryCard";

vi.mock("~/lib/geolocation", () => ({
  calcHaversineDistance: vi.fn().mockReturnValue(500),
}));

vi.mock("~/utils/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/utils/helpers")>();
  return {
    ...actual,
    formatDistance: vi.fn().mockReturnValue("500m"),
  };
});

const basePlace = {
  place_id: "place_1",
  name: "テストお店",
  vicinity: "渋谷区1-1",
  lat: 35.66,
  lng: 139.7,
  rating: 4.2,
  display_type: "cafe",
};

function renderCard(overrides = {}) {
  return render(
    <DiscoveryCard
      place={{ ...basePlace, ...overrides }}
      isVisited={false}
      userLat={35.658}
      userLng={139.7016}
      depthFromTop={0}
    />,
  );
}

// ジャンルバッジの興味ジャンル一致強調表示テスト
describe("DiscoveryCard ジャンルバッジ", () => {
  test("is_interest_match=true の場合、ジャンルバッジにオレンジカラーが適用される", () => {
    const { container } = renderCard({ is_interest_match: true });
    // オレンジカラーのクラスが適用されていることを確認（Issue #222: 興味ジャンル一致バッジ視認性改善）
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

// 熟練度ベースチャレンジバッジテスト
describe("DiscoveryCard チャレンジバッジ（熟練度ベース）", () => {
  test("is_breakout=true の場合にチャレンジバッジが表示される", () => {
    renderCard({ is_breakout: true });
    expect(screen.getByText("チャレンジ")).toBeTruthy();
  });

  test("is_breakout=true の場合、チャレンジバッジに赤系カラーが適用される（Issue #222: 視認性改善）", () => {
    const { container } = renderCard({ is_breakout: true });
    const badge = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent === "チャレンジ",
    );
    expect(badge).toBeTruthy();
    expect(badge?.className).toMatch(/red/);
  });

  test("is_breakout=false の場合はチャレンジバッジが表示されない", () => {
    renderCard({ is_breakout: false });
    expect(screen.queryByText("チャレンジ")).toBeNull();
  });

  test("is_breakout 未指定の場合はチャレンジバッジが表示されない", () => {
    renderCard();
    expect(screen.queryByText("チャレンジ")).toBeNull();
  });

  test("is_interest_match=false でも is_breakout が設定されていなければチャレンジバッジは表示されない", () => {
    renderCard({ is_interest_match: false });
    expect(screen.queryByText("チャレンジ")).toBeNull();
  });
});

//Google Maps施設詳細連携テスト
describe("DiscoveryCard Google Maps施設詳細", () => {
  test("「地図で開く」リンクが表示される", () => {
    renderCard();
    expect(screen.getByTestId("google-maps-link")).toBeTruthy();
  });

  test("リンクの href に place_id を含む Google Maps 施設詳細 URL が設定される", () => {
    renderCard();
    const link = screen.getByTestId("google-maps-link");
    expect(link.getAttribute("href")).toBe(
      "https://www.google.com/maps/place/?q=place_id:place_1",
    );
  });

  test("リンクが target='_blank' で開く", () => {
    renderCard();
    const link = screen.getByTestId("google-maps-link");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  test("別の place_id を持つ place でも正しい URL が生成される", () => {
    renderCard({ place_id: "place_2" });
    const link = screen.getByTestId("google-maps-link");
    expect(link.getAttribute("href")).toBe(
      "https://www.google.com/maps/place/?q=place_id:place_2",
    );
  });
});

// === Issue #321: 7日間スキップボタンのテスト ===
describe("DiscoveryCard スキップボタン", () => {
  test("最前面カード（depthFromTop=0）にスキップボタンが表示される", () => {
    renderCard();
    expect(screen.getByTestId("skip-button")).toBeTruthy();
  });

  test("スヌーズボタンをクリックするとonSnoozeが呼ばれる", () => {
    const onSnooze = vi.fn();
    render(
      <DiscoveryCard
        place={{ ...basePlace }}
        isVisited={false}
        userLat={35.658}
        userLng={139.7016}
        depthFromTop={0}
        onSnooze={onSnooze}
      />,
    );
    fireEvent.click(screen.getByTestId("skip-button"));
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });

  test("onSnoozeが未指定でもスヌーズボタンのクリックでエラーにならない", () => {
    renderCard();
    expect(() => {
      fireEvent.click(screen.getByTestId("skip-button"));
    }).not.toThrow();
  });

  test("スタック奥のカード（depthFromTop>0）ではスキップボタンが表示されない", () => {
    render(
      <DiscoveryCard
        place={{ ...basePlace }}
        isVisited={false}
        userLat={35.658}
        userLng={139.7016}
        depthFromTop={1}
      />,
    );
    expect(screen.queryByTestId("skip-button")).toBeNull();
  });
});
