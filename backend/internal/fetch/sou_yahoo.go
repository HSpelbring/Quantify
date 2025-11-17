package fetch

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func FetchYahoo(symbol string) (Fund, error) {
	var f Fund

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

	var quotes map[string]struct {
		Price  float64 `json:"price"`
		Change float64 `json:"change"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&quotes); err != nil {
		return f, fmt.Errorf("decode: %v", err)
	}

	// Now match lookup
	if q, ok := quotes[lookup]; ok {
		f.Symbol = symbol // preserve user-facing symbol
		f.Price = q.Price
		f.Change = q.Change
	}

	return f, nil
}
