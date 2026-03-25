import { describe, test, expect } from "vitest";
import {
  formatDate,
  formatMonth,
  formatShortDate,
  groupByMonth,
  formatDistance,
  buildGoogleMapsPlaceUrl,
} from "~/utils/helpers";

describe("formatDate", () => {
  test("ISO文字列を「YYYY年M月D日」形式に変換する", () => {
    expect(formatDate("2024-03-15T10:00:00")).toBe("2024年3月15日");
  });

  test("月が1桁のときゼロパディングなし", () => {
    expect(formatDate("2024-01-05T00:00:00")).toBe("2024年1月5日");
  });

  test("12月31日", () => {
    expect(formatDate("2024-12-31T23:59:59")).toBe("2024年12月31日");
  });
});

describe("formatMonth", () => {
  test("ISO文字列を「YYYY年M月」形式に変換する", () => {
    expect(formatMonth("2024-03-15T10:00:00")).toBe("2024年3月");
  });

  test("1月の場合", () => {
    expect(formatMonth("2024-01-01T00:00:00")).toBe("2024年1月");
  });
});

describe("formatShortDate", () => {
  test("ISO文字列を「M月D日」形式に変換する", () => {
    expect(formatShortDate("2024-03-15T10:00:00")).toBe("3月15日");
  });

  test("1月1日", () => {
    expect(formatShortDate("2024-01-01T00:00:00")).toBe("1月1日");
  });
});

describe("groupByMonth", () => {
  type Item = { date: string; name: string };

  test("同じ月のアイテムが同じグループにまとまる", () => {
    const items: Item[] = [
      { date: "2024-03-01T00:00:00", name: "A" },
      { date: "2024-03-15T00:00:00", name: "B" },
      { date: "2024-04-01T00:00:00", name: "C" },
    ];
    const result = groupByMonth(items, (item) => item.date);
    expect(result.size).toBe(2);
    expect(result.get("2024年3月")).toHaveLength(2);
    expect(result.get("2024年4月")).toHaveLength(1);
  });

  test("空の配列は空の Map を返す", () => {
    const result = groupByMonth([], (item: Item) => item.date);
    expect(result.size).toBe(0);
  });

  test("挿入順を保持する", () => {
    const items: Item[] = [
      { date: "2024-05-01T00:00:00", name: "A" },
      { date: "2024-03-01T00:00:00", name: "B" },
    ];
    const result = groupByMonth(items, (item) => item.date);
    const keys = Array.from(result.keys());
    expect(keys[0]).toBe("2024年5月");
    expect(keys[1]).toBe("2024年3月");
  });
});

describe("formatDistance", () => {
  test("1000m 未満はメートル表示", () => {
    expect(formatDistance(500)).toBe("500m");
    expect(formatDistance(999)).toBe("999m");
  });

  test("1000m 以上はキロメートル表示（小数点1桁）", () => {
    expect(formatDistance(1000)).toBe("1.0km");
    expect(formatDistance(1500)).toBe("1.5km");
    expect(formatDistance(10000)).toBe("10.0km");
  });

  test("端数は四捨五入される（メートル）", () => {
    expect(formatDistance(500.6)).toBe("501m");
    expect(formatDistance(499.4)).toBe("499m");
  });

  test("0m はメートル表示", () => {
    expect(formatDistance(0)).toBe("0m");
  });

  test("999.5m は四捨五入で 1000m 表示（< 1000 のため km 変換されない）", () => {
    // 999.5 < 1000 なので else 分岐に入り、Math.round(999.5) = 1000 → "1000m"
    expect(formatDistance(999.5)).toBe("1000m");
  });

  test("999.4m は四捨五入で 999m 表示", () => {
    expect(formatDistance(999.4)).toBe("999m");
  });
});

describe("buildGoogleMapsPlaceUrl", () => {
  test("place_id を埋め込んだ Google Maps URL を返す", () => {
    const url = buildGoogleMapsPlaceUrl("ChIJN1t_tDeuEmsRUsoyG83frY4");
    expect(url).toBe(
      "https://www.google.com/maps/place/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
  });

  test("空文字列の place_id でも URL 形式を維持する", () => {
    const url = buildGoogleMapsPlaceUrl("");
    expect(url).toBe("https://www.google.com/maps/place/?q=place_id:");
  });

  test("特殊文字を含む place_id でも文字列をそのまま埋め込む", () => {
    const url = buildGoogleMapsPlaceUrl("abc_123-XYZ");
    expect(url).toContain("place_id:abc_123-XYZ");
  });
});
