import { describe, test, expect } from "vitest";
import { getCategoryInfo } from "~/lib/category-map";

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
    expect(info.label).toBe("お店");
    expect(info.icon).toBe("location_on");
    expect(info.gradientColor).toContain("gray");
    expect(info.hexColor).toBe("#6b7280");
  });
});

describe("getCategoryInfo - 追加タイプ（Issue #226）", () => {
  test("ramen_restaurant → ラーメンのCategoryInfoが返る", () => {
    const info = getCategoryInfo("ramen_restaurant");
    expect(info.label).not.toBe("お店");
  });

  test("karaoke → カラオケのCategoryInfoが返る", () => {
    const info = getCategoryInfo("karaoke");
    expect(info.label).not.toBe("お店");
  });

  test("bowling_alley → ボウリングのCategoryInfoが返る", () => {
    const info = getCategoryInfo("bowling_alley");
    expect(info.label).not.toBe("お店");
  });

  test("amusement_center → ゲームセンターのCategoryInfoが返る", () => {
    const info = getCategoryInfo("amusement_center");
    expect(info.label).not.toBe("お店");
  });

  test("book_store → 書店のCategoryInfoが返る", () => {
    const info = getCategoryInfo("book_store");
    expect(info.label).not.toBe("お店");
  });

  test("public_bath → 銭湯のCategoryInfoが返る", () => {
    const info = getCategoryInfo("public_bath");
    expect(info.label).not.toBe("お店");
  });

  test("sauna → サウナのCategoryInfoが返る", () => {
    const info = getCategoryInfo("sauna");
    expect(info.label).not.toBe("お店");
  });

  test("home_goods_store → 雑貨のCategoryInfoが返る", () => {
    const info = getCategoryInfo("home_goods_store");
    expect(info.label).not.toBe("お店");
  });

  test("spa → スパのCategoryInfoが返る", () => {
    const info = getCategoryInfo("spa");
    expect(info.label).not.toBe("お店");
  });

  test("night_club → クラブのCategoryInfoが返る", () => {
    const info = getCategoryInfo("night_club");
    expect(info.label).not.toBe("お店");
  });

  test("プレミア → プレミアのCategoryInfoが返る", () => {
    const info = getCategoryInfo("プレミア");
    expect(info.label).toBe("プレミア");
    expect(info.icon).toBe("award_star");
  });
});

describe("getCategoryInfo - バックエンド集約後の表示", () => {
  test("バックエンドで集約済みのキーをそのまま表示する", () => {
    const info = getCategoryInfo("restaurant");
    expect(info.label).toBe("レストラン");
  });

  test("完全に未知のキーはデフォルト（お店）になる", () => {
    const info = getCategoryInfo("some_unknown_key");
    expect(info.label).toBe("お店");
  });
});
