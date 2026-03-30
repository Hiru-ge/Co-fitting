package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type BetaHandler struct {
	Passphrase string
}

type betaVerifyRequest struct {
	Passphrase string `json:"passphrase" binding:"required"`
}

// VerifyBetaPassphrase godoc
// @Summary      ベータ合言葉照合
// @Tags         Beta
// @Accept       json
// @Produce      json
// @Param        body body betaVerifyRequest true "合言葉"
// @Success      200  {object}  map[string]bool
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Router       /api/beta/verify [post]
func (h *BetaHandler) VerifyPassphrase(c *gin.Context) {
	var req betaVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "passphrase is required"})
		return
	}

	if h.Passphrase == "" {
		// 未設定の場合はベータゲート無効（開発環境向け）
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	if req.Passphrase != h.Passphrase {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid passphrase"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
