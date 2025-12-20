package api

import (
	"backend/internal/db"
	"backend/internal/fetch"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// RegisterRoutes sets up the API routes for the Gin router.
func RegisterRoutes(router *gin.Engine) {
	router.Use(cors.Default())

	r := router.Group("/api")
	{
		//  Health check
		r.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "Go backend is alive!"})
		})

		//  All tracked funds (cached)
		r.GET("/funds", func(c *gin.Context) {
			HandleFunds(c.Writer, c.Request)
		})

		//  Single fund detail
		r.GET("/fund/:symbol", func(c *gin.Context) {
			symbol := c.Param("symbol")
			data, err := fetch.FetchFund(symbol)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, data)
		})

		r.GET("/fund", func(c *gin.Context) {
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
		r.GET("/fundamentals/:symbol", func(c *gin.Context) {
			symbol := c.Param("symbol")
			data, err := fetch.FetchFundamentals(symbol)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, data)
		})

		//  Historical
		r.GET("/history/:symbol", func(c *gin.Context) {
			symbol := c.Param("symbol")
			rangeParam := c.Query("range")

			// Proxy to Python service
			resp, err := http.Get("http://localhost:8000/history/" + symbol + "?range=" + rangeParam)
			if err != nil {
				log.Println("Error contacting Python service:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			defer resp.Body.Close()
			c.DataFromReader(http.StatusOK, resp.ContentLength, "application/json", resp.Body, nil)
		})

		//  EOD snapshot
		r.GET("/eod", func(c *gin.Context) {
			data, err := fetch.FetchEOD()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, data)
		})

		//  Insights (Python service)
		r.GET("/insights", func(c *gin.Context) {
			resp, err := http.Get("http://localhost:8000/insights")
			if err != nil {
				log.Println("Error contacting Python service:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			defer resp.Body.Close()
			c.DataFromReader(http.StatusOK, resp.ContentLength, "application/json", resp.Body, nil)
		})
		//  Stock details (Python service)
		r.GET("/stock/:symbol", func(c *gin.Context) {
			symbol := c.Param("symbol")
			resp, err := http.Get("http://localhost:8000/stock/" + symbol)
			if err != nil {
				log.Println("Error contacting Python service:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			defer resp.Body.Close()
			c.DataFromReader(http.StatusOK, resp.ContentLength, "application/json", resp.Body, nil)
		})

		//  Real News (Cache First)
		r.GET("/news", func(c *gin.Context) {
			// Serve from DB instant load
			articles, err := db.GetRecentArticles(60)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, articles)
		})

		//  Refresh News (Trigger Pipeline)
		r.POST("/news/refresh", func(c *gin.Context) {
			// Trigger Python service to fetch fresh market data
			// We don't pass symbols anymore, relying on Python's default "Market Pulse" list
			resp, err := http.Get("http://localhost:8000/news")
			if err != nil {
				log.Println("Error contacting Python service for news:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			defer resp.Body.Close()

			// Read body
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read upstream response"})
				return
			}

			// Parse and Save
			var articles []db.Article
			if err := json.Unmarshal(body, &articles); err == nil {
				if err := db.SaveArticles(articles); err != nil {
					log.Printf("Failed to save articles: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save to DB"})
					return
				}
				c.JSON(http.StatusOK, gin.H{"status": "refreshed", "count": len(articles)})
			} else {
				log.Printf("Failed to unmarshal news for saving: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid news data"})
			}
		})

		//  Search News (Historical)
		r.GET("/news/search", func(c *gin.Context) {
			query := c.Query("q")
			if query == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "q (query) parameter required"})
				return
			}

			results, err := db.SearchNews(query, 50)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// If empty, return empty list []
			if results == nil {
				results = []db.Article{}
			}

			c.JSON(http.StatusOK, results)
		})

		//  Search Autocomplete
		r.GET("/search", func(c *gin.Context) {
			query := c.Query("q")
			results, err := fetch.SearchSymbols(query)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, results)
		})
	}
}
