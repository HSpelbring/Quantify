package fetch

import (
	"errors"
)

func FetchHistory(symbol string, rangeParam string) (interface{}, error) {
	if symbol == "" {
		return nil, errors.New("symbol required")
	}

	data := []map[string]interface{}{
		{"date": "2025-11-01", "open": 225.0, "close": 229.5, "high": 230.2, "low": 224.9, "volume": 60000000},
		{"date": "2025-11-02", "open": 229.5, "close": 230.1, "high": 231.0, "low": 228.8, "volume": 59000000},
	}
	return map[string]interface{}{
		"symbol":   symbol,
		"range":    rangeParam,
		"interval": "1d",
		"data":     data,
	}, nil
}
