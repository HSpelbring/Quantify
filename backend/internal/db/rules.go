package db

import (
	"backend/internal/models"
	"database/sql"
	"encoding/json"
	"log"
)

func InitRules(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS notification_rules (
		id TEXT PRIMARY KEY,
		name TEXT,
		enabled BOOLEAN DEFAULT 1,
		definition TEXT,
		last_triggered TEXT
	);

	CREATE TABLE IF NOT EXISTS triggered_notifications (
		id TEXT PRIMARY KEY,
		rule_id TEXT,
		symbol TEXT,
		message TEXT,
		details TEXT,
		triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		dismissed_at DATETIME,
		FOREIGN KEY(rule_id) REFERENCES notification_rules(id)
	);
	`
	_, err := db.Exec(schema)
	if err != nil {
		return err
	}

	// Insert test rules if they don't exist
	return insertTestRules(db)
}

func insertTestRules(db *sql.DB) error {
	testRules := []models.NotificationRule{
		{
			ID:      "rule-1-momentum",
			Name:    "Daily Momentum (AAPL)",
			Enabled: true,
			Definition: models.RuleDefinition{
				Universe: models.UniverseConfig{
					Type:  "single_ticker",
					Value: "AAPL",
				},
				Timeframe: "1D",
				Cooldown:  3,
				Logic: models.LogicNode{
					Condition: &models.Condition{
						Variable: "daily_return_pct",
						Operator: ">=",
						Value:    2.0,
					},
				},
			},
			LastTriggered: make(map[string]string),
		},
		{
			ID:      "rule-2-breakout",
			Name:    "Confirmed Breakout",
			Enabled: true,
			Definition: models.RuleDefinition{
				Universe: models.UniverseConfig{
					Type:  "watchlist",
					Value: "Tech/Growth",
				},
				Timeframe: "1D",
				Cooldown:  5,
				Logic: models.LogicNode{
					And: []models.LogicNode{
						{
							Condition: &models.Condition{
								Variable: "daily_return_pct",
								Operator: ">=",
								Value:    2.0,
							},
						},
						{
							Condition: &models.Condition{
								Variable: "volume_vs_30d_avg",
								Operator: ">=",
								Value:    2.0,
							},
						},
					},
				},
			},
			LastTriggered: make(map[string]string),
		},
		{
			ID:      "rule-3-golden-cross",
			Name:    "Golden Cross (MSFT)",
			Enabled: true,
			Definition: models.RuleDefinition{
				Universe: models.UniverseConfig{
					Type:  "single_ticker",
					Value: "MSFT",
				},
				Timeframe: "1D",
				Cooldown:  30,
				Logic: models.LogicNode{
					Condition: &models.Condition{
						Variable: "ma_cross_50_200",
						Operator: "crosses_above",
						Value:    nil,
					},
				},
			},
			LastTriggered: make(map[string]string),
		},
	}

	for _, rule := range testRules {
		defJSON, _ := json.Marshal(rule.Definition)
		triggeredJSON, _ := json.Marshal(rule.LastTriggered)

		_, err := db.Exec(`
			INSERT OR IGNORE INTO notification_rules (id, name, enabled, definition, last_triggered)
			VALUES (?, ?, ?, ?, ?)
		`, rule.ID, rule.Name, rule.Enabled, string(defJSON), string(triggeredJSON))
		if err != nil {
			log.Printf("Error inserting test rule %s: %v", rule.ID, err)
		}
	}

	return nil
}

func GetRules() ([]models.NotificationRule, error) {
	rows, err := DB.Query("SELECT id, name, enabled, definition, last_triggered FROM notification_rules")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.NotificationRule
	for rows.Next() {
		var rule models.NotificationRule
		var defJSON, triggeredJSON string
		err := rows.Scan(&rule.ID, &rule.Name, &rule.Enabled, &defJSON, &triggeredJSON)
		if err != nil {
			return nil, err
		}

		json.Unmarshal([]byte(defJSON), &rule.Definition)
		json.Unmarshal([]byte(triggeredJSON), &rule.LastTriggered)
		rules = append(rules, rule)
	}
	return rules, nil
}

func ToggleRule(id string, enabled bool) error {
	_, err := DB.Exec("UPDATE notification_rules SET enabled = ? WHERE id = ?", enabled, id)
	return err
}

func GetActiveNotifications() ([]models.TriggeredNotification, error) {
	rows, err := DB.Query(`
		SELECT id, rule_id, symbol, message, details, triggered_at, dismissed_at 
		FROM triggered_notifications 
		WHERE dismissed_at IS NULL
		ORDER BY triggered_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []models.TriggeredNotification
	for rows.Next() {
		var n models.TriggeredNotification
		err := rows.Scan(&n.ID, &n.RuleID, &n.Symbol, &n.Message, &n.Details, &n.TriggeredAt, &n.DismissedAt)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, nil
}

func DismissNotification(id string) error {
	_, err := DB.Exec("UPDATE triggered_notifications SET dismissed_at = CURRENT_TIMESTAMP WHERE id = ?", id)
	return err
}

func SaveTriggeredNotification(n models.TriggeredNotification) error {
	_, err := DB.Exec(`
		INSERT INTO triggered_notifications (id, rule_id, symbol, message, details)
		VALUES (?, ?, ?, ?, ?)
	`, n.ID, n.RuleID, n.Symbol, n.Message, n.Details)
	return err
}

func SaveRule(rule models.NotificationRule) error {
	defJSON, _ := json.Marshal(rule.Definition)
	triggeredJSON, _ := json.Marshal(rule.LastTriggered)

	_, err := DB.Exec(`
		INSERT INTO notification_rules (id, name, enabled, definition, last_triggered)
		VALUES (?, ?, ?, ?, ?)
	`, rule.ID, rule.Name, rule.Enabled, string(defJSON), string(triggeredJSON))
	return err
}

func UpdateRuleLastTriggered(ruleID string, symbol string, timestamp string) error {
	var triggeredJSON string
	err := DB.QueryRow("SELECT last_triggered FROM notification_rules WHERE id = ?", ruleID).Scan(&triggeredJSON)
	if err != nil {
		return err
	}

	triggered := make(map[string]string)
	json.Unmarshal([]byte(triggeredJSON), &triggered)
	triggered[symbol] = timestamp

	newJSON, _ := json.Marshal(triggered)
	_, err = DB.Exec("UPDATE notification_rules SET last_triggered = ? WHERE id = ?", string(newJSON), ruleID)
	return err
}
