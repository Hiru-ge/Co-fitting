export interface CategoryInfo {
  label: string;
  icon: string;
  gradient: string;
}

const DEFAULT_CATEGORY: CategoryInfo = {
  label: "スポット",
  icon: "location_on",
  gradient: "from-gray-500 to-gray-700",
};

export const CATEGORY_MAP: Record<string, CategoryInfo> = {
  // 飲食
  cafe: {
    label: "カフェ",
    icon: "local_cafe",
    gradient: "from-amber-600 to-orange-800",
  },
  restaurant: {
    label: "レストラン",
    icon: "restaurant",
    gradient: "from-red-500 to-rose-700",
  },
  meal_takeaway: {
    label: "テイクアウト",
    icon: "takeout_dining",
    gradient: "from-orange-500 to-red-700",
  },
  bar: {
    label: "バー",
    icon: "local_bar",
    gradient: "from-purple-600 to-indigo-800",
  },
  night_club: {
    label: "クラブ",
    icon: "nightlife",
    gradient: "from-fuchsia-600 to-purple-800",
  },
  bakery: {
    label: "ベーカリー",
    icon: "bakery_dining",
    gradient: "from-orange-400 to-amber-600",
  },
  ramen_restaurant: {
    label: "ラーメン",
    icon: "ramen_dining",
    gradient: "from-red-600 to-orange-800",
  },
  // アウトドア・自然
  park: {
    label: "公園",
    icon: "park",
    gradient: "from-green-500 to-emerald-700",
  },
  campground: {
    label: "キャンプ",
    icon: "forest",
    gradient: "from-green-700 to-emerald-900",
  },
  beach: {
    label: "ビーチ",
    icon: "beach_access",
    gradient: "from-cyan-400 to-blue-600",
  },
  lake: {
    label: "湖・川",
    icon: "water",
    gradient: "from-blue-500 to-cyan-700",
  },
  river: { label: "川", icon: "water", gradient: "from-teal-500 to-cyan-700" },
  // 文化・芸術
  museum: {
    label: "美術館",
    icon: "museum",
    gradient: "from-blue-500 to-indigo-700",
  },
  art_gallery: {
    label: "ギャラリー",
    icon: "palette",
    gradient: "from-pink-500 to-fuchsia-700",
  },
  library: {
    label: "図書館",
    icon: "local_library",
    gradient: "from-cyan-600 to-blue-800",
  },
  book_store: {
    label: "書店",
    icon: "menu_book",
    gradient: "from-yellow-600 to-amber-800",
  },
  // エンタメ
  movie_theater: {
    label: "映画館",
    icon: "movie",
    gradient: "from-slate-600 to-gray-800",
  },
  bowling_alley: {
    label: "ボーリング",
    icon: "sports_cricket",
    gradient: "from-blue-600 to-indigo-800",
  },
  karaoke: {
    label: "カラオケ",
    icon: "mic",
    gradient: "from-pink-500 to-rose-700",
  },
  amusement_center: {
    label: "ゲームセンター",
    icon: "videogame_asset",
    gradient: "from-violet-500 to-purple-700",
  },
  video_arcade: {
    label: "ゲームセンター",
    icon: "videogame_asset",
    gradient: "from-violet-500 to-purple-700",
  },
  amusement_park: {
    label: "遊園地",
    icon: "attractions",
    gradient: "from-yellow-400 to-orange-600",
  },
  aquarium: {
    label: "水族館",
    icon: "water",
    gradient: "from-blue-400 to-cyan-600",
  },
  zoo: {
    label: "動物園",
    icon: "pets",
    gradient: "from-lime-500 to-green-700",
  },
  // スポーツ・アクティブ
  gym: {
    label: "ジム",
    icon: "fitness_center",
    gradient: "from-orange-500 to-red-700",
  },
  fitness_center: {
    label: "ジム",
    icon: "fitness_center",
    gradient: "from-orange-500 to-red-700",
  },
  stadium: {
    label: "スタジアム",
    icon: "stadium",
    gradient: "from-emerald-500 to-teal-700",
  },
  // リラクゼーション
  spa: { label: "スパ", icon: "spa", gradient: "from-teal-400 to-cyan-600" },
  public_bath: {
    label: "銭湯",
    icon: "hot_tub",
    gradient: "from-cyan-600 to-teal-800",
  },
  sauna: {
    label: "サウナ",
    icon: "hot_tub",
    gradient: "from-orange-700 to-red-900",
  },
  // ショッピング
  clothing_store: {
    label: "ショップ",
    icon: "shopping_bag",
    gradient: "from-pink-400 to-rose-600",
  },
  shopping_mall: {
    label: "モール",
    icon: "storefront",
    gradient: "from-violet-500 to-purple-700",
  },
  department_store: {
    label: "デパート",
    icon: "storefront",
    gradient: "from-violet-400 to-purple-600",
  },
  home_goods_store: {
    label: "雑貨",
    icon: "home",
    gradient: "from-amber-500 to-orange-700",
  },
  // 観光・文化
  tourist_attraction: {
    label: "観光地",
    icon: "tour",
    gradient: "from-sky-500 to-blue-700",
  },
  temple: {
    label: "寺院",
    icon: "temple_buddhist",
    gradient: "from-red-700 to-rose-900",
  },
  shrine: {
    label: "神社",
    icon: "temple_buddhist",
    gradient: "from-red-600 to-orange-800",
  },
  church: {
    label: "教会",
    icon: "church",
    gradient: "from-indigo-500 to-violet-700",
  },
  hindu_temple: {
    label: "寺院",
    icon: "temple_buddhist",
    gradient: "from-red-700 to-rose-900",
  },
  mosque: {
    label: "モスク",
    icon: "temple_buddhist",
    gradient: "from-green-600 to-teal-800",
  },
  synagogue: {
    label: "礼拝堂",
    icon: "temple_buddhist",
    gradient: "from-indigo-600 to-blue-800",
  },
};

export function getCategoryInfo(types: string[]): CategoryInfo {
  for (const type of types) {
    if (CATEGORY_MAP[type]) {
      return CATEGORY_MAP[type];
    }
  }
  return DEFAULT_CATEGORY;
}

/**
 * カテゴリーキーから直接カテゴリー情報を取得する（訪問履歴フィルター用）
 */
export function getCategoryInfoByKey(key: string): CategoryInfo {
  return CATEGORY_MAP[key] || DEFAULT_CATEGORY;
}

/**
 * place.types 配列から CATEGORY_MAP にマッチする最初のキーを返す。
 * 訪問記録保存時に使用し、types[0] ではなく適切なキーを選択することで
 * 「スポット」へのフォールバックを防ぐ。
 * マッチするキーがない場合は types[0] を返す（空配列の場合は "other"）。
 * 開発環境ではフォールバック時に console.warn を出力してマッピング漏れを検出できる。
 */
export function getBestCategoryKey(types: string[]): string {
  for (const type of types) {
    if (CATEGORY_MAP[type]) {
      return type;
    }
  }
  if (import.meta.env.DEV && types.length > 0) {
    console.warn(
      `[category-map] No CATEGORY_MAP entry found for types: [${types.join(", ")}]. Falling back to "${types[0]}".`,
    );
  }
  return types[0] || "other";
}
