export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const DEFAULT_LOCATION = { lat: 35.658, lng: 139.7016 }; // 渋谷
export const DEFAULT_RADIUS = 10000; // 10km
export const ONBOARDING_SKIPPED_KEY = "onboarding_skipped";
export const HOME_TOUR_SEEN_KEY = "home_tour_seen";
export const PROFILE_TOUR_KEY = "profile_tour_active";
export const CHECKIN_DISTANCE_THRESHOLD = 200; // 訪問ボタンを有効にする距離（メートル）
