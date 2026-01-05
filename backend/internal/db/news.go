package db

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
)

// Article structure matches the Python API response
type Article struct {
	ID             string  `json:"id"`
	Title          string  `json:"title"`
	Source         string  `json:"source"`
	ArticleType    string  `json:"articleType"` // Verified, Institutional, etc.
	Timestamp      string  `json:"timestamp"`   // published_at
	SentimentScore float64 `json:"sentimentScore"`
	SentimentLabel string  `json:"sentimentLabel"`
	Tags           any     `json:"tags"` // JSON array or struct, kept as any for flexible encoding
	Link           string  `json:"link"` // url
	HasFullContent bool    `json:"hasFullContent"`
}

// SaveArticles inserts new articles into the database
func SaveArticles(articles []Article) error {
	tx, err := DB.BeginTx(context.Background(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Ensure article_type column exists (idempotent check not easy here freely, relying on migration or previous Exec)

	stmt, err := tx.Prepare(`
		INSERT INTO news_articles (id, title, source, article_type, url, published_at, sentiment_score, sentiment_label, tags, has_full_content)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			tags = excluded.tags,
			sentiment_score = excluded.sentiment_score,
			sentiment_label = excluded.sentiment_label,
			article_type = excluded.article_type,
			title = excluded.title,
			url = excluded.url,
			has_full_content = excluded.has_full_content
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, a := range articles {
		// Convert Tags to JSON string
		tagsJSON, _ := json.Marshal(a.Tags)

		_, err = stmt.Exec(
			a.ID,
			a.Title,
			a.Source,
			a.ArticleType,
			a.Link,
			a.Timestamp,
			a.SentimentScore,
			a.SentimentLabel,
			string(tagsJSON),
			a.HasFullContent,
		)
		if err != nil {
			log.Printf("Error inserting/updating article %s: %v", a.Title, err)
			continue
		}
	}

	return tx.Commit()
}

// SearchNews searches for articles using FTS5 (full text search)
func SearchNews(query string, limit int) ([]Article, error) {
	if query == "" {
		return nil, fmt.Errorf("empty query")
	}

	// Use FTS5 MATCH operator
	// We join with the main table to get full details (unless using contentless option, but we used external content)
	// Actually, we used content='news_articles', so we query news_fts and it pulls from news_articles.
	// But `SELECT * FROM news_fts WHERE ...` only returns the indexed columns (title, source, tags).
	// We need all columns.
	// Common pattern: SELECT * FROM news_articles WHERE rowid IN (SELECT rowid FROM news_fts WHERE news_fts MATCH ?)

	rows, err := DB.Query(`
		SELECT id, title, source, article_type, url, published_at, sentiment_score, sentiment_label, tags, has_full_content
		FROM news_articles 
		WHERE rowid IN (
			SELECT rowid FROM news_fts WHERE news_fts MATCH ? ORDER BY rank
		)
		LIMIT ?
	`, query, limit)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []Article
	for rows.Next() {
		var a Article
		var tagsStr string
		err := rows.Scan(
			&a.ID,
			&a.Title,
			&a.Source,
			&a.ArticleType,
			&a.Link,
			&a.Timestamp,
			&a.SentimentScore,
			&a.SentimentLabel,
			&tagsStr,
			&a.HasFullContent,
		)
		if err != nil {
			log.Println("Error scanning row:", err)
			continue
		}

		// Unmarshal string tags back to any/interface
		if err := json.Unmarshal([]byte(tagsStr), &a.Tags); err != nil {
			// fallback: empty list
			a.Tags = []interface{}{}
		}
		results = append(results, a)
	}

	return results, nil
}

// GetRecentArticlesBalanced fetches up to quota articles for EACH type to ensure balanced display.
func GetRecentArticlesBalanced(quota int) ([]Article, error) {
	types := []string{"Verified", "Institutional", "Analyst", "Opinionated", "Secondary"}
	var allResults []Article

	for _, t := range types {
		rows, err := DB.Query(`
			SELECT id, title, source, article_type, url, published_at, sentiment_score, sentiment_label, tags, has_full_content
			FROM news_articles
			WHERE article_type = ?
			ORDER BY published_at DESC
			LIMIT ?
		`, t, quota)
		if err != nil {
			log.Printf("Error fetching balanced news for type %s: %v", t, err)
			continue
		}
		defer rows.Close()

		for rows.Next() {
			var a Article
			var tagsStr string
			err := rows.Scan(&a.ID, &a.Title, &a.Source, &a.ArticleType, &a.Link, &a.Timestamp, &a.SentimentScore, &a.SentimentLabel, &tagsStr, &a.HasFullContent)
			if err == nil {
				json.Unmarshal([]byte(tagsStr), &a.Tags)
				allResults = append(allResults, a)
			}
		}
	}
	return allResults, nil
}

// GetArticlesByPage support pagination (limit/offset)
func GetArticlesByPage(limit, offset int) ([]Article, error) {
	rows, err := DB.Query(`
		SELECT id, title, source, article_type, url, published_at, sentiment_score, sentiment_label, tags, has_full_content
		FROM news_articles
		ORDER BY published_at DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []Article
	for rows.Next() {
		var a Article
		var tagsStr string
		err := rows.Scan(&a.ID, &a.Title, &a.Source, &a.ArticleType, &a.Link, &a.Timestamp, &a.SentimentScore, &a.SentimentLabel, &tagsStr, &a.HasFullContent)
		if err == nil {
			json.Unmarshal([]byte(tagsStr), &a.Tags)
			results = append(results, a)
		}
	}
	return results, nil
}

// GetRecentArticles fetches the latest N articles from the DB (kept for compatibility)
func GetRecentArticles(limit int) ([]Article, error) {
	return GetArticlesByPage(limit, 0)
}
