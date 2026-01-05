package fetch

import (
	"backend/internal/models"
	"time"
)

// KnownInstruments maps symbols to display names
var KnownInstruments = map[string]string{
	// Indices
	"^GSPC": "S&P 500",
	"^NDX":  "NASDAQ 100",
	"^DJI":  "Dow Jones",
	"^RUT":  "Russell 2000",
	"RSP":   "S&P 500 Equal Weight",
	"^NYA":  "NYSE Composite",

	// Volatility
	"^VIX":  "VIX Index",
	"^VVIX": "VVIX",
	"VIX9D": "VIX 9-Day",

	// Commodities
	"CL=F": "Crude Oil (WTI)",
	"BZ=F": "Brent Crude",
	"GC=F": "Gold",
	"SI=F": "Silver",
	"NG=F": "Natural Gas",

	// FX
	"EURUSD=X": "EUR/USD",
	"JPY=X":    "USD/JPY",

	// Rates
	"^TNX": "US 10Y Yield",
	"^IRX": "US 2Y Yield",
	"^TYX": "US 30Y Yield",

	// Crypto
	"BTC-USD": "Bitcoin",
}

// DefaultTracked is the fallback list if no specific settings are provided
var DefaultTracked = []string{
	"^GSPC", "^NDX", "^DJI", "^RUT", "^VIX", "BTC-USD",
}

func FetchFunds(requestedSymbols []string) ([]models.Fund, error) {
	// 1. Determine which symbols to fetch
	targetSymbols := requestedSymbols
	if len(targetSymbols) == 0 {
		targetSymbols = DefaultTracked
	}

	// 2. CHECK CACHE (Simple Logic)
	// Current caching logic is rigid (returns ALL cached).
	// If requests are dynamic, global cache might be insufficient if it only stores the default set.
	// For now, if request is custom, we might skip cache or check if cache contains everything.
	// To be safe and simple: If custom symbols, skip global cache check for now (or improve cache later).
	// If standard default request, use cache.

	useCache := len(requestedSymbols) == 0 // Only use cache for default view

	if useCache {
		cached, ts, ok := GetCachedFunds()
		if ok {
			age := time.Since(ts)
			if age < 5*time.Minute {
				return cached, nil
			}
		}
	}

	// 3. Fetch from Python
	result := []models.Fund{}
	bulkData, err := FetchYahooBulk(targetSymbols)

	for _, sym := range targetSymbols {
		name := KnownInstruments[sym]
		if name == "" {
			name = sym // Fallback
		}

		// 1. Try Bulk Data
		if err == nil {
			if f, found := bulkData[sym]; found {
				f.Name = name
				f.Symbol = sym
				result = append(result, f)
				continue
			}
		}

		// 2. Fallback to Zero
		result = append(result, models.Fund{
			Symbol: sym,
			Name:   name,
			Price:  0,
			Change: 0,
		})
	}

	// 4. Update Cache (Only if default set)
	if useCache {
		CacheFunds(result)
	}

	return result, nil
}
