import { describe, test, expect } from "vitest";
import { getCategoryInfo } from "~/utils/category-map";

describe("getCategoryInfo", () => {
  test("cafe → カフェのCategoryInfoが返る", () => {
    const info = getCategoryInfo(["cafe"]);
    expect(info.label).toBe("カフェ");
    expect(info.icon).toBe("local_cafe");
    expect(info.gradient).toContain("amber");
  });

  test("restaurant → レストランのCategoryInfoが返る", () => {
    const info = getCategoryInfo(["restaurant"]);
    expect(info.label).toBe("レストラン");
    expect(info.icon).toBe("restaurant");
  });

  test("複数typesの場合、最初にマッチしたものが返る", () => {
    const info = getCategoryInfo(["point_of_interest", "park", "cafe"]);
    expect(info.label).toBe("公園");
  });

  test("未知のtype → デフォルトカテゴリが返る", () => {
    const info = getCategoryInfo(["unknown_type"]);
    expect(info.label).toBe("スポット");
    expect(info.icon).toBe("location_on");
    expect(info.gradient).toContain("gray");
  });

  test("空配列 → デフォルトカテゴリが返る", () => {
    const info = getCategoryInfo([]);
    expect(info.label).toBe("スポット");
    expect(info.icon).toBe("location_on");
  });
});
