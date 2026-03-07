export const GA4_ID = import.meta.env.VITE_GA4_ID ?? "";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

function gtag(...args: unknown[]) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag(...args);
}

export function sendPageView(path: string) {
  gtag("event", "page_view", { page_path: path });
}

export function sendLogin(method: string, isNewUser: boolean) {
  gtag("event", "login", { method, is_new_user: isNewUser });
}

export function sendOnboardingCompleted(tagCount: number, tagNames: string[]) {
  gtag("event", "onboarding_completed", {
    tag_count: tagCount,
    tag_names: tagNames.join(","),
  });
}

export function sendOnboardingSkipped() {
  gtag("event", "onboarding_skipped");
}

export function sendInterestsUpdated(tagCount: number) {
  gtag("event", "interests_updated", { tag_count: tagCount });
}

export function sendSearchRadiusUpdated(radiusKm: number) {
  gtag("event", "search_radius_updated", { radius_km: radiusKm });
}

export function sendSuggestionGenerated(params: {
  placesCount: number;
  interestMatchCount: number;
  breakoutCount: number;
  categories: string[];
  isReload: boolean;
}) {
  gtag("event", "suggestion_generated", {
    places_count: params.placesCount,
    interest_match_count: params.interestMatchCount,
    breakout_count: params.breakoutCount,
    categories: params.categories.join(","),
    is_reload: params.isReload,
  });
}

export function sendSuggestionViewed(params: {
  placeName: string;
  category: string;
  isInterestMatch: boolean;
  isBreakout: boolean;
  cardIndex: number;
}) {
  gtag("event", "suggestion_viewed", {
    place_name: params.placeName,
    category: params.category,
    is_interest_match: params.isInterestMatch,
    is_breakout: params.isBreakout,
    card_index: params.cardIndex,
  });
}

export function sendSuggestionSkipped(params: {
  placeName: string;
  category: string;
  isInterestMatch: boolean;
  isBreakout: boolean;
}) {
  gtag("event", "suggestion_skipped", {
    place_name: params.placeName,
    category: params.category,
    is_interest_match: params.isInterestMatch,
    is_breakout: params.isBreakout,
  });
}

export function sendSuggestionReloaded(reloadCountRemaining: number) {
  gtag("event", "suggestion_reloaded", {
    reload_count_remaining: reloadCountRemaining,
  });
}

export function sendVisitRecorded(params: {
  placeName: string;
  category: string;
  isBreakout: boolean;
  xpEarned?: number;
  xpBase?: number;
  firstAreaBonus?: number;
  streakBonus?: number;
}) {
  gtag("event", "visit_recorded", {
    place_name: params.placeName,
    category: params.category,
    is_breakout: params.isBreakout,
    xp_earned: params.xpEarned,
    xp_base: params.xpBase,
    first_area_bonus: params.firstAreaBonus,
    streak_bonus: params.streakBonus,
  });
}

export function sendDailyCompleted() {
  gtag("event", "daily_completed");
}

export function sendVisitMemoSaved(params: {
  hasMemo: boolean;
  rating: number | null;
}) {
  gtag("event", "visit_memo_saved", {
    has_memo: params.hasMemo,
    rating: params.rating,
  });
}

export function sendBadgeEarned(badgeName: string) {
  gtag("event", "badge_earned", { badge_name: badgeName });
}

export function sendLevelUp(newLevel: number) {
  gtag("event", "level_up", { new_level: newLevel });
}
