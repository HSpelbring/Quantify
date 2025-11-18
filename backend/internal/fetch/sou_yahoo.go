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
		f.Symbol = symbol
		f.Price = q.Price
		f.Change = q.Change
		f.History = q.History
	}

	return f, nil
}
