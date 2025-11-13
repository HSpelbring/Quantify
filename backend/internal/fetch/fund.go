package fetch

import (
	"errors"
)

func FetchFund(symbol string) (interface{}, error) {
	if symbol == "" {
		return nil, errors.New("symbol required")
	}

	// Search cache first
	if list, ok := GetCachedFunds(); ok {
		for _, f := range list {
			if f.Symbol == symbol {
				return f, nil
			}
		}
	}

	fd, err := FetchYahoo(symbol)
	if err != nil || fd.Price == 0 {
		// Fallback to Finnhub quote (price + change)
		price, change, ferr := FetchFinnhubQuote(symbol)
		if ferr != nil {
			// Both Yahoo and Finnhub failed
			return nil, ferr
		}
		fd.Price = price
		fd.Change = change
	}

	// Assign display name if tracked
	for _, t := range tracked {
		if t.Symbol == symbol {
			fd.Name = t.Name
			break
		}
	}

	return fd, nil
}
