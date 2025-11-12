package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/patrickmn/go-cache"
)

type Fund struct {
	Symbol string  `json:"symbol"`
	Name   string  `json:"name"`
	Price  float64 `json:"price"`
	Change float64 `json:"change"`
}

var fundCache = cache.New(60*time.Second, 10*time.Minute)

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

func HandleFunds(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	if cached, found := fundCache.Get("funds"); found {
		json.NewEncoder(w).Encode(cached)
		return
	}

	resp, err := http.Get("http://localhost:8000/quotes")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to contact Python service: %v", err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		http.Error(w, fmt.Sprintf("Python service returned %d: %s", resp.StatusCode, body), http.StatusInternalServerError)
		return
	}

	// Decode JSON from Python
	var quotes map[string]struct {
		Price  float64 `json:"price"`
		Change float64 `json:"change"`
	}
	body, _ := io.ReadAll(resp.Body)
	log.Printf("Raw Python response: %s\n", string(body))
	resp.Body = io.NopCloser(bytes.NewReader(body))
	if err := json.NewDecoder(resp.Body).Decode(&quotes); err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse Python response: %v", err), http.StatusInternalServerError)
		return
	}

	// Build funds, filling in defaults for missing ones
	funds := []Fund{}
	for _, s := range fundSymbols {
		q, exists := quotes[s.Symbol]
		if !exists {
			// provide fallback if Python didn't return it
			log.Printf("⚠️ Missing data for %s, using placeholder", s.Symbol)
			funds = append(funds, Fund{
				Symbol: s.Symbol,
				Name:   s.Name,
				Price:  0,
				Change: 0,
			})
			continue
		}

		funds = append(funds, Fund{
			Symbol: s.Symbol,
			Name:   s.Name,
			Price:  q.Price,
			Change: q.Change,
		})
	}

	// Cache + send
	fundCache.Set("funds", funds, cache.DefaultExpiration)
	json.NewEncoder(w).Encode(funds)
}
