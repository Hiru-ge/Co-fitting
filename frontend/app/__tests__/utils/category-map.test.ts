import { describe, test, expect } from "vitest";
import {
  getCategoryInfo,
  pickCategoryFromAPIPlaceTypes,
} from "~/lib/category-map";

describe("getCategoryInfo", () => {
  test("cafe → カフェのCategoryInfoが返る", () => {
    const info = getCategoryInfo("cafe");
    expect(info.label).toBe("カフェ");
    expect(info.icon).toBe("local_cafe");
    expect(info.gradientColor).toContain("amber");
    expect(info.hexColor).toMatch(/^#/);
  });

  test("restaurant → レストランのCategoryInfoが返る", () => {
    const info = getCategoryInfo("restaurant");
    expect(info.label).toBe("レストラン");
    expect(info.icon).toBe("restaurant");
  });

  test("未知のcategory → デフォルトカテゴリが返る", () => {
    const info = getCategoryInfo("unknown_type");
    expect(info.label).toBe("スポット");
    expect(info.icon).toBe("location_on");
    expect(info.gradientColor).toContain("gray");
    expect(info.hexColor).toBe("#6b7280");
  });
});

describe("getCategoryInfo - 追加タイプ（Issue #226）", () => {
  test("meal_takeaway → テイクアウトのCategoryInfoが返る", () => {
    const info = getCategoryInfo("meal_takeaway");
    expect(info.label).not.toBe("スポット");
  });

  test("ramen_restaurant → ラーメンのCategoryInfoが返る", () => {
    const info = getCategoryInfo("ramen_restaurant");
    expect(info.label).not.toBe("スポット");
  });

  test("karaoke → カラオケのCategoryInfoが返る", () => {
    const info = getCategoryInfo("karaoke");
    expect(info.label).not.toBe("スポット");
  });

  test("bowling_alley → ボーリングのCategoryInfoが返る", () => {
    const info = getCategoryInfo("bowling_alley");
    expect(info.label).not.toBe("スポット");
  });

  test("amusement_center → ゲームセンターのCategoryInfoが返る", () => {
    const info = getCategoryInfo("amusement_center");
    expect(info.label).not.toBe("スポット");
  });

  test("fitness_center → ジムのCategoryInfoが返る", () => {
    const info = getCategoryInfo("fitness_center");
    expect(info.label).not.toBe("スポット");
  });

  test("public_bath → 銭湯のCategoryInfoが返る", () => {
    const info = getCategoryInfo("public_bath");
    expect(info.label).not.toBe("スポット");
  });

  test("sauna → サウナのCategoryInfoが返る", () => {
    const info = getCategoryInfo("sauna");
    expect(info.label).not.toBe("スポット");
  });

  test("department_store → ショッピングのCategoryInfoが返る", () => {
    const info = getCategoryInfo("department_store");
    expect(info.label).not.toBe("スポット");
  });

  test("beach → ビーチのCategoryInfoが返る", () => {
    const info = getCategoryInfo("beach");
    expect(info.label).not.toBe("スポット");
  });

  test("campground → キャンプのCategoryInfoが返る", () => {
    const info = getCategoryInfo("campground");
    expect(info.label).not.toBe("スポット");
  });
});

describe("pickCategoryFromAPIPlaceTypes", () => {
  test("typesの先頭がCATEGORY_MAPにある場合はそのキーを返す", () => {
    expect(
      pickCategoryFromAPIPlaceTypes(["cafe", "food", "establishment"]),
    ).toBe("cafe");
  });

  test("先頭が未知でも後続に既知のキーがあればそれを返す", () => {
    expect(
      pickCategoryFromAPIPlaceTypes(["food", "bakery", "establishment"]),
    ).toBe("bakery");
  });

  test("複数未知の後に既知がある場合もマッチする", () => {
    expect(
      pickCategoryFromAPIPlaceTypes([
        "point_of_interest",
        "establishment",
        "restaurant",
      ]),
    ).toBe("restaurant");
  });

  test("CATEGORY_MAPにない場合はtypes[0]を返す", () => {
    expect(
      pickCategoryFromAPIPlaceTypes(["unknown_type", "also_unknown"]),
    ).toBe("unknown_type");
  });

  test("空配列の場合は'other'を返す", () => {
    expect(pickCategoryFromAPIPlaceTypes([])).toBe("other");
  });

  test("bakeryのtypesが[food, bakery, ...]の順でもbakeryを返す", () => {
    expect(
      pickCategoryFromAPIPlaceTypes([
        "food",
        "bakery",
        "store",
        "point_of_interest",
        "establishment",
      ]),
    ).toBe("bakery");
  });
});
