package fetch

import (
	"backend/internal/models"
	"errors"
	"math"
	"strings"
)

func FetchFund(symbol string) (models.Fund, error) {
	var fd models.Fund

	if symbol == "" {
		return fd, errors.New("symbol required")
	}

	// -------------------------------
	// 1. CACHE CHECK (list, age, ok)
	// -------------------------------
	if list, _, ok := GetCachedFunds(); ok {
		for _, f := range list {
			if f.Symbol == symbol {
				return f, nil
			}
		}
	}

	// -------------------------------
	// 2. YAHOO PRIMARY FETCH
	// -------------------------------
	yahooFd, err := FetchYahoo(symbol)
	if err == nil {
		fd = yahooFd
	} else {
		fd.Symbol = symbol // fallback assignment
	}

	// -------------------------------
	// 3. PRICE & CHANGE LOGIC
	//    Yahoo => Finnhub => 0/0
	// -------------------------------
	price := fd.Price
	change := fd.Change

	needsFallback := price == 0 || math.IsNaN(price)

	// If it's an index (^GSPC, ^NDX, etc.) ALWAYS use Finnhub
	if strings.HasPrefix(symbol, "^") {
		needsFallback = true
	}

	if needsFallback {
		p, ch, ferr := FetchFinnhubQuote(symbol)
		if ferr == nil && p > 0 {
			price = p
			change = ch
		}
	}

	fd.Price = price
	fd.Change = change

	// -------------------------------
	// 4. NAME RESOLUTION
	// -------------------------------
	for _, t := range tracked {
		if t.Symbol == symbol {
			fd.Name = t.Name
			break
		}
	}

	if fd.Symbol == "" {
		fd.Symbol = symbol
	}
	if fd.Name == "" {
		fd.Name = symbol
	}

	return fd, nil
}
