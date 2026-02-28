package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	// MaxListLimit は ListVisits API の limit パラメータ上限
	MaxListLimit = 100
	// DefaultListLimit は ListVisits API の limit パラメータデフォルト値
	DefaultListLimit = 20
	// MaxMapLimit は GetMapData API の limit パラメータ上限
	MaxMapLimit = 2000
	// DefaultMapLimit は GetMapData API の limit パラメータデフォルト値
	DefaultMapLimit = 2000
	// MaxDailyVisits は1日の訪問記録上限
	MaxDailyVisits = 3
)

// jst は日次訪問カウントのJST基準計算用タイムゾーン
var jst = time.FixedZone("Asia/Tokyo", 9*60*60)

// countTodayVisitsJST はJST基準で当日の訪問件数を返す
func countTodayVisitsJST(db *gorm.DB, userID uint64) (int64, error) {
	now := time.Now().In(jst)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, jst)
	todayEnd := todayStart.Add(24 * time.Hour)

	var count int64
	err := db.Model(&models.Visit{}).
		Where("user_id = ? AND visited_at >= ? AND visited_at < ?", userID, todayStart, todayEnd).
		Count(&count).Error
	return count, err
}

type VisitHandler struct {
	DB *gorm.DB
}

type createVisitRequest struct {
	PlaceID    string   `json:"place_id" binding:"required"`
	PlaceName  string   `json:"place_name" binding:"required"`
	Vicinity   string   `json:"vicinity"`
	Category   string   `json:"category" binding:"required"`
	Lat        float64  `json:"lat" binding:"required"`
	Lng        float64  `json:"lng" binding:"required"`
	PlaceTypes []string `json:"place_types"` // 任意: is_comfort_zone自動判定に使用
	Rating     *float32 `json:"rating"`
	Memo       *string  `json:"memo"`
	VisitedAt  string   `json:"visited_at" binding:"required"`
}

// createVisitResponse はゲーミフィケーション情報を含むCreateVisitのレスポンス
// models.Visit を埋め込み、xp_earnedはVisit.XpEarnedで（Goの仕様により外側フィールドが優先）、
// total_xp/level_up/new_level/new_badges/daily_completedをゲーミフィケーション情報として追加する
type createVisitResponse struct {
	models.Visit
	TotalXP        int                   `json:"total_xp"`               // ユーザー累計XP
	LevelUp        bool                  `json:"level_up"`               // 今回の訪問でレベルアップしたか
	NewLevel       int                   `json:"new_level"`              // 現在のレベル
	NewBadges      []models.Badge        `json:"new_badges"`             // 今回獲得した新バッジ
	DailyCompleted bool                  `json:"daily_completed"`        // 今回の訪問で本日の3件上限に達したか
	XPBreakdown    *services.XPBreakdown `json:"xp_breakdown,omitempty"` // XP計算内訳
}

// CreateVisit godoc
// @Summary      訪問記録作成
// @Description  ユーザーの訪問記録を作成する（category、place_name を必須で受け付け）
// @Tags         Visits
// @Accept       json
// @Produce      json
// @Param        body  body  createVisitRequest  true  "訪問記録データ"
// @Success      201  {object}  models.Visit
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Router       /api/visits [post]
func (h *VisitHandler) CreateVisit(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	var req createVisitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "リクエストの形式が正しくありません"})
		return
	}

	// 座標のバリデーション
	if req.Lat < -90 || req.Lat > 90 || req.Lng < -180 || req.Lng > 180 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "座標が有効範囲外です（lat: -90〜90, lng: -180〜180）"})
		return
	}

	// 日次訪問上限チェック（JST基準で当日3件まで）
	todayCount, err := countTodayVisitsJST(h.DB, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check daily visit count"})
		return
	}
	if todayCount >= MaxDailyVisits {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "本日の訪問上限（3件）に達しました", "code": "DAILY_LIMIT_REACHED"})
		return
	}

	visitedAt, err := time.Parse(time.RFC3339, req.VisitedAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visited_at format, expected RFC3339"})
		return
	}

	// is_comfort_zone の自動設定: 熟練度Lv.1（初回〜数回訪問）のジャンルへの訪問を脱却扱いとする
	// GenreTagID も同時に解決し、熟練度更新が正しく行われるようにする
	isComfortZone := false
	var genreTagID *uint64
	if len(req.PlaceTypes) > 0 {
		genreName := getGenreNameFromTypes(req.PlaceTypes)
		isComfortZone = isComfortZoneVisit(h.DB, userID, genreName)
		if genreName != "" {
			var genreTag models.GenreTag
			if err := h.DB.Where("name = ?", genreName).First(&genreTag).Error; err == nil {
				genreTagID = &genreTag.ID
			}
		}
	}

	visit := models.Visit{
		UserID:        userID,
		PlaceID:       req.PlaceID,
		PlaceName:     req.PlaceName,
		Vicinity:      req.Vicinity,
		Category:      req.Category,
		Latitude:      req.Lat,
		Longitude:     req.Lng,
		Rating:        req.Rating,
		Memo:          req.Memo,
		IsComfortZone: isComfortZone,
		GenreTagID:    genreTagID,
		VisitedAt:     visitedAt,
	}

	if err := h.DB.Create(&visit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create visit record"})
		return
	}

	// DB保存後の当日訪問件数でコンプリート判定（todayCount は保存前の件数なので +1 が保存後の件数）
	dailyCompleted := todayCount+1 >= MaxDailyVisits

	// ゲーミフィケーション処理（XP計算・レベルアップ判定・バッジ付与・ジャンル熟練度更新・ストリーク更新）
	gamifResult, err := services.ProcessGamification(h.DB, userID, visit)
	if err != nil {
		// ゲーミフィケーション処理失敗は訪問記録自体を無効化しない（ログのみ）
		// 最低限の情報でレスポンスを返す
		c.JSON(http.StatusCreated, createVisitResponse{
			Visit:          visit,
			TotalXP:        0,
			LevelUp:        false,
			NewLevel:       1,
			NewBadges:      []models.Badge{},
			DailyCompleted: dailyCompleted,
		})
		return
	}

	// visit.XpEarned をゲーミフィケーション処理結果で更新（レスポンスに反映）
	visit.XpEarned = gamifResult.XPEarned

	newBadges := gamifResult.NewBadges
	if newBadges == nil {
		newBadges = []models.Badge{}
	}

	c.JSON(http.StatusCreated, createVisitResponse{
		Visit:          visit,
		TotalXP:        gamifResult.TotalXP,
		LevelUp:        gamifResult.LevelUp,
		NewLevel:       gamifResult.NewLevel,
		NewBadges:      newBadges,
		DailyCompleted: dailyCompleted,
		XPBreakdown:    gamifResult.XPBreakdown,
	})
}

