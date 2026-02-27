// Issue #179: 脱却モードの実装を各所で見直し・正常動作させる
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
  types: ["museum"],
};

describe("DiscoveryCard - 脱却モードバッジ", () => {
  test("is_interest_match=falseの場合に脱却モードバッジが表示される", () => {
    render(
      <DiscoveryCard
        place={{ ...basePlace, is_interest_match: false }}
        isVisited={false}
        userLat={35.658}
        userLng={139.7016}
        stackIndex={0}
      />
    );
    expect(screen.getByText("脱却モード")).toBeInTheDocument();
  });

  test("is_interest_match=trueの場合に脱却モードバッジが表示されない", () => {
    render(
      <DiscoveryCard
        place={{ ...basePlace, types: ["cafe"], is_interest_match: true }}
        isVisited={false}
        userLat={35.658}
        userLng={139.7016}
        stackIndex={0}
      />
    );
    expect(screen.queryByText("脱却モード")).not.toBeInTheDocument();
  });

  test("is_interest_matchがundefinedの場合に脱却モードバッジが表示されない", () => {
    render(
      <DiscoveryCard
        place={basePlace}
        isVisited={false}
        userLat={35.658}
        userLng={139.7016}
        stackIndex={0}
      />
    );
    expect(screen.queryByText("脱却モード")).not.toBeInTheDocument();
  });
});
