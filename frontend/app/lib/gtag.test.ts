import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  sendPageView,
  sendSuggestionGenerated,
  sendVisitRecorded,
  sendPushPermissionGranted,
} from "~/lib/gtag";

describe("gtag wrappers", () => {
  beforeEach(() => {
    (window as Window & { gtag?: (...args: unknown[]) => void }).gtag = vi.fn();
  });

  test("sendPageViewがpage_viewを送る", () => {
    sendPageView("/home");
    expect(window.gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/home",
    });
  });

  test("sendSuggestionGeneratedが集計値を送る", () => {
    sendSuggestionGenerated({
      placesCount: 3,
      interestMatchCount: 2,
      breakoutCount: 1,
      categories: ["カフェ", "ボウリング"],
      isReload: true,
    });

    expect(window.gtag).toHaveBeenCalledWith("event", "suggestion_generated", {
      places_count: 3,
      interest_match_count: 2,
      breakout_count: 1,
      categories: "カフェ,ボウリング",
      is_reload: true,
    });
  });

  test("sendVisitRecordedがXP関連フィールドを送る", () => {
    sendVisitRecorded({
      placeName: "テストカフェ",
      category: "カフェ",
      isBreakout: false,
      xpEarned: 80,
      xpBase: 50,
      firstAreaBonus: 30,
      streakBonus: 0,
    });

    expect(window.gtag).toHaveBeenCalledWith("event", "visit_recorded", {
      place_name: "テストカフェ",
      category: "カフェ",
      is_breakout: false,
      xp_earned: 80,
      xp_base: 50,
      first_area_bonus: 30,
      streak_bonus: 0,
    });
  });

  test("sendPushPermissionGrantedがsourceを送る", () => {
    sendPushPermissionGranted("banner");
    expect(window.gtag).toHaveBeenCalledWith(
      "event",
      "push_permission_granted",
      {
        source: "banner",
      },
    );
  });
});