// mapVisitItem はマップ表示に最適化された訪問記録の軽量表現
type mapVisitItem struct {
	ID         uint64  `json:"id"`
	PlaceID    string  `json:"place_id"`
	PlaceName  string  `json:"place_name"`
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
	Category   string  `json:"category"`
	GenreTagID *uint64 `json:"genre_tag_id"`
	VisitedAt  string  `json:"visited_at"`
}

// GetMapData godoc
// @Summary      マップ表示用訪問データ取得
// @Description  マップ表示に必要な位置情報・ジャンル情報を最適化して取得する
// @Tags         Visits
// @Produce      json
// @Param        limit   query  int  false  "取得件数（デフォルト・上限2000）"
// @Param        offset  query  int  false  "オフセット（デフォルト0）"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]string
// @Router       /api/visits/map [get]
func (h *VisitHandler) GetMapData(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	limit := DefaultMapLimit
	offset := 0

	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
			if limit > MaxMapLimit {
				limit = MaxMapLimit
			}
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	visits := make([]models.Visit, 0)
	h.DB.Select("id, place_id, place_name, lat, lng, category, genre_tag_id, visited_at").
		Where("user_id = ?", userID).
		Order("visited_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&visits)

	var total int64
	h.DB.Model(&models.Visit{}).Where("user_id = ?", userID).Count(&total)

	items := make([]mapVisitItem, len(visits))
	for i, v := range visits {
		items[i] = mapVisitItem{
			ID:         v.ID,
			PlaceID:    v.PlaceID,
			PlaceName:  v.PlaceName,
			Lat:        v.Latitude,
			Lng:        v.Longitude,
			Category:   v.Category,
			GenreTagID: v.GenreTagID,
			VisitedAt:  v.VisitedAt.Format(time.RFC3339),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"visits": items,
		"total":  total,
	})
}

// GetVisit godoc
// @Summary      訪問記録詳細取得
// @Description  指定IDの訪問記録詳細を取得する（自分の記録のみ）
// @Tags         Visits
// @Produce      json
// @Param        id   path  int  true  "訪問記録ID"
// @Success      200  {object}  models.Visit
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /api/visits/{id} [get]
func (h *VisitHandler) GetVisit(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visit id"})
		return
	}

	var visit models.Visit
	if err := h.DB.Where("id = ? AND user_id = ?", id, userID).First(&visit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "visit not found"})
		return
	}

	c.JSON(http.StatusOK, visit)
}

// ListVisits godoc
// @Summary      訪問履歴取得
// @Description  ユーザーの訪問履歴を一覧取得する（visited_at降順）
// @Tags         Visits
// @Produce      json
// @Param        limit   query  int  false  "取得件数（デフォルト20）"
// @Param        offset  query  int  false  "オフセット（デフォルト0）"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]string
// @Router       /api/visits [get]
func (h *VisitHandler) ListVisits(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	limit := DefaultListLimit
	offset := 0

	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
			if limit > MaxListLimit {
				limit = MaxListLimit
			}
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	visits := make([]models.Visit, 0)
	h.DB.Where("user_id = ?", userID).
		Order("visited_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&visits)

	var total int64
	h.DB.Model(&models.Visit{}).Where("user_id = ?", userID).Count(&total)

	c.JSON(http.StatusOK, gin.H{
		"visits": visits,
		"total":  total,
	})
}

type updateVisitRequest struct {
	Memo   *string  `json:"memo"`
	Rating *float32 `json:"rating"`
}

// UpdateVisit godoc
// @Summary      訪問記録更新
// @Description  ユーザーの訪問記録の感想メモ・評価を部分更新する
// @Tags         Visits
// @Accept       json
// @Produce      json
// @Param        id    path  int                 true  "訪問記録ID"
// @Param        body  body  updateVisitRequest  true  "更新データ"
// @Success      200  {object}  models.Visit
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      403  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /api/visits/{id} [patch]
func (h *VisitHandler) UpdateVisit(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	visitID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visit id"})
		return
	}

	var visit models.Visit
	if err := h.DB.First(&visit, visitID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "visit not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if visit.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var req updateVisitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "リクエストの形式が正しくありません"})
		return
	}

	updates := map[string]interface{}{}
	if req.Memo != nil {
		updates["memo"] = req.Memo
	}
	if req.Rating != nil {
		updates["rating"] = req.Rating
	}

	if len(updates) > 0 {
		if err := h.DB.Model(&visit).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update visit record"})
			return
		}
	}

	c.JSON(http.StatusOK, visit)
}
