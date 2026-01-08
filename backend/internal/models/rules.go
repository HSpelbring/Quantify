package models

type UniverseConfig struct {
	Type  string `json:"type"`  // "single_ticker", "watchlist"
	Value string `json:"value"` // "AAPL", "Tech/Growth"
}

type Condition struct {
	Variable string      `json:"var"`
	Operator string      `json:"op"`
	Value    interface{} `json:"value"`
}

type LogicNode struct {
	And       []LogicNode `json:"and,omitempty"`
	Or        []LogicNode `json:"or,omitempty"`
	Not       *LogicNode  `json:"not,omitempty"`
	Condition *Condition  `json:"condition,omitempty"`
}

type RuleDefinition struct {
	Universe  UniverseConfig `json:"universe"`
	Timeframe string         `json:"timeframe"` // Only "1D" for now
	Cooldown  int            `json:"cooldown_days"`
	Logic     LogicNode      `json:"logic"`
}

type NotificationRule struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	Enabled       bool              `json:"enabled"`
	Definition    RuleDefinition    `json:"definition"`
	LastTriggered map[string]string `json:"last_triggered"` // symbol -> RFC3339 timestamp
}

type TriggeredNotification struct {
	ID          string  `json:"id"`
	RuleID      string  `json:"rule_id"`
	Symbol      string  `json:"symbol"`
	Message     string  `json:"message"`
	Details     string  `json:"details"` // JSON blob of evaluation result
	TriggeredAt string  `json:"triggered_at"`
	DismissedAt *string `json:"dismissed_at,omitempty"`
}
