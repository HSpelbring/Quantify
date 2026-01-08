package engine

import (
	"backend/internal/db"
	"backend/internal/models"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
)

var watchlistTickers = []string{"AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"}

// StartWorker runs the rule evaluation engine periodically
func StartWorker() {
	log.Println("[ENGINE] Starting Rule Engine Worker...")
	ticker := time.NewTicker(1 * time.Minute) // Evaluate every minute for MVP testing
	go func() {
		for range ticker.C {
			EvaluateAllRules()
		}
	}()
}

func EvaluateAllRules() {
	rules, err := db.GetRules()
	if err != nil {
		log.Printf("[ENGINE] Error fetching rules: %v", err)
		return
	}

	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}

		tickers := getUniverseTickers(rule.Definition.Universe)
		for _, symbol := range tickers {
			// Check cooldown
			if isCooledDown(rule, symbol) {
				continue
			}

			// Fetch Indicators
			indicators, err := fetchIndicators(symbol)
			if err != nil {
				log.Printf("[ENGINE] Error fetching indicators for %s: %v", symbol, err)
				continue
			}

			// Evaluate
			if EvaluateLogic(rule.Definition.Logic, indicators) {
				triggerNotification(rule, symbol, indicators)
			}
		}
	}
}

func getUniverseTickers(u models.UniverseConfig) []string {
	if u.Type == "single_ticker" {
		return []string{u.Value}
	}
	if u.Type == "watchlist" {
		return watchlistTickers
	}
	return nil
}

func isCooledDown(rule models.NotificationRule, symbol string) bool {
	lastStr, ok := rule.LastTriggered[symbol]
	if !ok {
		return false
	}

	last, err := time.Parse(time.RFC3339, lastStr)
	if err != nil {
		return false
	}

	cooldown := time.Duration(rule.Definition.Cooldown) * 24 * time.Hour
	// For testing purposes, if cooldown is set to 3 days, let's treat it as 3 minutes if we want to test quickly?
	// No, let's follow requirements.
	return time.Since(last) < cooldown
}

func fetchIndicators(symbol string) (map[string]interface{}, error) {
	resp, err := http.Get(fmt.Sprintf("http://localhost:8000/indicators/%s", symbol))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	return result, err
}

func EvaluateLogic(node models.LogicNode, indicators map[string]interface{}) bool {
	if node.Condition != nil {
		return EvaluateCondition(*node.Condition, indicators)
	}

	if node.Not != nil {
		return !EvaluateLogic(*node.Not, indicators)
	}

	if len(node.And) > 0 {
		for _, sub := range node.And {
			if !EvaluateLogic(sub, indicators) {
				return false
			}
		}
		return true
	}

	if len(node.Or) > 0 {
		for _, sub := range node.Or {
			if EvaluateLogic(sub, indicators) {
				return true
			}
		}
		return false
	}

	return false
}

func EvaluateCondition(cond models.Condition, indicators map[string]interface{}) bool {
	val, ok := indicators[cond.Variable]
	if !ok {
		return false
	}

	switch cond.Operator {
	case ">=":
		v, ok1 := val.(float64)
		c, ok2 := cond.Value.(float64)
		if ok1 && ok2 {
			return v >= c
		}
	case "<=":
		v, ok1 := val.(float64)
		c, ok2 := cond.Value.(float64)
		if ok1 && ok2 {
			return v <= c
		}
	case ">":
		v, ok1 := val.(float64)
		c, ok2 := cond.Value.(float64)
		if ok1 && ok2 {
			return v > c
		}
	case "<":
		v, ok1 := val.(float64)
		c, ok2 := cond.Value.(float64)
		if ok1 && ok2 {
			return v < c
		}
	case "==", "=":
		v, ok1 := val.(float64)
		c, ok2 := cond.Value.(float64)
		if ok1 && ok2 {
			return v == c
		}
	case "!=":
		v, ok1 := val.(float64)
		c, ok2 := cond.Value.(float64)
		if ok1 && ok2 {
			return v != c
		}
	case "crosses_above":
		return val == "crosses_above"
	case "crosses_below":
		return val == "crosses_below"
	}

	return false
}

func triggerNotification(rule models.NotificationRule, symbol string, indicators map[string]interface{}) {
	log.Printf("[ENGINE] TRIGGERED: Rule '%s' for %s", rule.Name, symbol)

	message := formatMessage(rule, symbol, indicators)
	details, _ := json.Marshal(indicators)

	note := models.TriggeredNotification{
		ID:          uuid.New().String(),
		RuleID:      rule.ID,
		Symbol:      symbol,
		Message:     message,
		Details:     string(details),
		TriggeredAt: time.Now().Format(time.RFC3339),
	}

	err := db.SaveTriggeredNotification(note)
	if err != nil {
		log.Printf("[ENGINE] Error saving notification: %v", err)
		return
	}

	err = db.UpdateRuleLastTriggered(rule.ID, symbol, note.TriggeredAt)
	if err != nil {
		log.Printf("[ENGINE] Error updating rule cooldown: %v", err)
	}
}

func formatMessage(rule models.NotificationRule, symbol string, indicators map[string]interface{}) string {
	// Simple human readable explanation
	if ret, ok := indicators["daily_return_pct"].(float64); ok {
		return fmt.Sprintf("%s triggered \"%s\" (%.2f%%)", symbol, rule.Name, ret)
	}
	return fmt.Sprintf("%s triggered \"%s\"", symbol, rule.Name)
}
