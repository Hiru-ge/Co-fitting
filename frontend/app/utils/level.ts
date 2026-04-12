// レベルアップに必要な累計XP閾値（インデックス = レベル - 1）
// バックエンドの gamification.go の levelThresholds と完全に一致させること
export const LEVEL_XP_THRESHOLDS = [
  0, // Lv.1
  100, // Lv.2
  267, // Lv.3
  501, // Lv.4
  802, // Lv.5
  1170, // Lv.6
  1605, // Lv.7
  2107, // Lv.8
  2676, // Lv.9
  3312, // Lv.10
  4015, // Lv.11
  4785, // Lv.12
  5622, // Lv.13
  6526, // Lv.14
  7497, // Lv.15
  8535, // Lv.16
  9640, // Lv.17
  10812, // Lv.18
  12051, // Lv.19
  13357, // Lv.20
  14730, // Lv.21
  16170, // Lv.22
  17677, // Lv.23
  19251, // Lv.24
  20892, // Lv.25
  22600, // Lv.26
  24375, // Lv.27
  26217, // Lv.28
  28126, // Lv.29
  30000, // Lv.30
];

// レベル称号テーブル（インデックス = レベル - 1）
export const LEVEL_TITLES = [
  "ビギナーエクスプローラー", // Lv.1
  "シティウォーカー", // Lv.2
  "エリアハンター", // Lv.3
  "タウンエクスプローラー", // Lv.4
  "シティエクスプローラー", // Lv.5
  "アドベンチャー", // Lv.6
  "ゾーンブレイカー", // Lv.7
  "マスターエクスプローラー", // Lv.8
  "レジェンドエクスプローラー", // Lv.9
  "アルティメットエクスプローラー", // Lv.10
  "フロンティアウォーカー", // Lv.11
  "シティパイオニア", // Lv.12
  "タウンパイオニア", // Lv.13
  "エリアパイオニア", // Lv.14
  "フロンティアパイオニア", // Lv.15
  "アーバンベテラン", // Lv.16
  "エリートエクスプローラー", // Lv.17
  "エリートベテラン", // Lv.18
  "グランドウォーカー", // Lv.19
  "グランドエクスプローラー", // Lv.20
  "グランドパイオニア", // Lv.21
  "グランドベテラン", // Lv.22
  "グランドマスター", // Lv.23
  "エピックウォーカー", // Lv.24
  "エピックエクスプローラー", // Lv.25
  "エピックパイオニア", // Lv.26
  "エピックベテラン", // Lv.27
  "レジェンドパイオニア", // Lv.28
  "レジェンドベテラン", // Lv.29
  "ロームマスター", // Lv.30
];

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

export interface LevelInfo {
  level: number;
  xpInCurrentLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
  isMaxLevel: boolean;
}

export function getLevelInfo(totalXp: number): LevelInfo {
  let level = 1;
  for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i++) {
    if (totalXp >= LEVEL_XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }

  const isMaxLevel = level >= LEVEL_XP_THRESHOLDS.length;
  const currentLevelStartXp = LEVEL_XP_THRESHOLDS[level - 1];
  const nextLevelStartXp = isMaxLevel
    ? currentLevelStartXp
    : LEVEL_XP_THRESHOLDS[level];

  const xpInCurrentLevel = totalXp - currentLevelStartXp;
  const xpToNextLevel = isMaxLevel ? 0 : nextLevelStartXp - totalXp;
  const progressPercent = isMaxLevel
    ? 100
    : (xpInCurrentLevel / (nextLevelStartXp - currentLevelStartXp)) * 100;

  return {
    level,
    xpInCurrentLevel,
    xpToNextLevel,
    progressPercent,
    isMaxLevel,
  };
}
