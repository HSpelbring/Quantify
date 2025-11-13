package fetch

import "time"

func FetchEOD() (interface{}, error) {
	data := []map[string]interface{}{
		{"symbol": "SPY", "close": 674.23, "change": -0.84},
		{"symbol": "QQQ", "close": 611.27, "change": -1.58},
	}
	return map[string]interface{}{
		"date": time.Now().Add(-24 * time.Hour).Format("2006-01-02"),
		"eod":  data,
	}, nil
}
