package fetch

import (
	"backend/internal/models"
	"time"
)

type fundCache struct {
	List      []models.Fund
	Timestamp time.Time
}

var fundsCache *fundCache

// Return cache if present
func GetCachedFunds() ([]models.Fund, time.Time, bool) {
	if fundsCache == nil {
		return nil, time.Time{}, false
	}
	return fundsCache.List, fundsCache.Timestamp, true
}

func CacheFunds(list []models.Fund) {
	fundsCache = &fundCache{
		List:      list,
		Timestamp: time.Now(),
	}
}
