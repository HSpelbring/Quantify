package fetch

import (
	"time"

	"github.com/patrickmn/go-cache"
)

var c = cache.New(1*time.Minute, 10*time.Minute)

func GetCachedFunds() ([]Fund, bool) {
	if x, found := c.Get("funds"); found {
		if list, ok := x.([]Fund); ok {
			return list, true
		}
	}
	return nil, false
}

func CacheFunds(list []Fund) {
	c.Set("funds", list, cache.DefaultExpiration)
}
