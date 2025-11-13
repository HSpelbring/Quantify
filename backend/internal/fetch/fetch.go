package fetch

import (
	"log"
	"time"
)

type Fund struct {
	Symbol string  `json:"symbol"`
	Name   string  `json:"name"`
	Price  float64 `json:"price"`
	Change float64 `json:"change"`
}

// FetchFunds performs a tiered fetch using available sources.
func FetchFunds() ([]Fund, error) {
	symbols := []struct {
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

	funds := []Fund{}

	for _, s := range symbols {
		data, err := FetchYahoo(s.Symbol)
		if err != nil || data.Price == 0 {
			log.Printf("⚠️ Yahoo failed for %s, trying Finnhub...\n", s.Symbol)
			data, err = FetchFinnhub(s.Symbol)
		}

		if err != nil {
			log.Printf("❌ Both sources failed for %s: %v", s.Symbol, err)
			continue
		}

		data.Name = s.Name
		funds = append(funds, data)

		// avoid hammering APIs
		time.Sleep(500 * time.Millisecond)
	}

	return funds, nil
}
