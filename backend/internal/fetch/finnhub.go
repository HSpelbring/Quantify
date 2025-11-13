package fetch

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

const finnhubBase = "https://finnhub.io/api/v1/quote?symbol=%s&token=%s"

func FetchFinnhub(symbol string) (Fund, error) {
	var f Fund
	token := os.Getenv("FINNHUB_API_KEY")
	if token == "" {
		return f, fmt.Errorf("FINNHUB_API_KEY not set")
	}

	resp, err := http.Get(fmt.Sprintf(finnhubBase, mapSymbol(symbol), token))
	if err != nil {
		return f, err
	}
	defer resp.Body.Close()

	var result struct {
		C float64 `json:"c"`  // current price
		P float64 `json:"pc"` // previous close
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return f, err
	}

	change := ((result.C - result.P) / result.P) * 100
	f.Symbol = symbol
	f.Price = result.C
	f.Change = change

	return f, nil
}

// mapSymbol translates indices to ETF proxies (Finnhub doesn’t use ^GSPC style symbols)
func mapSymbol(symbol string) string {
	switch symbol {
	case "^GSPC":
		return "SPY"
	case "^NDX":
		return "QQQ"
	case "^DJI":
		return "DIA"
	case "^RUT":
		return "IWM"
	case "^VIX":
		return "VIXY"
	default:
		return symbol
	}
}
