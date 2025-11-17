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

	api := router.Group("/api")
	{
		//  Health check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "Go backend is alive!"})
		})

		//  All tracked funds (cached)
		api.GET("/funds", func(c *gin.Context) {
			if funds, _, found := fetch.GetCachedFunds(); found {
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

		//  Single fund detail
		api.GET("/fund/:symbol", func(c *gin.Context) {
			symbol := c.Param("symbol")
			data, err := fetch.FetchFund(symbol)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, data)
		})

		api.GET("/fund", func(c *gin.Context) {
			symbol := c.Query("symbol")
			if symbol == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "symbol required"})
				return
			}

			data, err := fetch.FetchFund(symbol)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, data)
		})

		//  Fundamentals
		api.GET("/fundamentals/:symbol", func(c *gin.Context) {
			symbol := c.Param("symbol")
			data, err := fetch.FetchFundamentals(symbol)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, data)
		})

		//  Historical
		api.GET("/history/:symbol", func(c *gin.Context) {
			symbol := c.Param("symbol")
			rangeParam := c.Query("range")
			data, err := fetch.FetchHistory(symbol, rangeParam)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, data)
		})

		//  EOD snapshot
		api.GET("/eod", func(c *gin.Context) {
			data, err := fetch.FetchEOD()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, data)
		})

		//  Insights (Python service)
		api.GET("/insight", func(c *gin.Context) {
			resp, err := http.Get("http://localhost:8000/analyze")
			if err != nil {
				log.Println("Error contacting Python service:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			defer resp.Body.Close()
			c.DataFromReader(http.StatusOK, resp.ContentLength, "application/json", resp.Body, nil)
		})
	}
}
