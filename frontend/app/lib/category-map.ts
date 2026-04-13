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
    label: "テイクアウト",
    icon: "takeout_dining",
    gradientColor: "from-orange-500 to-red-700",
    hexColor: "#f97316",
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
  park: {
    label: "公園",
    icon: "park",
    gradientColor: "from-green-500 to-emerald-700",
    hexColor: "#22c55e",
  },
  campground: {
    label: "キャンプ",
    icon: "forest",
    gradientColor: "from-green-700 to-emerald-900",
    hexColor: "#15803d",
  },
  beach: {
    label: "ビーチ",
    icon: "beach_access",
    gradientColor: "from-cyan-400 to-blue-600",
    hexColor: "#22d3ee",
  },
  lake: {
    label: "湖・川",
    icon: "water",
    gradientColor: "from-blue-500 to-cyan-700",
    hexColor: "#3b82f6",
  },
  river: {
    label: "川",
    icon: "water",
    gradientColor: "from-teal-500 to-cyan-700",
    hexColor: "#14b8a6",
  },
  museum: {
    label: "美術館",
    icon: "museum",
    gradientColor: "from-blue-500 to-indigo-700",
    hexColor: "#3b82f6",
  },
  art_gallery: {
    label: "ギャラリー",
    icon: "palette",
    gradientColor: "from-pink-500 to-fuchsia-700",
    hexColor: "#ec4899",
  },
  library: {
    label: "図書館",
    icon: "local_library",
    gradientColor: "from-cyan-600 to-blue-800",
    hexColor: "#0891b2",
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
    label: "ボーリング",
    icon: "sports_cricket",
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
  amusement_park: {
    label: "遊園地",
    icon: "attractions",
    gradientColor: "from-yellow-400 to-orange-600",
    hexColor: "#facc15",
  },
  aquarium: {
    label: "水族館",
    icon: "water",
    gradientColor: "from-blue-400 to-cyan-600",
    hexColor: "#60a5fa",
  },
  zoo: {
    label: "動物園",
    icon: "pets",
    gradientColor: "from-lime-500 to-green-700",
    hexColor: "#84cc16",
  },
  gym: {
    label: "ジム",
    icon: "fitness_center",
    gradientColor: "from-orange-500 to-red-700",
    hexColor: "#f97316",
  },
  fitness_center: {
    label: "ジム",
    icon: "fitness_center",
    gradientColor: "from-orange-500 to-red-700",
    hexColor: "#f97316",
  },
  stadium: {
    label: "スタジアム",
    icon: "stadium",
    gradientColor: "from-emerald-500 to-teal-700",
    hexColor: "#10b981",
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
  shopping_mall: {
    label: "モール",
    icon: "storefront",
    gradientColor: "from-violet-500 to-purple-700",
    hexColor: "#8b5cf6",
  },
  department_store: {
    label: "デパート",
    icon: "storefront",
    gradientColor: "from-violet-400 to-purple-600",
    hexColor: "#a78bfa",
  },
  home_goods_store: {
    label: "雑貨",
    icon: "home",
    gradientColor: "from-amber-500 to-orange-700",
    hexColor: "#f59e0b",
  },
  tourist_attraction: {
    label: "観光地",
    icon: "tour",
    gradientColor: "from-sky-500 to-blue-700",
    hexColor: "#0ea5e9",
  },
  temple: {
    label: "寺院",
    icon: "temple_buddhist",
    gradientColor: "from-red-700 to-rose-900",
    hexColor: "#b91c1c",
  },
  shrine: {
    label: "神社",
    icon: "temple_buddhist",
    gradientColor: "from-red-600 to-orange-800",
    hexColor: "#dc2626",
  },
  church: {
    label: "教会",
    icon: "church",
    gradientColor: "from-indigo-500 to-violet-700",
    hexColor: "#6366f1",
  },
  hindu_temple: {
    label: "寺院",
    icon: "temple_buddhist",
    gradientColor: "from-red-700 to-rose-900",
    hexColor: "#b91c1c",
  },
  mosque: {
    label: "モスク",
    icon: "temple_buddhist",
    gradientColor: "from-green-600 to-teal-800",
    hexColor: "#16a34a",
  },
  synagogue: {
    label: "礼拝堂",
    icon: "temple_buddhist",
    gradientColor: "from-indigo-600 to-blue-800",
    hexColor: "#4f46e5",
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
