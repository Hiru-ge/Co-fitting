import { describe, test, expect } from "vitest";
import {
  LEVEL_XP_THRESHOLDS,
  LEVEL_TITLES,
  getLevelTitle,
  getLevelInfo,
} from "~/utils/level";

describe("LEVEL_XP_THRESHOLDS", () => {
  test("最初のレベルは 0 XP から始まる", () => {
    expect(LEVEL_XP_THRESHOLDS[0]).toBe(0);
  });

  test("閾値は昇順になっている", () => {
    for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i++) {
      expect(LEVEL_XP_THRESHOLDS[i]).toBeGreaterThan(LEVEL_XP_THRESHOLDS[i - 1]);
    }
  });
});

describe("getLevelTitle", () => {
  test("レベル1 は ビギナーエクスプローラー", () => {
    expect(getLevelTitle(1)).toBe("ビギナーエクスプローラー");
  });

  test("レベル10 は 究極のローマー", () => {
    expect(getLevelTitle(10)).toBe("究極のローマー");
  });

  test("最大レベルを超えても最後の称号を返す", () => {
    expect(getLevelTitle(99)).toBe(LEVEL_TITLES[LEVEL_TITLES.length - 1]);
  });

  test("レベル5 の称号を返す", () => {
    expect(getLevelTitle(5)).toBe("シティエクスプローラー");
  });
});

describe("getLevelInfo", () => {
  test("XP が 0 のときレベル1、進捗 0%", () => {
    const info = getLevelInfo(0);
    expect(info.level).toBe(1);
    expect(info.xpInCurrentLevel).toBe(0);
    expect(info.progressPercent).toBe(0);
    expect(info.isMaxLevel).toBe(false);
  });

  test("XP が 100 のときレベル2 に上がる", () => {
    const info = getLevelInfo(100);
    expect(info.level).toBe(2);
    expect(info.isMaxLevel).toBe(false);
  });

  test("XP がレベル1 の途中（50 XP）", () => {
    const info = getLevelInfo(50);
    expect(info.level).toBe(1);
    expect(info.xpInCurrentLevel).toBe(50);
    expect(info.xpToNextLevel).toBe(50);
    expect(info.progressPercent).toBe(50);
  });

  test("XP が 300 のときレベル3 に上がる", () => {
    const info = getLevelInfo(300);
    expect(info.level).toBe(3);
  });

  test("最大レベル到達時は isMaxLevel が true、progressPercent が 100", () => {
    const maxXp = LEVEL_XP_THRESHOLDS[LEVEL_XP_THRESHOLDS.length - 1];
    const info = getLevelInfo(maxXp);
    expect(info.isMaxLevel).toBe(true);
    expect(info.progressPercent).toBe(100);
  });

  test("最大レベルを超えた XP でも isMaxLevel が true", () => {
    const info = getLevelInfo(99999);
    expect(info.isMaxLevel).toBe(true);
    expect(info.progressPercent).toBe(100);
  });

  test("xpToNextLevel が正しく計算される", () => {
    // レベル1（0〜100）で 30 XP → 残り 70 XP
    const info = getLevelInfo(30);
    expect(info.xpToNextLevel).toBe(70);
  });
});
