package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/Hiru-ge/roamble/services"
	"github.com/Hiru-ge/roamble/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	MaxListLimit     = 100
	DefaultListLimit = 20
	MaxMapLimit      = 2000
	DefaultMapLimit  = 2000
	MaxDailyVisits   = 3
)

type genreResolution struct {
	IsBreakout bool
	GenreTagID *uint64
}

func resolveGenreFromPlaceTypes(db *gorm.DB, userID uint64, placeTypes []string) genreResolution {
	if len(placeTypes) == 0 {
		return genreResolution{}
	}
	genreName := services.GetGenreNameFromTypes(placeTypes)
	resolution := genreResolution{
		IsBreakout: services.IsBreakoutVisit(db, userID, genreName),
	}
	if genreName != "" {
		var genreTag models.GenreTag
		if err := db.Where("name = ?", genreName).First(&genreTag).Error; err == nil {
			resolution.GenreTagID = &genreTag.ID
		}
	}
	return resolution
}

func countTodayVisitsJST(db *gorm.DB, userID uint64) (int64, error) {
	now := time.Now().In(utils.JST)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, utils.JST)
	todayEnd := todayStart.Add(24 * time.Hour)

	var count int64
	err := db.Model(&models.Visit{}).
		Where("user_id = ? AND visited_at >= ? AND visited_at < ?", userID, todayStart, todayEnd).
		Count(&count).Error
	return count, err
}

type VisitHandler struct {
	DB          *gorm.DB
	Environment string
}

// checkinDistanceThreshold は訪問記録を受け付ける施設からの最大距離（メートル）
const checkinDistanceThreshold = 200.0

type createVisitRequest struct {
	PlaceID        string   `json:"place_id" binding:"required"`
	PlaceName      string   `json:"place_name" binding:"required"`
	Vicinity       string   `json:"vicinity"`
	Category       string   `json:"category" binding:"required"`
	Lat            float64  `json:"lat" binding:"required"`
	Lng            float64  `json:"lng" binding:"required"`
	PlaceTypes     []string `json:"place_types"`
	PhotoReference *string  `json:"photo_reference"`
	VisitedAt      string   `json:"visited_at" binding:"required"`
	UserLat        float64  `json:"user_lat"`
	UserLng        float64  `json:"user_lng"`
}

// createVisitResponse はゲーミフィケーション情報付きの訪問作成レスポンス。
type createVisitResponse struct {
	models.Visit
	TotalXP          int                   `json:"total_xp"`
	IsLevelUp        bool                  `json:"is_level_up"`
	NewLevel         int                   `json:"new_level"`
	NewBadges        []models.Badge        `json:"new_badges"`
	IsDailyCompleted bool                  `json:"is_daily_completed"`
	XPBreakdown      *services.XPBreakdown `json:"xp_breakdown,omitempty"`
}

