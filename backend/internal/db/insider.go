package db

import (
	"database/sql"
	"time"
)

// InsiderTrade represents a single insider trading transaction
type InsiderTrade struct {
	ID int `json:"id"`

	// Core Identification
	Ticker      string `json:"ticker"`
	CompanyName string `json:"companyName"`
	CompanyCIK  string `json:"companyCik"`
	Exchange    string `json:"exchange"`
	Industry    string `json:"industry"`

	// Insider Identity
	InsiderName         string `json:"insiderName"`
	InsiderCIK          string `json:"insiderCik"`
	InsiderTitle        string `json:"insiderTitle"`
	IsOfficer           bool   `json:"isOfficer"`
	IsDirector          bool   `json:"isDirector"`
	IsTenPercentOwner   bool   `json:"isTenPercentOwner"`
	RelationshipSummary string `json:"relationshipSummary"`

	// Transaction Data
	TransactionType  string    `json:"transactionType"` // BUY or SELL
	TransactionCode  string    `json:"transactionCode"`
	SharesTransacted int       `json:"sharesTransacted"`
	PricePerShare    float64   `json:"pricePerShare"`
	TransactionValue float64   `json:"transactionValue"`
	TransactionDate  time.Time `json:"transactionDate"`
	FilingDate       time.Time `json:"filingDate"`

	// Ownership After Trade
	SharesOwnedAfter    int     `json:"sharesOwnedAfter"`
	OwnershipChangePct  float64 `json:"ownershipChangePct"`
	OwnershipPctCompany float64 `json:"ownershipPctCompany"`

	// Company Context
	SharesOutstanding int     `json:"sharesOutstanding"`
	PublicFloat       int     `json:"publicFloat"`
	FloatImpactPct    float64 `json:"floatImpactPct"`
	MarketCapAtTrade  float64 `json:"marketCapAtTrade"`
	AvgDailyVolume    int     `json:"avgDailyVolume"`

	// Trade Classification
	IsDiscretionary       bool `json:"isDiscretionary"`
	IsCompensationRelated bool `json:"isCompensationRelated"`
	IsAutomaticTrade      bool `json:"isAutomaticTrade"`
	IsFirstTimeBuy        bool `json:"isFirstTimeBuy"`
	IsClusterTrade        bool `json:"isClusterTrade"`

	// Derived Intelligence
	ConvictionScore    int     `json:"convictionScore"`
	InsiderWeight      float64 `json:"insiderWeight"`
	ValueVsSalaryRatio float64 `json:"valueVsSalaryRatio"`
	NetInsiderFlow30d  float64 `json:"netInsiderFlow30d"`
	BuySellRatio90d    float64 `json:"buySellRatio90d"`

	// Compliance
	FormType     string    `json:"formType"`
	SecFilingURL string    `json:"secFilingUrl"`
	Source       string    `json:"source"`
	IngestedAt   time.Time `json:"ingestedAt"`

	// UI Helpers
	SignalLabel     string `json:"signalLabel"` // Bullish, Bearish, Neutral
	SignalReason    string `json:"signalReason"`
	HighlightFlag   bool   `json:"highlightFlag"`
	ConfidenceBadge string `json:"confidenceBadge"` // Low, Medium, High
}

// InitInsiderTrades creates the insider_trades table
func InitInsiderTrades(db *sql.DB) error {
	query := `
	CREATE TABLE IF NOT EXISTS insider_trades (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		
		-- Core Identification
		ticker TEXT NOT NULL,
		company_name TEXT,
		company_cik TEXT,
		exchange TEXT,
		industry TEXT,
		
		-- Insider Identity
		insider_name TEXT NOT NULL,
		insider_cik TEXT,
		insider_title TEXT,
		is_officer BOOLEAN,
		is_director BOOLEAN,
		is_ten_percent_owner BOOLEAN,
		relationship_summary TEXT,
		
		-- Transaction Data
		transaction_type TEXT CHECK(transaction_type IN ('BUY', 'SELL')),
		transaction_code TEXT,
		shares_transacted INTEGER,
		price_per_share REAL,
		transaction_value REAL,
		transaction_date DATE NOT NULL,
		filing_date DATE NOT NULL,
		
		-- Ownership After Trade
		shares_owned_after INTEGER,
		ownership_change_pct REAL,
		ownership_pct_company REAL,
		
		-- Company Context
		shares_outstanding INTEGER,
		public_float INTEGER,
		float_impact_pct REAL,
		market_cap_at_trade REAL,
		avg_daily_volume INTEGER,
		
		-- Trade Classification
		is_discretionary BOOLEAN,
		is_compensation_related BOOLEAN,
		is_automatic_trade BOOLEAN,
		is_first_time_buy BOOLEAN,
		is_cluster_trade BOOLEAN,
		
		-- Derived Intelligence
		conviction_score INTEGER,
		insider_weight REAL,
		value_vs_salary_ratio REAL,
		net_insider_flow_30d REAL,
		buy_sell_ratio_90d REAL,
		
		-- Compliance
		form_type TEXT,
		sec_filing_url TEXT,
		source TEXT DEFAULT 'SEC',
		ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		
		-- UI Helpers
		signal_label TEXT CHECK(signal_label IN ('Bullish', 'Bearish', 'Neutral')),
		signal_reason TEXT,
		highlight_flag BOOLEAN,
		confidence_badge TEXT CHECK(confidence_badge IN ('Low', 'Medium', 'High')),
		
		-- Deduplication: prevent duplicate trades
		UNIQUE(ticker, insider_cik, transaction_date, shares_transacted)
	);

	CREATE INDEX IF NOT EXISTS idx_ticker ON insider_trades(ticker);
	CREATE INDEX IF NOT EXISTS idx_filing_date ON insider_trades(filing_date);
	CREATE INDEX IF NOT EXISTS idx_transaction_date ON insider_trades(transaction_date);
	CREATE INDEX IF NOT EXISTS idx_insider_cik ON insider_trades(insider_cik);
	`

	_, err := db.Exec(query)
	return err
}

