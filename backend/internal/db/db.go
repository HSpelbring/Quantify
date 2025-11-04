package db

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite" // pure-Go SQLite driver
)

var DB *sql.DB

func InitDB() {
	var err error
	DB, err = sql.Open("sqlite", "./data/quantify.db")
	if err != nil {
		log.Fatalf("Failed to open SQLite DB: %v", err)
	}

	_, err = DB.Exec(`
	CREATE TABLE IF NOT EXISTS watchlist (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		symbol TEXT UNIQUE,
		name TEXT,
		added_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`)
	if err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}

	log.Println("✅ SQLite initialized successfully.")
}
