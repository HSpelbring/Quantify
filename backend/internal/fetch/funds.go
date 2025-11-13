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

var tracked = []struct {
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

func FetchFunds() ([]Fund, error) {
	// Check cache first
	if list, ok := GetCachedFunds(); ok {
		return list, nil
	}

	funds := []Fund{}
	for _, s := range tracked {
		data, err := FetchYahoo(s.Symbol)

		if err != nil || data.Price == 0 {
			log.Printf("⚠️ Yahoo failed for %s, trying Finnhub...", s.Symbol)

			price, change, ferr := FetchFinnhubQuote(s.Symbol)
			if ferr != nil {
				log.Printf("❌ Finnhub also failed for %s: %v", s.Symbol, ferr)
				continue // skip this symbol completely
			}

			data.Price = price
			data.Change = change
		}

		data.Name = s.Name
		funds = append(funds, data)

		// Be nice to the APIs
		time.Sleep(300 * time.Millisecond)
	}

	CacheFunds(funds)
	return funds, nil
}
