package fetch

import (
	"time"

	"github.com/patrickmn/go-cache"
)

var c = cache.New(1*time.Minute, 10*time.Minute)

func GetCachedFunds() ([]Fund, bool) {
	if x, found := c.Get("funds"); found {
		return x.([]Fund), true
	}
	return nil, false
}

func CacheFunds(funds []Fund) {
	c.Set("funds", funds, cache.DefaultExpiration)
}
