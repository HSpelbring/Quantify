package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"backend/internal/models"

	"github.com/patrickmn/go-cache"
)

var fundCache = cache.New(1*time.Minute, 2*time.Minute)

const yahooURL = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=%s"

var fundSymbols = []struct {
	Symbol string
	Name   string
}{
	{"^GSPC", "S&P 500"},
	{"^NDX", "NASDAQ 100"},
	{"^DJI", "Dow Jones"},
	{"^RUT", "Russell 2000"},
	{"^VIX", "VIX Index"},
	{"BTC-USD", "Bitcoin"},
}

type QuoteResponse struct {
	Price   float64   `json:"price"`
	Change  float64   `json:"change"`
	Open    float64   `json:"open"`
	History []float64 `json:"history"`
}

func HandleFunds(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	// ✅ Serve cached data if available
	if cached, found := fundCache.Get("funds"); found {
		json.NewEncoder(w).Encode(cached)
		return
	}

	log.Println("🌐 Fetching from Python service...")
	resp, err := http.Get("http://localhost:8000/quotes")
	if err != nil {
		http.Error(w, fmt.Sprintf("Python connection failed: %v", err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("Python response: %s\n", string(body))

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Python returned %d", resp.StatusCode), http.StatusInternalServerError)
		return
	}

	var raw map[string]QuoteResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		http.Error(w, fmt.Sprintf("Parse error: %v", err), http.StatusInternalServerError)
		return
	}

	funds := []models.Fund{}
	for _, s := range fundSymbols {
		q := raw[s.Symbol]

		funds = append(funds, models.Fund{
			Symbol:  s.Symbol,
			Name:    s.Name,
			Price:   q.Price,
			Change:  q.Change,
			Open:    q.Open,
			History: q.History,
		})
	}

	fundCache.Set("funds", funds, cache.DefaultExpiration)
	json.NewEncoder(w).Encode(funds)
}
