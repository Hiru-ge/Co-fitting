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

const CATEGORY_MAP: Record<string, CategoryInfo> = {
  cafe: { label: "カフェ", icon: "coffee", gradient: "from-amber-600 to-orange-800" },
  restaurant: { label: "レストラン", icon: "restaurant", gradient: "from-red-500 to-rose-700" },
  bar: { label: "バー", icon: "local_bar", gradient: "from-purple-600 to-indigo-800" },
  park: { label: "公園", icon: "park", gradient: "from-green-500 to-emerald-700" },
  museum: { label: "美術館", icon: "museum", gradient: "from-blue-500 to-indigo-700" },
  art_gallery: { label: "ギャラリー", icon: "palette", gradient: "from-pink-500 to-fuchsia-700" },
  library: { label: "図書館", icon: "local_library", gradient: "from-cyan-600 to-blue-800" },
  book_store: { label: "書店", icon: "menu_book", gradient: "from-yellow-600 to-amber-800" },
  clothing_store: { label: "ショップ", icon: "shopping_bag", gradient: "from-pink-400 to-rose-600" },
  shopping_mall: { label: "モール", icon: "storefront", gradient: "from-violet-500 to-purple-700" },
  movie_theater: { label: "映画館", icon: "movie", gradient: "from-slate-600 to-gray-800" },
  gym: { label: "ジム", icon: "fitness_center", gradient: "from-orange-500 to-red-700" },
  spa: { label: "スパ", icon: "spa", gradient: "from-teal-400 to-cyan-600" },
  bakery: { label: "ベーカリー", icon: "bakery_dining", gradient: "from-orange-400 to-amber-600" },
  tourist_attraction: { label: "観光地", icon: "tour", gradient: "from-sky-500 to-blue-700" },
  temple: { label: "寺院", icon: "temple_buddhist", gradient: "from-red-700 to-rose-900" },
  shrine: { label: "神社", icon: "temple_buddhist", gradient: "from-red-600 to-orange-800" },
  church: { label: "教会", icon: "church", gradient: "from-indigo-500 to-violet-700" },
  night_club: { label: "クラブ", icon: "nightlife", gradient: "from-fuchsia-600 to-purple-800" },
  amusement_park: { label: "遊園地", icon: "attractions", gradient: "from-yellow-400 to-orange-600" },
  aquarium: { label: "水族館", icon: "water", gradient: "from-blue-400 to-cyan-600" },
  zoo: { label: "動物園", icon: "pets", gradient: "from-lime-500 to-green-700" },
  stadium: { label: "スタジアム", icon: "stadium", gradient: "from-emerald-500 to-teal-700" },
};

export function getCategoryInfo(types: string[]): CategoryInfo {
  for (const type of types) {
    if (CATEGORY_MAP[type]) {
      return CATEGORY_MAP[type];
    }
  }
  return DEFAULT_CATEGORY;
}
