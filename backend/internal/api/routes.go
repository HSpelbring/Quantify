package api

import (
	"backend/internal/db"
	"backend/internal/fetch"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
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
			limitStr := c.DefaultQuery("limit", "60")
			offsetStr := c.DefaultQuery("offset", "0")
			balanced := c.DefaultQuery("balanced", "true")

			var limit, offset int
			fmt.Sscanf(limitStr, "%d", &limit)
			fmt.Sscanf(offsetStr, "%d", &offset)

			if balanced == "true" && offset == 0 {
				// Serve balanced view (60 per category) for first page
				articles, err := db.GetRecentArticlesBalanced(limit)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, articles)
			} else {
				// Standard paginated fetch (most recent first)
				articles, err := db.GetArticlesByPage(limit, offset)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, articles)
			}
		})

		//  Refresh News (Trigger Pipeline)
		r.POST("/news/refresh", func(c *gin.Context) {
			log.Println("[NEWS REFRESH] Starting refresh...")
			// Trigger Python service to fetch fresh market data
			// We don't pass symbols anymore, relying on Python's default "Market Pulse" list
			resp, err := http.Get("http://localhost:8000/news")
			if err != nil {
				log.Println("Error contacting Python service for news:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			defer resp.Body.Close()

			log.Printf("[NEWS REFRESH] Python responded with status: %d", resp.StatusCode)

			// Read body
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				log.Println("[NEWS REFRESH] Failed to read response body:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read upstream response"})
				return
			}

			log.Printf("[NEWS REFRESH] Received %d bytes from Python", len(body))

			// Parse and Save
			var articles []db.Article
			if err := json.Unmarshal(body, &articles); err == nil {
				log.Printf("[NEWS REFRESH] Successfully parsed %d articles", len(articles))
				if err := db.SaveArticles(articles); err != nil {
					log.Printf("Failed to save articles: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save to DB"})
					return
				}
				log.Printf("[NEWS REFRESH] Successfully saved %d articles to DB", len(articles))
				c.JSON(http.StatusOK, gin.H{"status": "refreshed", "count": len(articles)})
			} else {
				log.Printf("Failed to unmarshal news for saving: %v", err)
				log.Printf("[NEWS REFRESH] Raw response (first 500 chars): %s", string(body[:int(math.Min(500, float64(len(body))))]))
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

		// Get latest filing date for a ticker
		r.GET("/insider/latest/:ticker", func(c *gin.Context) {
			ticker := c.Param("ticker")
			filingDate, err := db.GetLatestFilingDate(ticker)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"ticker":     ticker,
				"filingDate": filingDate.Format("2006-01-02"),
			})
		})

		// Save insider trade (called from Python)
		r.POST("/insider/save", func(c *gin.Context) {
			var trade db.InsiderTrade
			if err := c.BindJSON(&trade); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			err := db.SaveInsiderTrade(&trade)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"status": "saved"})
		})

		// Get insider trades for a ticker
		r.GET("/insider/trades/:ticker", func(c *gin.Context) {
			ticker := c.Param("ticker")
			limit := 50

			trades, err := db.GetInsiderTrades(ticker, limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, trades)
		})

		// Get single trade details by ID
		r.GET("/insider/trade/:id", func(c *gin.Context) {
			id := c.Param("id")
			var tradeID int
			_, err := fmt.Sscanf(id, "%d", &tradeID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
				return
			}

			trade, err := db.GetInsiderTradeDetails(tradeID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, trade)
		})

		// Trigger ingestion via Python
		r.POST("/insider/ingest/:ticker", func(c *gin.Context) {
			ticker := c.Param("ticker")
			resp, err := http.Get("http://localhost:8000/insider/ingest/" + ticker)
			if err != nil {
				log.Println("Error contacting Python service:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			defer resp.Body.Close()
			c.DataFromReader(http.StatusOK, resp.ContentLength, "application/json", resp.Body, nil)
		})

		// Insider Trading (SEC EDGAR)
		r.GET("/insider-trading", func(c *gin.Context) {
			ticker := c.Query("ticker")
			if ticker == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "ticker parameter required"})
				return
			}

			// Proxy to Python SEC EDGAR endpoint
			url := fmt.Sprintf("http://localhost:8000/insider-trading?ticker=%s", ticker)
			resp, err := http.Get(url)
			if err != nil {
				log.Println("Error contacting Python service for insider trading:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			defer resp.Body.Close()

			// Forward response
			c.DataFromReader(http.StatusOK, resp.ContentLength, "application/json", resp.Body, nil)
		})
	}
}
