package handlers

import (
	"net/http"

	"github.com/Hiru-ge/roamble/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BadgeHandler struct {
	DB *gorm.DB
}

type allBadgeResponse struct {
	ID          uint64 `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IconURL     string `json:"icon_url"`
}

// GetAllBadges godoc
// @Summary      全バッジ一覧取得
// @Description  バッジマスタの全一覧を返す
// @Tags         Badges
// @Produce      json
// @Success      200  {array}   allBadgeResponse
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/badges [get]
func (h *BadgeHandler) GetAllBadges(c *gin.Context) {
	var badges []models.Badge
	if err := h.DB.Find(&badges).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	resp := make([]allBadgeResponse, len(badges))
	for i, b := range badges {
		resp[i] = allBadgeResponse{
			ID:          b.ID,
			Name:        b.Name,
			Description: b.Description,
			IconURL:     b.IconURL,
		}
	}

	c.JSON(http.StatusOK, resp)
}
