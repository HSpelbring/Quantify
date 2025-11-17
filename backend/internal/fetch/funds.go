package fetch

import "time"

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
	// CHECK CACHE AGE
	cached, ts, ok := GetCachedFunds()
	if ok {
		age := time.Since(ts)
		if age < 5*time.Minute {
			// Fresh — return cached version
			return cached, nil
		}
	}

	// Otherwise fetch fresh data
	result := []Fund{}

	for _, t := range tracked {
		sym := t.Symbol

		// Try full robust FetchFund() logic
		f, err := FetchFund(sym)
		if err == nil && f.Price > 0 {
			f.Name = t.Name
			result = append(result, f)
			continue
		}

		// Fallback to previous cached item (if exists)
		if ok {
			for _, old := range cached {
				if old.Symbol == sym {
					result = append(result, old)
					goto next
				}
			}
		}

		// Last resort: placeholder
		result = append(result, Fund{
			Symbol: sym,
			Name:   t.Name,
			Price:  0,
			Change: 0,
		})

	next:
	}

	// UPDATE CACHE
	CacheFunds(result)

	return result, nil
}
