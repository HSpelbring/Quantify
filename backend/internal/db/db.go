package db

import (
	"database/sql"

	_ "modernc.org/sqlite" // pure-Go SQLite driver
)

var DB *sql.DB

func InitDB() error {
	// open database connection
	db, err := sql.Open("sqlite", "data/quantify.db")
	if err != nil {
		return err
	}
	return db.Ping()
}
