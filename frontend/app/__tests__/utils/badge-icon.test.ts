import { describe, test, expect } from "vitest";
import { getBadgeIcon } from "~/utils/badge-icon";

describe("getBadgeIcon", () => {
  test("既知のバッジ名に対して正しいアイコン情報を返す", () => {
    const result = getBadgeIcon("最初の一歩");
    expect(result.icon).toBe("footprint");
    expect(result.color).toBe("text-primary");
    expect(result.border).toBe("border-primary");
  });

  test("コンフォートゾーン・ブレイカーのアイコン", () => {
    const result = getBadgeIcon("コンフォートゾーン・ブレイカー");
    expect(result.icon).toBe("rocket_launch");
    expect(result.color).toBe("text-amber-500");
  });

  test("ストリークマスター Lv.3 は赤色", () => {
    const result = getBadgeIcon("ストリークマスター Lv.3");
    expect(result.icon).toBe("local_fire_department");
    expect(result.color).toBe("text-red-500");
  });

  test("未知のバッジ名はデフォルトアイコンを返す", () => {
    const result = getBadgeIcon("存在しないバッジ");
    expect(result.icon).toBe("military_tech");
    expect(result.color).toBe("text-primary");
    expect(result.border).toBe("border-primary");
  });

  test("空文字はデフォルトアイコンを返す", () => {
    const result = getBadgeIcon("");
    expect(result.icon).toBe("military_tech");
  });

  test("ジャンルコレクター各レベルでアイコンは同一、ボーダーが異なる", () => {
    const lv1 = getBadgeIcon("ジャンルコレクター Lv.1");
    const lv3 = getBadgeIcon("ジャンルコレクター Lv.3");
    expect(lv1.icon).toBe(lv3.icon);
    expect(lv1.border).not.toBe(lv3.border);
  });

  test("ナイトウォーカーのアイコン", () => {
    const result = getBadgeIcon("ナイトウォーカー");
    expect(result.icon).toBe("dark_mode");
  });
});
