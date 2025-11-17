package fetch

import (
	"time"
)

type fundCache struct {
	List      []Fund
	Timestamp time.Time
}

var fundsCache *fundCache

// Return cache if present
func GetCachedFunds() ([]Fund, time.Time, bool) {
	if fundsCache == nil {
		return nil, time.Time{}, false
	}
	return fundsCache.List, fundsCache.Timestamp, true
}

func CacheFunds(list []Fund) {
	fundsCache = &fundCache{
		List:      list,
		Timestamp: time.Now(),
	}
}