// CreateVisit godoc
// @Summary      訪問記録作成
// @Description  ユーザーの訪問記録を作成する（category、place_name を必須で受け付け）
// @Tags         Visits
// @Accept       json
// @Produce      json
// @Param        body  body  createVisitRequest  true  "訪問記録データ"
// @Success      201  {object}  createVisitResponse
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      429  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/visits [post]
func (h *VisitHandler) CreateVisit(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	var req createVisitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "code": "INVALID_REQUEST"})
		return
	}

	if req.Lat < -90 || req.Lat > 90 || req.Lng < -180 || req.Lng > 180 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid coordinates", "code": "INVALID_COORDINATES"})
		return
	}

	// バックエンド距離検証（production環境のみ、GPS未取得(0,0)の場合はスキップ）
	if h.Environment != "development" && (req.UserLat != 0 || req.UserLng != 0) {
		dist := utils.HaversineDistance(req.UserLat, req.UserLng, req.Lat, req.Lng)
		if dist > checkinDistanceThreshold {
			c.JSON(http.StatusBadRequest, gin.H{"error": "too far from place", "code": "TOO_FAR_FROM_PLACE"})
			return
		}
	}

	todayCount, err := countTodayVisitsJST(h.DB, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check daily visit count"})
		return
	}
	if todayCount >= MaxDailyVisits {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "daily visit limit reached", "code": "DAILY_LIMIT_REACHED"})
		return
	}

	visitedAt, err := time.Parse(time.RFC3339, req.VisitedAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visited_at format, expected RFC3339"})
		return
	}

	// is_breakout の自動設定: 「興味タグ外 かつ 熟練度Lv.5以下」のジャンルへの訪問を脱却扱いとする
	// GenreTagID も同時に解決し、熟練度更新が正しく行われるようにする
	genre := resolveGenreFromPlaceTypes(h.DB, userID, req.PlaceTypes)

	visit := models.Visit{
		UserID:         userID,
		PlaceID:        req.PlaceID,
		PlaceName:      req.PlaceName,
		Vicinity:       req.Vicinity,
		Category:       req.Category,
		Latitude:       req.Lat,
		Longitude:      req.Lng,
		PhotoReference: req.PhotoReference,
		IsBreakout:     genre.IsBreakout,
		GenreTagID:     genre.GenreTagID,
		VisitedAt:      visitedAt,
	}

	if err := h.DB.Create(&visit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create visit record"})
		return
	}

	// DB保存後の当日訪問件数でコンプリート判定（todayCount は保存前の件数なので +1 が保存後の件数）
	dailyCompleted := todayCount+1 >= MaxDailyVisits

	gamifResult, err := services.ApplyVisitGamification(h.DB, userID, visit)
	if err != nil {
		// TODO: XPBreakdown もゼロ値で返すと設計が一貫する（他フィールドはゼロ値を明示しているのに XPBreakdown だけ省略している）。
		// 修正すれば frontend の CreateVisitResponse.xp_breakdown を optional にしなくて済む。
		c.JSON(http.StatusCreated, createVisitResponse{
			Visit:            visit,
			TotalXP:          0,
			IsLevelUp:        false,
			NewLevel:         1,
			NewBadges:        []models.Badge{},
			IsDailyCompleted: dailyCompleted,
		})
		return
	}

	visit.XpEarned = gamifResult.XPEarned

	newBadges := gamifResult.NewBadges
	if newBadges == nil {
		newBadges = []models.Badge{}
	}

	c.JSON(http.StatusCreated, createVisitResponse{
		Visit:            visit,
		TotalXP:          gamifResult.TotalXP,
		IsLevelUp:        gamifResult.IsLevelUp,
		NewLevel:         gamifResult.NewLevel,
		NewBadges:        newBadges,
		IsDailyCompleted: dailyCompleted,
		XPBreakdown:      gamifResult.XPBreakdown,
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

type mapVisitsResponse struct {
	Visits []mapVisitItem `json:"visits"`
	Total  int64          `json:"total"`
}

type listVisitsResponse struct {
	Visits []models.Visit `json:"visits"`
	Total  int64          `json:"total"`
}

// GetMapData godoc
// @Summary      マップ表示用訪問データ取得
// @Description  マップ表示に必要な位置情報・ジャンル情報を最適化して取得する
// @Tags         Visits
// @Produce      json
// @Param        limit   query  int  false  "取得件数（デフォルト・上限2000）"
// @Param        offset  query  int  false  "オフセット（デフォルト0）"
// @Success      200  {object}  handlers.mapVisitsResponse
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Security     BearerAuth
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
	if err := h.DB.Select("id, place_id, place_name, lat, lng, category, genre_tag_id, visited_at").
		Where("user_id = ?", userID).
		Order("visited_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&visits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve map data"})
		return
	}

	var total int64
	if err := h.DB.Model(&models.Visit{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count visits"})
		return
	}

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

	c.JSON(http.StatusOK, mapVisitsResponse{
		Visits: items,
		Total:  total,
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
// @Failure      500  {object}  map[string]string
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "visit not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve visit"})
		return
	}

	c.JSON(http.StatusOK, visit)
}

// ListVisits godoc
// @Summary      訪問履歴取得
// @Description  ユーザーの訪問履歴を一覧取得する（visited_at降順）
// @Tags         Visits
// @Produce      json
// @Param        limit   query  int     false  "取得件数（デフォルト20）"
// @Param        offset  query  int     false  "オフセット（デフォルト0）"
// @Param		 from	 query  string  false  "訪問日時の開始範囲（RFC3339Nano形式）"
// @Param		 until    query  string  false  "訪問日時の終了範囲（RFC3339Nano形式）"
// @Success      200  {object}  handlers.listVisitsResponse
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/visits [get]
func (h *VisitHandler) ListVisits(c *gin.Context) {
	userID, ok := middleware.GetUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	query := h.DB.Where("user_id = ?", userID)
	countQuery := h.DB.Model(&models.Visit{}).Where("user_id = ?", userID)

	limit := DefaultListLimit
	offset := 0
	var fromTime, untilTime time.Time

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

	if fromStr := c.Query("from"); fromStr != "" {
		t, err := time.Parse(time.RFC3339Nano, fromStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'from' timestamp format, expected RFC3339Nano"})
			return
		}
		fromTime = t
	}

	if untilStr := c.Query("until"); untilStr != "" {
		t, err := time.Parse(time.RFC3339Nano, untilStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'until' timestamp format, expected RFC3339Nano"})
			return
		}
		untilTime = t
	}

	if !fromTime.IsZero() && !untilTime.IsZero() && fromTime.After(untilTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "'from' timestamp must be before 'until' timestamp"})
		return
	}

	// 矛盾した条件をクエリに追加しないよう、上のバリデーションが全て済んでからクエリに条件を追加する
	if !fromTime.IsZero() {
		query = query.Where("visited_at >= ?", fromTime)
		countQuery = countQuery.Where("visited_at >= ?", fromTime)
	}
	if !untilTime.IsZero() {
		query = query.Where("visited_at <= ?", untilTime)
		countQuery = countQuery.Where("visited_at <= ?", untilTime)
	}

	visits := make([]models.Visit, 0)
	if err := query.
		Order("visited_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&visits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve visits"})
		return
	}

	var total int64
	if err := countQuery.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count visits"})
		return
	}

	c.JSON(http.StatusOK, listVisitsResponse{
		Visits: visits,
		Total:  total,
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
// @Failure      500  {object}  map[string]string
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "code": "INVALID_REQUEST"})
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
