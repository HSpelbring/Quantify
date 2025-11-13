package fetch

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

var (
	finnhubKey = os.Getenv("FINNHUB_API_KEY")
	httpClient = &http.Client{Timeout: 8 * time.Second}
)

// ---------------------------------------------
// Fetch real-time quote from Finnhub
// ---------------------------------------------
func FetchFinnhubQuote(symbol string) (float64, float64, error) {
	if finnhubKey == "" {
		return 0, 0, fmt.Errorf("FINNHUB_API_KEY not set")
	}

	url := fmt.Sprintf(
		"https://finnhub.io/api/v1/quote?symbol=%s&token=%s",
		symbol, finnhubKey,
	)

	resp, err := httpClient.Get(url)
	if err != nil {
		return 0, 0, fmt.Errorf("finnhub quote request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return 0, 0, fmt.Errorf("finnhub quote returned %d", resp.StatusCode)
	}

	var data struct {
		C  float64 `json:"c"`  // current price
		D  float64 `json:"d"`  // absolute change
		Dp float64 `json:"dp"` // percent change
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return 0, 0, fmt.Errorf("decode finnhub response failed: %w", err)
	}

	// validate sane price
	if data.C <= 0 {
		return 0, 0, fmt.Errorf("finnhub returned invalid price for %s", symbol)
	}

	return data.C, data.Dp, nil
}

// ---------------------------------------------
// Fetch fundamentals from Finnhub
// ---------------------------------------------
func FetchFinnhubFundamentals(symbol string) (map[string]any, error) {
	if finnhubKey == "" {
		return nil, fmt.Errorf("FINNHUB_API_KEY not set")
	}

	url := fmt.Sprintf(
		"https://finnhub.io/api/v1/stock/metric?symbol=%s&metric=all&token=%s",
		symbol, finnhubKey,
	)

	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("finnhub fundamentals request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("finnhub fundamentals returned %d", resp.StatusCode)
	}

	var result struct {
		Metric map[string]any `json:"metric"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode finnhub fundamentals failed: %w", err)
	}

	if len(result.Metric) == 0 {
		return nil, fmt.Errorf("no fundamentals found for %s", symbol)
	}

	return result.Metric, nil
}
