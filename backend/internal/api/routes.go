package api

import (
	"backend/internal/fetch"
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// RegisterRoutes sets up the API routes for the Gin router.
func RegisterRoutes(router *gin.Engine) {
	router.Use(cors.Default())

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
		c.DataFromReader(http.StatusOK, resp.ContentLength, "application/json", resp.Body, nil)
	})

	router.GET("/api/funds", func(c *gin.Context) {
		// Use cached results if available
		if funds, found := fetch.GetCachedFunds(); found {
			c.JSON(http.StatusOK, funds)
			return
		}

		funds, err := fetch.FetchFunds()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		fetch.CacheFunds(funds)
		c.JSON(http.StatusOK, funds)
	})
}
