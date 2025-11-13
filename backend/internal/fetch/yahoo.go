package fetch

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func FetchYahoo(symbol string) (Fund, error) {
	var f Fund
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

	if q, ok := quotes[symbol]; ok {
		f.Symbol = symbol
		f.Price = q.Price
		f.Change = q.Change
	}
	return f, nil
}