// GetLatestFilingDate returns the most recent filing date for a ticker
// Returns zero time if no trades exist
func GetLatestFilingDate(ticker string) (time.Time, error) {
	var filingDate time.Time
	query := `SELECT MAX(filing_date) FROM insider_trades WHERE ticker = ?`

	err := DB.QueryRow(query, ticker).Scan(&filingDate)
	if err == sql.ErrNoRows {
		return time.Time{}, nil // No trades yet
	}
	if err != nil {
		return time.Time{}, err
	}

	return filingDate, nil
}

// SaveInsiderTrade inserts a new insider trade into the database
// Uses INSERT OR IGNORE to handle duplicates gracefully
func SaveInsiderTrade(trade *InsiderTrade) error {
	query := `
	INSERT OR IGNORE INTO insider_trades (
		ticker, company_name, company_cik, exchange, industry,
		insider_name, insider_cik, insider_title, is_officer, is_director, 
		is_ten_percent_owner, relationship_summary,
		transaction_type, transaction_code, shares_transacted, price_per_share, 
		transaction_value, transaction_date, filing_date,
		shares_owned_after, ownership_change_pct, ownership_pct_company,
		shares_outstanding, public_float, float_impact_pct, market_cap_at_trade, avg_daily_volume,
		is_discretionary, is_compensation_related, is_automatic_trade, is_first_time_buy, is_cluster_trade,
		conviction_score, insider_weight, value_vs_salary_ratio, net_insider_flow_30d, buy_sell_ratio_90d,
		form_type, sec_filing_url, source,
		signal_label, signal_reason, highlight_flag, confidence_badge
	) VALUES (
		?, ?, ?, ?, ?,
		?, ?, ?, ?, ?,
		?, ?,
		?, ?, ?, ?,
		?, ?, ?,
		?, ?, ?,
		?, ?, ?, ?, ?,
		?, ?, ?, ?, ?,
		?, ?, ?, ?, ?,
		?, ?, ?,
		?, ?, ?, ?
	)`

	_, err := DB.Exec(query,
		trade.Ticker, trade.CompanyName, trade.CompanyCIK, trade.Exchange, trade.Industry,
		trade.InsiderName, trade.InsiderCIK, trade.InsiderTitle, trade.IsOfficer, trade.IsDirector,
		trade.IsTenPercentOwner, trade.RelationshipSummary,
		trade.TransactionType, trade.TransactionCode, trade.SharesTransacted, trade.PricePerShare,
		trade.TransactionValue, trade.TransactionDate, trade.FilingDate,
		trade.SharesOwnedAfter, trade.OwnershipChangePct, trade.OwnershipPctCompany,
		trade.SharesOutstanding, trade.PublicFloat, trade.FloatImpactPct, trade.MarketCapAtTrade, trade.AvgDailyVolume,
		trade.IsDiscretionary, trade.IsCompensationRelated, trade.IsAutomaticTrade, trade.IsFirstTimeBuy, trade.IsClusterTrade,
		trade.ConvictionScore, trade.InsiderWeight, trade.ValueVsSalaryRatio, trade.NetInsiderFlow30d, trade.BuySellRatio90d,
		trade.FormType, trade.SecFilingURL, trade.Source,
		trade.SignalLabel, trade.SignalReason, trade.HighlightFlag, trade.ConfidenceBadge,
	)

	return err
}

