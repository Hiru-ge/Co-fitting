package middleware

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			for _, e := range c.Errors {
				log.Printf("Request error: %v", e.Err)
			}

			lastErr := c.Errors.Last()
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": lastErr.Error(),
				})
			}
		}
	}
}
