package services_test

import (
	"testing"
	"time"

	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
)

func TestIsVisitablePlace(t *testing.T) {
	t.Run("提案対象タイプを含む場合はtrue", func(t *testing.T) {
		if !services.IsVisitablePlace([]string{"real_estate_agency", "cafe"}) {
			t.Fatal("expected true")
		}
	})

	t.Run("提案対象タイプを含まない場合はfalse", func(t *testing.T) {
		if services.IsVisitablePlace([]string{"real_estate_agency", "locality"}) {
			t.Fatal("expected false")
		}
	})
}

func TestIsVisitablePlace_ExcludedTypes(t *testing.T) {
	excluded := []string{
		"park", "beach", "tourist_attraction", "church", "library",
		"museum", "art_gallery", "aquarium", "stadium", "shopping_mall",
		"department_store", "gym", "fitness_center",
	}
	for _, typ := range excluded {
		typ := typ
		t.Run(typ+"はfalse", func(t *testing.T) {
			if services.IsVisitablePlace([]string{typ}) {
				t.Fatalf("expected false for %s", typ)
			}
		})
	}
}

func TestGetGenreNameFromTypes(t *testing.T) {
	t.Run("最初に一致したジャンル名を返す", func(t *testing.T) {
		got := services.GetGenreNameFromTypes([]string{"cafe", "park"})
		if got != "カフェ" {
			t.Fatalf("expected カフェ, got %s", got)
		}
	})

	t.Run("一致しない場合は空文字", func(t *testing.T) {
		got := services.GetGenreNameFromTypes([]string{"airport", "locality"})
		if got != "" {
			t.Fatalf("expected empty, got %s", got)
		}
	})
}

func TestFilterOpenNowPlaces(t *testing.T) {
	open := true
	closed := false
	input := []services.PlaceResult{
		{PlaceID: "open", IsOpenNow: &open},
		{PlaceID: "closed", IsOpenNow: &closed},
		{PlaceID: "unknown", IsOpenNow: nil},
	}

	result := services.FilterOpenNowPlaces(input)
	if len(result) != 2 {
		t.Fatalf("expected 2 places, got %d", len(result))
	}
	if result[0].PlaceID != "open" || result[1].PlaceID != "unknown" {
		t.Fatalf("unexpected places: %+v", result)
	}
}

func TestClassifyByInterest(t *testing.T) {
	places := []services.PlaceResult{
		{PlaceID: "p1", Types: []string{"cafe"}},
		{PlaceID: "p2", Types: []string{"park"}},
		{PlaceID: "p3", Types: []string{"airport"}},
	}
	interest := map[string]bool{
		"カフェ": true,
	}

	inInterest, outOfInterest := services.ClassifyByInterest(places, interest)
	if len(inInterest) != 1 || len(outOfInterest) != 2 {
		t.Fatalf("unexpected split: in=%d out=%d", len(inInterest), len(outOfInterest))
	}
	if inInterest[0].PlaceID != "p1" {
		t.Fatalf("expected p1 in interest, got %s", inInterest[0].PlaceID)
	}
	if inInterest[0].IsInterestMatch == nil || !*inInterest[0].IsInterestMatch {
		t.Fatal("expected IsInterestMatch=true")
	}
}

func TestSelectPersonalizedPlaces(t *testing.T) {
	t.Run("興味内が2件ある場合は最低2件含まれる", func(t *testing.T) {
		inInterest := []services.PlaceResult{
			{PlaceID: "i1"},
			{PlaceID: "i2"},
		}
		out := []services.PlaceResult{{PlaceID: "o1"}, {PlaceID: "o2"}}

		selected := services.SelectPersonalizedPlaces(inInterest, out)
		if len(selected) != 3 {
			t.Fatalf("expected 3 places, got %d", len(selected))
		}

		ids := map[string]bool{}
		for _, p := range selected {
			ids[p.PlaceID] = true
		}
		if !ids["i1"] || !ids["i2"] {
			t.Fatalf("expected both in-interest places to be included: %+v", ids)
		}
	})

	t.Run("候補が3件未満ならそのまま返る", func(t *testing.T) {
		selected := services.SelectPersonalizedPlaces(
			[]services.PlaceResult{{PlaceID: "i1"}},
			[]services.PlaceResult{{PlaceID: "o1"}},
		)
		if len(selected) != 2 {
			t.Fatalf("expected 2 places, got %d", len(selected))
		}
	})
}

func TestGetUserInterestGenreNames(t *testing.T) {
	cleanupUsers(t)
	user := createUser(t, "suggestion-interest@example.com")
	cafe := getOrCreateGenreTag(t, "カフェ")
	park := getOrCreateGenreTag(t, "公園・緑地")

	testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafe.ID})
	testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: park.ID})

	names, err := services.GetUserInterestGenreNames(testDB, user.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !names["カフェ"] || !names["公園・緑地"] {
		t.Fatalf("expected interest names to include cafe and park, got %+v", names)
	}
}

