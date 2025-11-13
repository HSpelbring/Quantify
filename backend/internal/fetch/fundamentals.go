package fetch

import (
	"errors"
	"time"
)

func FetchFundamentals(symbol string) (interface{}, error) {
	if symbol == "" {
		return nil, errors.New("symbol required")
	}
	return map[string]interface{}{
		"symbol":         symbol,
		"market_cap":     3.54e12,
		"pe_ratio":       34.2,
		"eps":            6.7,
		"dividend_yield": 0.005,
		"updated_at":     time.Now().UTC().Format(time.RFC3339),
	}, nil
}
