package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/Hiru-ge/roamble/middleware"
	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	// MaxListLimit は ListVisits API の limit パラメータ上限
	MaxListLimit = 100
	// DefaultListLimit は ListVisits API の limit パラメータデフォルト値
	DefaultListLimit = 20
)

type VisitHandler struct {
	DB *gorm.DB
}

type createVisitRequest struct {
	PlaceID   string   `json:"place_id" binding:"required"`
	PlaceName string   `json:"place_name" binding:"required"`
	Vicinity  string   `json:"vicinity"`
	Category  string   `json:"category" binding:"required"`
	Lat       float64  `json:"lat" binding:"required"`
	Lng       float64  `json:"lng" binding:"required"`
	Rating    *float32 `json:"rating"`
	VisitedAt string   `json:"visited_at" binding:"required"`
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	visitedAt, err := time.Parse(time.RFC3339, req.VisitedAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visited_at format, expected RFC3339"})
		return
	}

	visit := models.Visit{
		UserID:    userID,
		PlaceID:   req.PlaceID,
		PlaceName: req.PlaceName,
		Vicinity:  req.Vicinity,
		Category:  req.Category,
		Latitude:  req.Lat,
		Longitude: req.Lng,
		Rating:    req.Rating,
		VisitedAt: visitedAt,
	}

	if err := h.DB.Create(&visit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create visit record"})
		return
	}

	c.JSON(http.StatusCreated, visit)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