func TestFilterOutVisited(t *testing.T) {
	cleanupUsers(t)
	user := createUser(t, "suggestion-visited@example.com")

	testDB.Create(&models.Visit{
		UserID:    user.ID,
		PlaceID:   "visited_recent",
		PlaceName: "Visited Recent",
		VisitedAt: time.Now(),
	})
	testDB.Create(&models.Visit{
		UserID:    user.ID,
		PlaceID:   "visited_old",
		PlaceName: "Visited Old",
		VisitedAt: time.Now().AddDate(0, 0, -31),
	})

	input := []services.PlaceResult{
		{PlaceID: "visited_recent"},
		{PlaceID: "visited_old"},
		{PlaceID: "new_place"},
	}

	result := services.FilterOutVisited(testDB, user.ID, input)
	ids := map[string]bool{}
	for _, p := range result {
		ids[p.PlaceID] = true
	}

	if ids["visited_recent"] {
		t.Fatal("recently visited place should be filtered out")
	}
	if !ids["visited_old"] || !ids["new_place"] {
		t.Fatalf("expected old and new places to remain, got %+v", ids)
	}
}

func TestFilterAdultVenues(t *testing.T) {
	t.Run("barタイプの施設が除外される", func(t *testing.T) {
		input := []services.PlaceResult{
			{PlaceID: "bar_1", Types: []string{"bar", "food"}},
			{PlaceID: "cafe_1", Types: []string{"cafe"}},
		}
		result := services.FilterAdultVenues(input)
		if len(result) != 1 {
			t.Fatalf("expected 1 place, got %d", len(result))
		}
		if result[0].PlaceID != "cafe_1" {
			t.Fatalf("expected cafe_1, got %s", result[0].PlaceID)
		}
	})

	t.Run("night_clubタイプの施設が除外される", func(t *testing.T) {
		input := []services.PlaceResult{
			{PlaceID: "club_1", Types: []string{"night_club", "entertainment"}},
			{PlaceID: "restaurant_1", Types: []string{"restaurant"}},
		}
		result := services.FilterAdultVenues(input)
		if len(result) != 1 {
			t.Fatalf("expected 1 place, got %d", len(result))
		}
		if result[0].PlaceID != "restaurant_1" {
			t.Fatalf("expected restaurant_1, got %s", result[0].PlaceID)
		}
	})

	t.Run("成人向け以外のタイプは除外されない", func(t *testing.T) {
		input := []services.PlaceResult{
			{PlaceID: "cafe_1", Types: []string{"cafe"}},
			{PlaceID: "restaurant_1", Types: []string{"restaurant"}},
			{PlaceID: "karaoke_1", Types: []string{"karaoke"}},
		}
		result := services.FilterAdultVenues(input)
		if len(result) != 3 {
			t.Fatalf("expected 3 places, got %d", len(result))
		}
	})

	t.Run("空スライスは空を返す", func(t *testing.T) {
		result := services.FilterAdultVenues([]services.PlaceResult{})
		if len(result) != 0 {
			t.Fatalf("expected 0 places, got %d", len(result))
		}
	})
}

func TestIsBreakoutVisit(t *testing.T) {
	cleanupUsers(t)
	user := createUser(t, "breakout@example.com")
	cafe := getOrCreateGenreTag(t, "カフェ")
	park := getOrCreateGenreTag(t, "公園・緑地")

	t.Run("興味タグ内はチャレンジでない", func(t *testing.T) {
		testDB.Create(&models.UserInterest{UserID: user.ID, GenreTagID: cafe.ID})
		if services.IsBreakoutVisit(testDB, user.ID, "カフェ") {
			t.Fatal("interest genre should not be breakout")
		}
	})

	t.Run("興味外かつ熟練度が低い場合はチャレンジ", func(t *testing.T) {
		testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, park.ID).
			Delete(&models.GenreProficiency{})
		testDB.Create(&models.GenreProficiency{UserID: user.ID, GenreTagID: park.ID, Level: 3})
		if !services.IsBreakoutVisit(testDB, user.ID, "公園・緑地") {
			t.Fatal("expected breakout for low proficiency")
		}
	})

	t.Run("興味外でも熟練度が高い場合はチャレンジでない", func(t *testing.T) {
		testDB.Where("user_id = ? AND genre_tag_id = ?", user.ID, park.ID).
			Delete(&models.GenreProficiency{})
		testDB.Create(&models.GenreProficiency{UserID: user.ID, GenreTagID: park.ID, Level: 8})
		if services.IsBreakoutVisit(testDB, user.ID, "公園・緑地") {
			t.Fatal("high proficiency should not be breakout")
		}
	})
}
