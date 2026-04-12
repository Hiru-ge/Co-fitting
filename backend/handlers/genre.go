package handlers

import (
	"net/http"

	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type GenreHandler struct {
	DB *gorm.DB
}

type genreTagResponse struct {
	ID       uint64 `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
	Icon     string `json:"icon"`
}

// GetAllGenreTags godoc
// @Summary      全ジャンルタグ一覧取得
// @Description  ジャンルタグマスタの全一覧をカテゴリ順で返す
// @Tags         Genres
// @Produce      json
// @Success      200  {array}   genreTagResponse
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/genres [get]
func (h *GenreHandler) GetAllGenreTags(c *gin.Context) {
	var genres []models.GenreTag
	if err := h.DB.Order("category ASC, name ASC").Find(&genres).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	resp := make([]genreTagResponse, len(genres))
	for i, g := range genres {
		resp[i] = genreTagResponse{
			ID:       g.ID,
			Name:     g.Name,
			Category: g.Category,
			Icon:     g.Icon,
		}
	}

	c.JSON(http.StatusOK, resp)
}
