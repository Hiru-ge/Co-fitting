package services

import (
	"context"
	"math/rand/v2"
	"time"

	"github.com/Hiru-ge/roamble/database"
	"github.com/Hiru-ge/roamble/models"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// PlaceResult は場所提案APIの個別施設を表す
type PlaceResult struct {
	PlaceID         string   `json:"place_id"`
	Name            string   `json:"name"`
	Vicinity        string   `json:"vicinity"`
	Lat             float64  `json:"lat"`
	Lng             float64  `json:"lng"`
	Rating          float32  `json:"rating"`
	Types           []string `json:"types"`
	PhotoReference  string   `json:"photo_reference,omitempty"`
	IsInterestMatch *bool    `json:"is_interest_match"`
	IsBreakout      *bool    `json:"is_breakout"`
	IsOpenNow       *bool    `json:"is_open_now,omitempty"`
}

// VisitableTypes は提案対象とする施設タイプの許可リスト
var VisitableTypes = map[string]bool{
	// グルメ
	"restaurant":       true,
	"cafe":             true,
	"bar":              true,
	"bakery":           true,
	"ice_cream_shop":   true,
	"ramen_restaurant": true,
	// エンタメ
	"bowling_alley":    true,
	"movie_theater":    true,
	"night_club":       true,
	"karaoke":          true,
	"amusement_center": true,
	"video_arcade":     true,
	// 文化
	"book_store": true,
	// ショッピング
	"clothing_store":   true,
	"home_goods_store": true,
	// リラクゼーション
	"spa":         true,
	"public_bath": true,
	"sauna":       true,
}

// AdultVenueTypes は成人向け施設タイプ（居酒屋・バー・クラブ）
var AdultVenueTypes = map[string]bool{
	"bar":        true,
	"night_club": true,
}

// FilterAdultVenues は成人向け施設（居酒屋・バー・クラブ）を除外する。
// ユーザーの enable_adult_venues が false の場合に呼び出す。
func FilterAdultVenues(places []PlaceResult) []PlaceResult {
	filtered := make([]PlaceResult, 0, len(places))
	for _, p := range places {
		adult := false
		for _, t := range p.Types {
			if AdultVenueTypes[t] {
				adult = true
				break
			}
		}
		if !adult {
			filtered = append(filtered, p)
		}
	}
	return filtered
}

// IsVisitablePlace は施設タイプが提案対象かどうかを返す
func IsVisitablePlace(types []string) bool {
	for _, t := range types {
		if VisitableTypes[t] {
			return true
		}
	}
	return false
}

// placeTypeToGenreName はGoogle Maps Place TypeからGenreTag名（日本語）へのマッピング
var placeTypeToGenreName = map[string]string{
	// 飲食
	"cafe":             "カフェ",
	"restaurant":       "レストラン",
	"bar":              "居酒屋・バー",
	"night_club":       "居酒屋・バー",
	"bakery":           "スイーツ・ベーカリー",
	"ice_cream_shop":   "スイーツ・ベーカリー",
	"ramen_restaurant": "ラーメン・麺類",
	// 文化
	"book_store": "書店",
	// エンタメ
	"movie_theater":    "映画館",
	"bowling_alley":    "スポーツ施設",
	"karaoke":          "カラオケ",
	"amusement_center": "ゲームセンター",
	"video_arcade":     "ゲームセンター",
	// リラクゼーション
	"spa":         "マッサージ・スパ",
	"public_bath": "温泉・銭湯",
	"sauna":       "温泉・銭湯",
	// ショッピング
	"clothing_store":   "雑貨・セレクトショップ",
	"home_goods_store": "雑貨・セレクトショップ",
}

// placeTypePriority はジャンル判定の優先順。特化タイプが汎用タイプより先に評価されるよう並べる。
// Googleが返す types 配列の順序に依存せず、より適切なジャンル名を選ぶために使用する。
var placeTypePriority = []string{
	"ramen_restaurant",
	"cafe",
	"ice_cream_shop",
	"bakery",
	"bar",
	"night_club",
	"karaoke",
	"amusement_center",
	"video_arcade",
	"bowling_alley",
	"movie_theater",
	"book_store",
	"spa",
	"public_bath",
	"sauna",
	"clothing_store",
	"home_goods_store",
	"restaurant",
}

// breakoutLevelThreshold はチャレンジ判定の熟練度閾値
// ジャンル熟練度がこのレベル未満（Lv.5以下 = 0〜499XP）ならチャレンジ扱い
const breakoutLevelThreshold = 6

// maxDailySuggestions は日次キャッシュで返す最大施設数
const maxDailySuggestions = 3

// visitedExclusionDays は訪問済みフィルタの閾値日数
const visitedExclusionDays = 30

// GetGenreNameFromTypes はPlace TypesからGenreTag名を返す。
// placeTypePriority の順で評価し、特化タイプが汎用タイプより優先されるようにする。
func GetGenreNameFromTypes(types []string) string {
	typeSet := make(map[string]bool, len(types))
	for _, t := range types {
		typeSet[t] = true
	}
	for _, t := range placeTypePriority {
		if typeSet[t] {
			if name, ok := placeTypeToGenreName[t]; ok {
				return name
			}
		}
	}
	return ""
}

// GetUserInterestGenreNames はユーザーの興味タグ名セットをDBから取得する
func GetUserInterestGenreNames(db *gorm.DB, userID uint64) (map[string]bool, error) {
	type interestWithTag struct {
		GenreTagName string
	}
	var results []interestWithTag
	if err := db.Table("user_interests").
		Select("genre_tags.name as genre_tag_name").
		Joins("JOIN genre_tags ON genre_tags.id = user_interests.genre_tag_id").
		Where("user_interests.user_id = ?", userID).
		Scan(&results).Error; err != nil {
		return nil, err
	}
	names := make(map[string]bool, len(results))
	for _, r := range results {
		names[r.GenreTagName] = true
	}
	return names, nil
}

// FilterOutVisited は最近（30日以内）訪問済みの施設を除外する。
// visitedExclusionDays 日より前に訪問した施設は除外対象から外し、再提案候補として扱う。
func FilterOutVisited(db *gorm.DB, userID uint64, places []PlaceResult) []PlaceResult {
	if len(places) == 0 {
		return nil
	}

	candidateIDs := make([]string, len(places))
	for i, p := range places {
		candidateIDs[i] = p.PlaceID
	}

	threshold := time.Now().AddDate(0, 0, -visitedExclusionDays)
	var visitedPlaceIDs []string
	db.Model(&models.Visit{}).
		Where("user_id = ? AND visited_at >= ? AND place_id IN ?", userID, threshold, candidateIDs).
		Pluck("place_id", &visitedPlaceIDs)

	visitedSet := make(map[string]bool, len(visitedPlaceIDs))
	for _, id := range visitedPlaceIDs {
		visitedSet[id] = true
	}

	var result []PlaceResult
	for _, p := range places {
		if !visitedSet[p.PlaceID] {
			result = append(result, p)
		}
	}
	return result
}

func FilterOutSnoozed(ctx context.Context, client *redis.Client, userIDStr string, places []PlaceResult) []PlaceResult {
	if client == nil || len(places) == 0 {
		return places
	}

	var result []PlaceResult
	for _, p := range places {
		snoozed, err := database.IsPlaceSnoozed(ctx, client, userIDStr, p.PlaceID)
		if err != nil {
			result = append(result, p)
			continue
		}
		if !snoozed {
			result = append(result, p)
		}
	}
	return result
}

// FilterOpenNowPlaces は IsOpenNow=false の施設を除外する。
// IsOpenNow が nil（営業時間情報なし）の施設は深夜時間帯ユーザーへの配慮として除外しない。
func FilterOpenNowPlaces(places []PlaceResult) []PlaceResult {
	filtered := make([]PlaceResult, 0, len(places))
	for _, p := range places {
		if p.IsOpenNow != nil && !*p.IsOpenNow {
			continue
		}
		filtered = append(filtered, p)
	}
	return filtered
}

// IsBreakoutVisit はジャンル熟練度と興味タグに基づいてチャレンジ訪問かどうかを判定する。
// 「興味タグ外 かつ 熟練度Lv.5以下」のジャンルへの訪問をチャレンジ扱いとする。
func IsBreakoutVisit(db *gorm.DB, userID uint64, genreName string) bool {
	if genreName == "" {
		return false
	}

	interestGenres, err := GetUserInterestGenreNames(db, userID)
	if err == nil && interestGenres[genreName] {
		return false
	}

	var genreTag models.GenreTag
	if err := db.Where("name = ?", genreName).First(&genreTag).Error; err != nil {
		return true
	}
	var prof models.GenreProficiency
	result := db.Where("user_id = ? AND genre_tag_id = ?", userID, genreTag.ID).First(&prof)
	return result.Error != nil || prof.Level < breakoutLevelThreshold
}

// selectRandomPlaces は候補から最大n件をランダムに選出する
func selectRandomPlaces(candidates []PlaceResult, n int) []PlaceResult {
	if len(candidates) <= n {
		return candidates
	}

	shuffled := make([]PlaceResult, len(candidates))
	copy(shuffled, candidates)
	for i := len(shuffled) - 1; i > 0; i-- {
		j := rand.IntN(i + 1)
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}
	return shuffled[:n]
}

func boolPtr(b bool) *bool {
	return &b
}

// ClassifyByInterest は候補を興味内・興味外に分類し、興味内には IsInterestMatch=true を設定する
func ClassifyByInterest(places []PlaceResult, interestGenreNames map[string]bool) (inInterest, outOfInterest []PlaceResult) {
	for _, p := range places {
		genreName := GetGenreNameFromTypes(p.Types)
		if genreName != "" && interestGenreNames[genreName] {
			p.IsInterestMatch = boolPtr(true)
			inInterest = append(inInterest, p)
		} else {
			outOfInterest = append(outOfInterest, p)
		}
	}
	return
}

// SelectPersonalizedPlaces は「興味内2枠 + 完全ランダム1枠」で最大 maxDailySuggestions 件を選出する。
// 興味内が2未満の場合は全興味内を使い、残りをランダム補充する。
func SelectPersonalizedPlaces(inInterest, outOfInterest []PlaceResult) []PlaceResult {
	const interestSlots = 2

	selected := selectRandomPlaces(inInterest, interestSlots)

	selectedIDs := make(map[string]bool, len(selected))
	for _, p := range selected {
		selectedIDs[p.PlaceID] = true
	}

	allRemaining := make([]PlaceResult, 0, len(inInterest)+len(outOfInterest))
	for _, p := range inInterest {
		if !selectedIDs[p.PlaceID] {
			allRemaining = append(allRemaining, p)
		}
	}
	for _, p := range outOfInterest {
		if !selectedIDs[p.PlaceID] {
			allRemaining = append(allRemaining, p)
		}
	}

	remaining := maxDailySuggestions - len(selected)
	if remaining > 0 && len(allRemaining) > 0 {
		selected = append(selected, selectRandomPlaces(allRemaining, remaining)...)
	}
	return selected
}

// BuildPersonalizedSelections は未訪問施設から興味タグに基づいて提案施設を選出し、
// is_interest_match・is_breakout フラグを設定して返す。
func BuildPersonalizedSelections(db *gorm.DB, userID uint64, unvisited []PlaceResult) ([]PlaceResult, string) {
	var selected []PlaceResult
	var notice string

	interestGenreNames, err := GetUserInterestGenreNames(db, userID)
	if err != nil || len(interestGenreNames) == 0 {
		selected = selectRandomPlaces(unvisited, maxDailySuggestions)
	} else {
		inInterest, outOfInterest := ClassifyByInterest(unvisited, interestGenreNames)
		if len(inInterest) == 0 && len(outOfInterest) > 0 {
			notice = "NO_INTEREST_PLACES"
		}
		selected = SelectPersonalizedPlaces(inInterest, outOfInterest)
		for i := range selected {
			genreName := GetGenreNameFromTypes(selected[i].Types)
			match := genreName != "" && interestGenreNames[genreName]
			selected[i].IsInterestMatch = &match
		}
	}

	for i := range selected {
		genreName := GetGenreNameFromTypes(selected[i].Types)
		isBreakout := IsBreakoutVisit(db, userID, genreName)
		selected[i].IsBreakout = &isBreakout
	}

	return selected, notice
}