// GetInsiderTrades retrieves insider trades for a ticker, limited by count
func GetInsiderTrades(ticker string, limit int) ([]InsiderTrade, error) {
	query := `
	SELECT id, ticker, company_name, company_cik, exchange, industry,
		insider_name, insider_cik, insider_title, is_officer, is_director, 
		is_ten_percent_owner, relationship_summary,
		transaction_type, transaction_code, shares_transacted, price_per_share, 
		transaction_value, transaction_date, filing_date,
		shares_owned_after, ownership_change_pct, ownership_pct_company,
		shares_outstanding, public_float, float_impact_pct, market_cap_at_trade, avg_daily_volume,
		is_discretionary, is_compensation_related, is_automatic_trade, is_first_time_buy, is_cluster_trade,
		conviction_score, insider_weight, value_vs_salary_ratio, net_insider_flow_30d, buy_sell_ratio_90d,
		form_type, sec_filing_url, source, ingested_at,
		signal_label, signal_reason, highlight_flag, confidence_badge
	FROM insider_trades
	WHERE ticker = ?
	ORDER BY transaction_date DESC
	LIMIT ?
	`

	rows, err := DB.Query(query, ticker, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trades []InsiderTrade
	for rows.Next() {
		var t InsiderTrade
		err := rows.Scan(
			&t.ID, &t.Ticker, &t.CompanyName, &t.CompanyCIK, &t.Exchange, &t.Industry,
			&t.InsiderName, &t.InsiderCIK, &t.InsiderTitle, &t.IsOfficer, &t.IsDirector,
			&t.IsTenPercentOwner, &t.RelationshipSummary,
			&t.TransactionType, &t.TransactionCode, &t.SharesTransacted, &t.PricePerShare,
			&t.TransactionValue, &t.TransactionDate, &t.FilingDate,
			&t.SharesOwnedAfter, &t.OwnershipChangePct, &t.OwnershipPctCompany,
			&t.SharesOutstanding, &t.PublicFloat, &t.FloatImpactPct, &t.MarketCapAtTrade, &t.AvgDailyVolume,
			&t.IsDiscretionary, &t.IsCompensationRelated, &t.IsAutomaticTrade, &t.IsFirstTimeBuy, &t.IsClusterTrade,
			&t.ConvictionScore, &t.InsiderWeight, &t.ValueVsSalaryRatio, &t.NetInsiderFlow30d, &t.BuySellRatio90d,
			&t.FormType, &t.SecFilingURL, &t.Source, &t.IngestedAt,
			&t.SignalLabel, &t.SignalReason, &t.HighlightFlag, &t.ConfidenceBadge,
		)
		if err != nil {
			return nil, err
		}
		trades = append(trades, t)
	}

	return trades, nil
}

// GetInsiderTradeDetails retrieves a single trade by ID for the modal
func GetInsiderTradeDetails(id int) (*InsiderTrade, error) {
	query := `
	SELECT id, ticker, company_name, company_cik, exchange, industry,
		insider_name, insider_cik, insider_title, is_officer, is_director, 
		is_ten_percent_owner, relationship_summary,
		transaction_type, transaction_code, shares_transacted, price_per_share, 
		transaction_value, transaction_date, filing_date,
		shares_owned_after, ownership_change_pct, ownership_pct_company,
		shares_outstanding, public_float, float_impact_pct, market_cap_at_trade, avg_daily_volume,
		is_discretionary, is_compensation_related, is_automatic_trade, is_first_time_buy, is_cluster_trade,
		conviction_score, insider_weight, value_vs_salary_ratio, net_insider_flow_30d, buy_sell_ratio_90d,
		form_type, sec_filing_url, source, ingested_at,
		signal_label, signal_reason, highlight_flag, confidence_badge
	FROM insider_trades
	WHERE id = ?
	`

	var t InsiderTrade
	err := DB.QueryRow(query, id).Scan(
		&t.ID, &t.Ticker, &t.CompanyName, &t.CompanyCIK, &t.Exchange, &t.Industry,
		&t.InsiderName, &t.InsiderCIK, &t.InsiderTitle, &t.IsOfficer, &t.IsDirector,
		&t.IsTenPercentOwner, &t.RelationshipSummary,
		&t.TransactionType, &t.TransactionCode, &t.SharesTransacted, &t.PricePerShare,
		&t.TransactionValue, &t.TransactionDate, &t.FilingDate,
		&t.SharesOwnedAfter, &t.OwnershipChangePct, &t.OwnershipPctCompany,
		&t.SharesOutstanding, &t.PublicFloat, &t.FloatImpactPct, &t.MarketCapAtTrade, &t.AvgDailyVolume,
		&t.IsDiscretionary, &t.IsCompensationRelated, &t.IsAutomaticTrade, &t.IsFirstTimeBuy, &t.IsClusterTrade,
		&t.ConvictionScore, &t.InsiderWeight, &t.ValueVsSalaryRatio, &t.NetInsiderFlow30d, &t.BuySellRatio90d,
		&t.FormType, &t.SecFilingURL, &t.Source, &t.IngestedAt,
		&t.SignalLabel, &t.SignalReason, &t.HighlightFlag, &t.ConfidenceBadge,
	)

	if err != nil {
		return nil, err
	}

	return &t, nil
}
