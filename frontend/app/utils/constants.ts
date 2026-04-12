// 複数ファイルから参照される定数はここにまとめる。単一ファイルで完結する定数は、定数ファイルを作らずに直接そのファイル内で定義する。(関連するものはなるべく近くにまとまっていて欲しいため)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const DEFAULT_LOCATION = { lat: 35.658, lng: 139.7016 }; // 渋谷
export const DEFAULT_RADIUS = 10000; // 10km
export const ONBOARDING_SKIPPED_KEY = "onboarding_skipped";
export const HOME_TOUR_SEEN_KEY = "home_tour_seen";
export const ONBOARDING_STAGE_KEY = "onboarding_stage";
export const ONBOARDING_STAGE = {
  PROFILE_TOUR: "profile_tour",
  COMPLETED: "completed",
} as const;
export const CHECKIN_DISTANCE_THRESHOLD = 200; // 訪問ボタンを有効にする距離（メートル）
