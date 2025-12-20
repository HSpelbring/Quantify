package fetch

import (
	"backend/internal/models"
	"time"
)

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

func FetchFunds() ([]models.Fund, error) {
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
	result := []models.Fund{}

	// Bulk Fetch from Python (1 call)
	bulkData, err := FetchYahooBulk()

	for _, t := range tracked {
		sym := t.Symbol

		// 1. Try Bulk Data
		if err == nil {
			if f, found := bulkData[sym]; found && f.Price > 0 {
				f.Name = t.Name
				// Ensure symbol matches our tracked list
				f.Symbol = sym
				result = append(result, f)
				continue
			}
		}

		// 2. Fallback to Cache
		if ok {
			for _, old := range cached {
				if old.Symbol == sym {
					result = append(result, old)
					goto next
				}
			}
		}

		// 3. Fallback to Zero
		result = append(result, models.Fund{
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
