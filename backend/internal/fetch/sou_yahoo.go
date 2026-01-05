package fetch

import (
	"backend/internal/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type PriceResponse struct {
	Symbol        string  `json:"symbol"`
	Price         float64 `json:"price"`
	Change        float64 `json:"change"`
	ChangePercent float64 `json:"changePercent"`
}

func FetchYahoo(symbol string) (models.Fund, error) {
	var f models.Fund

	// Map ETF → Index (if needed for legacy reasons, but /price/ endpoint handles tickers directly)
	// If symbol is SPY, we might want ^GSPC data?
	// Usually users want the ETF price if they search SPY.
	// But let's check existing mapping:
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

	// Call Python lightweight endpoint
	url := fmt.Sprintf("http://localhost:8000/price/%s", lookup)
	resp, err := http.Get(url)
	if err != nil {
		return f, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return f, fmt.Errorf("python service returned status: %d", resp.StatusCode)
	}

	var pr PriceResponse
	if err := json.NewDecoder(resp.Body).Decode(&pr); err != nil {
		return f, fmt.Errorf("decode: %v", err)
	}

	// Map to Fund
	f.Symbol = symbol
	f.Price = pr.Price
	f.Change = pr.Change
	f.ChangePercent = pr.ChangePercent
	// f.History is not returned by /price, which is fine for lightweight fetch

	// If we got valid data, success
	if f.Price != 0 {
		return f, nil
	}

	return f, fmt.Errorf("zero price returned")
}

// Full structure for Dashboard (includes history)
type QuoteResponse struct {
	Price   float64   `json:"price"`
	Change  float64   `json:"change"`
	Open    float64   `json:"open"`
	History []float64 `json:"history"`
}

func FetchYahooBulk(symbols []string) (map[string]models.Fund, error) {
	results := make(map[string]models.Fund)

	url := "http://localhost:8000/quotes"
	if len(symbols) > 0 {
		url += "?symbols=" + strings.Join(symbols, ",")
	}

	resp, err := http.Get(url)
	if err != nil {
		return results, err
	}
	defer resp.Body.Close()

	var quotes map[string]QuoteResponse
	if err := json.NewDecoder(resp.Body).Decode(&quotes); err != nil {
		return results, fmt.Errorf("decode: %v", err)
	}

	for key, q := range quotes {
		results[key] = models.Fund{
			Symbol:  key,
			Price:   q.Price,
			Change:  q.Change,
			Open:    q.Open,
			History: q.History,
		}
	}
	return results, nil
}
