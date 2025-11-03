package api

import (
	"net/http"
	"io"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// RegisterRoutes sets up the API routes for the Gin router.
func RegisterRoutes(router *gin.Engine) {
	// Health check route
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "Go backend is alive!"})
	})

	// Proxy route that calls the Python microservice
	router.GET("/api/insight", func(c *gin.Context) {
		resp, err := http.Get("http://localhost:8000/analyze")
		if err != nil {
			log.Println("Error contacting Python service:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		c.Data(http.StatusOK, "application/json", body)
	})
}
