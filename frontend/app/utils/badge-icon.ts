const BADGE_ICON_MAP: Record<
  string,
  { icon: string; color: string; border: string }
> = {
  最初の一歩: {
    icon: "footprint",
    color: "text-primary",
    border: "border-primary",
  },
  ジャンル開拓者: {
    icon: "rocket_launch",
    color: "text-amber-500",
    border: "border-amber-400",
  },
  "ジャンルコレクター Lv.1": {
    icon: "collections_bookmark",
    color: "text-indigo-500",
    border: "border-indigo-400",
  },
  "ジャンルコレクター Lv.2": {
    icon: "collections_bookmark",
    color: "text-indigo-500",
    border: "border-indigo-500",
  },
  "ジャンルコレクター Lv.3": {
    icon: "collections_bookmark",
    color: "text-indigo-600",
    border: "border-indigo-600",
  },
  "ストリークマスター Lv.1": {
    icon: "local_fire_department",
    color: "text-orange-500",
    border: "border-orange-400",
  },
  "ストリークマスター Lv.2": {
    icon: "local_fire_department",
    color: "text-orange-500",
    border: "border-orange-500",
  },
  "ストリークマスター Lv.3": {
    icon: "local_fire_department",
    color: "text-red-500",
    border: "border-red-500",
  },
  エリアパイオニア: {
    icon: "explore",
    color: "text-green-500",
    border: "border-green-400",
  },
  ナイトウォーカー: {
    icon: "dark_mode",
    color: "text-indigo-500",
    border: "border-indigo-500",
  },
  ウィークエンドウォリアー: {
    icon: "weekend",
    color: "text-purple-500",
    border: "border-purple-400",
  },
};

const DEFAULT_BADGE = {
  icon: "military_tech",
  color: "text-primary",
  border: "border-primary",
};

export function getBadgeIcon(badgeName: string) {
  return BADGE_ICON_MAP[badgeName] ?? DEFAULT_BADGE;
}
