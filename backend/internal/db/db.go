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
		url TEXT,
		published_at TEXT,
		sentiment_score REAL,
		sentiment_label TEXT,
		tags TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- FTS5 Virtual Table for fast search
	-- Note: modernc.org/sqlite usually supports FTS5. If this fails, we will need to fallback or ignore.
	CREATE VIRTUAL TABLE IF NOT EXISTS news_fts USING fts5(title, source, tags, content='news_articles', content_rowid='rowid');

	-- Trigger to keep FTS in sync on INSERT
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

	return DB.Ping()
}
