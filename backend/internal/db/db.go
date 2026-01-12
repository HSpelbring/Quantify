package db

import (
	"database/sql"

	_ "modernc.org/sqlite" // pure-Go SQLite driver
)

var DB *sql.DB

func InitDB() error {
	// open database connection
	var err error // fix scope
	DB, err = sql.Open("sqlite", "data/quantify.db")
	if err != nil {
		return err
	}

	// Create tables
	schema := `
	CREATE TABLE IF NOT EXISTS news_articles (
		id TEXT PRIMARY KEY,
		title TEXT,
		source TEXT,
		article_type TEXT,
		url TEXT,
		published_at TEXT,
		sentiment_score REAL,
		sentiment_label TEXT,
		tags TEXT,
		has_full_content BOOLEAN DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- FTS5 Virtual Table for fast search
	-- Note: modernc.org/sqlite usually supports FTS5. If this fails, we will need to fallback or ignore.
	CREATE VIRTUAL TABLE IF NOT EXISTS news_fts USING fts5(title, source, tags, content='news_articles', content_rowid='rowid');

	-- Trigger to keep FTS in sync o8n INSERT
	CREATE TRIGGER IF NOT EXISTS news_ai AFTER INSERT ON news_articles BEGIN
	  INSERT INTO news_fts(rowid, title, source, tags) VALUES (new.rowid, new.title, new.source, new.tags);
	END;

	-- Trigger to keep FTS in sync on DELETE
	CREATE TRIGGER IF NOT EXISTS news_ad AFTER DELETE ON news_articles BEGIN
	  INSERT INTO news_fts(news_fts, rowid, title, source, tags) VALUES('delete', old.rowid, old.title, old.source, old.tags);
	END;

	-- Trigger to keep FTS in sync on UPDATE
	CREATE TRIGGER IF NOT EXISTS news_au AFTER UPDATE ON news_articles BEGIN
	  INSERT INTO news_fts(news_fts, rowid, title, source, tags) VALUES('delete', old.rowid, old.title, old.source, old.tags);
	  INSERT INTO news_fts(rowid, title, source, tags) VALUES (new.rowid, new.title, new.source, new.tags);
	END;
	`
	_, err = DB.Exec(schema)
	if err != nil {
		// If FTS5 fails, try without FTS (fallback) or return error?
		// For MVP, if FTS fails, we return error so we know.
		return err
	}

	// Initialize insider trades table
	err = InitInsiderTrades(DB)
	if err != nil {
		return err
	}

	// Initialize rules table
	err = InitRules(DB)
	if err != nil {
		return err
	}

	// MIGRATION: Ensure article_type exists for existing databases
	// We ignore the error because if the column exists, it will fail, which is fine.
	_, _ = DB.Exec("ALTER TABLE news_articles ADD COLUMN article_type TEXT")
	_, _ = DB.Exec("ALTER TABLE news_articles ADD COLUMN has_full_content BOOLEAN DEFAULT 0")
	_, _ = DB.Exec("ALTER TABLE news_articles ADD COLUMN content TEXT")

	return DB.Ping()
}
