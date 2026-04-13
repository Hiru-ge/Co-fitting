export interface CategoryInfo {
  label: string;
  icon: string;
  gradientColor: string;
  hexColor: string;
}

const DEFAULT_CATEGORY: CategoryInfo = {
  label: "お店",
  icon: "location_on",
  gradientColor: "from-gray-500 to-gray-700",
  hexColor: "#6b7280",
};

export const CATEGORY_MAP: Record<string, CategoryInfo> = {
  cafe: {
    label: "カフェ",
    icon: "local_cafe",
    gradientColor: "from-amber-600 to-orange-800",
    hexColor: "#d97706",
  },
  restaurant: {
    label: "レストラン",
    icon: "restaurant",
    gradientColor: "from-red-500 to-rose-700",
    hexColor: "#ef4444",
  },
  meal_takeaway: {
    label: "レストラン",
    icon: "restaurant",
    gradientColor: "from-red-500 to-rose-700",
    hexColor: "#ef4444",
  },
  bar: {
    label: "バー",
    icon: "local_bar",
    gradientColor: "from-purple-600 to-indigo-800",
    hexColor: "#9333ea",
  },
  night_club: {
    label: "クラブ",
    icon: "nightlife",
    gradientColor: "from-fuchsia-600 to-purple-800",
    hexColor: "#c026d3",
  },
  bakery: {
    label: "ベーカリー",
    icon: "bakery_dining",
    gradientColor: "from-orange-400 to-amber-600",
    hexColor: "#fb923c",
  },
  ramen_restaurant: {
    label: "ラーメン",
    icon: "ramen_dining",
    gradientColor: "from-red-600 to-orange-800",
    hexColor: "#dc2626",
  },
  book_store: {
    label: "書店",
    icon: "menu_book",
    gradientColor: "from-yellow-600 to-amber-800",
    hexColor: "#ca8a04",
  },
  movie_theater: {
    label: "映画館",
    icon: "movie",
    gradientColor: "from-slate-600 to-gray-800",
    hexColor: "#475569",
  },
  bowling_alley: {
    label: "ボウリング",
    icon: "directions_run",
    gradientColor: "from-blue-600 to-indigo-800",
    hexColor: "#2563eb",
  },
  karaoke: {
    label: "カラオケ",
    icon: "mic",
    gradientColor: "from-pink-500 to-rose-700",
    hexColor: "#ec4899",
  },
  amusement_center: {
    label: "ゲームセンター",
    icon: "videogame_asset",
    gradientColor: "from-violet-500 to-purple-700",
    hexColor: "#8b5cf6",
  },
  video_arcade: {
    label: "ゲームセンター",
    icon: "videogame_asset",
    gradientColor: "from-violet-500 to-purple-700",
    hexColor: "#8b5cf6",
  },
  spa: {
    label: "スパ",
    icon: "spa",
    gradientColor: "from-teal-400 to-cyan-600",
    hexColor: "#2dd4bf",
  },
  public_bath: {
    label: "銭湯",
    icon: "hot_tub",
    gradientColor: "from-cyan-600 to-teal-800",
    hexColor: "#0891b2",
  },
  sauna: {
    label: "サウナ",
    icon: "hot_tub",
    gradientColor: "from-orange-700 to-red-900",
    hexColor: "#c2410c",
  },
  clothing_store: {
    label: "ショップ",
    icon: "shopping_bag",
    gradientColor: "from-pink-400 to-rose-600",
    hexColor: "#f472b6",
  },
  home_goods_store: {
    label: "雑貨",
    icon: "home",
    gradientColor: "from-amber-500 to-orange-700",
    hexColor: "#f59e0b",
  },
  プレミア: {
    label: "プレミア",
    icon: "award_star",
    gradientColor: "from-amber-500 to-yellow-700",
    hexColor: "#f59e0b",
  },
};

export function getCategoryInfo(category: string): CategoryInfo {
  return CATEGORY_MAP[category] || DEFAULT_CATEGORY;
}

export function pickCategoryFromAPIPlaceTypes(placeTypes: string[]): string {
  for (const type of placeTypes) {
    if (CATEGORY_MAP[type]) {
      return type;
    }
  }
  if (import.meta.env.DEV && placeTypes.length > 0) {
    console.warn(
      `[category-map] No CATEGORY_MAP entry found for types: [${placeTypes.join(", ")}]. Falling back to "${placeTypes[0]}".`,
    );
  }
  return placeTypes[0] || "other";
}
