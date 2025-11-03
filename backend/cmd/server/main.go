package main

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"io"
)

func main() {
	r := gin.Default()

	// Basic health check
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "Go backend is alive!"})
	})

	// Example endpoint that calls Python microservice
	r.GET("/api/insight", func(c *gin.Context) {
		resp, err := http.Get("http://localhost:8000/analyze")
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		c.Data(200, "application/json", body)
	})

	r.Run(":8080")
}
