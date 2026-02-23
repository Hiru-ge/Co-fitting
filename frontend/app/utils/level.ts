// レベルアップに必要な累計XP閾値（インデックス = レベル - 1）
export const LEVEL_XP_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

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
  const currentLevelStartXp = LEVEL_XP_THRESHOLDS[level - 1] ?? 0;
  const nextLevelStartXp = LEVEL_XP_THRESHOLDS[level] ?? currentLevelStartXp + 1000;

  const xpInCurrentLevel = totalXp - currentLevelStartXp;
  const xpToNextLevel = nextLevelStartXp - totalXp;
  const progressPercent = isMaxLevel
    ? 100
    : (xpInCurrentLevel / (nextLevelStartXp - currentLevelStartXp)) * 100;

  return { level, xpInCurrentLevel, xpToNextLevel, progressPercent, isMaxLevel };
}
