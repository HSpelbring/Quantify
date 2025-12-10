package fetch

import (
	"backend/internal/models"
	"encoding/json"
	"fmt"
	"net/http"
)

// Define QuoteResponse so we can parse Python's JSON structure
type QuoteResponse struct {
	Price   float64   `json:"price"`
	Change  float64   `json:"change"`
	Open    float64   `json:"open"`
	History []float64 `json:"history"`
}

func FetchYahoo(symbol string) (models.Fund, error) {
	var f models.Fund

	// Map ETF → Index
	indexMap := map[string]string{
		"SPY": "^GSPC",
		"QQQ": "^NDX",
		"DIA": "^DJI",
		"IWM": "^RUT",
	}

	lookup := symbol
	if mapped, ok := indexMap[symbol]; ok {
		lookup = mapped
	}

	// log.Printf("[FetchYahoo] Fetching quotes from Python...")
	resp, err := http.Get("http://localhost:8000/quotes")
	if err != nil {
		return f, err
	}
	defer resp.Body.Close()

	// NEW STRUCT FOR PARSING PYTHON
	var quotes map[string]QuoteResponse

	if err := json.NewDecoder(resp.Body).Decode(&quotes); err != nil {
		return f, fmt.Errorf("decode: %v", err)
	}

	// Match the index or ETF symbol
	if q, ok := quotes[lookup]; ok {
		// log.Printf("[FetchYahoo] Found %s (price=%.2f, history=%d points)", lookup, q.Price, len(q.History))
		f.Symbol = symbol
		f.Price = q.Price
		f.Change = q.Change
		f.Open = q.Open
		f.History = q.History
	} else {
		// log.Printf("[FetchYahoo] Symbol %s not found in quotes response", lookup)
	}

	return f, nil
}
