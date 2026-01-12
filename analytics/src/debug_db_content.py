import sqlite3
import os

db_path = "../../backend/data/quantify.db"
if not os.path.exists(db_path):
    db_path = r"c:\Users\hayde\Quantify\Quantify\backend\data\quantify.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Article Counts by Type ---")
    cursor.execute("SELECT article_type, COUNT(*), SUM(has_full_content) FROM news_articles GROUP BY article_type")
    for row in cursor.fetchall():
        print(f"Type: {row[0]} | Total: {row[1]} | Has Full Content: {row[2]}")
        
    print("\n--- Recent Articles (Top 10) ---")
    cursor.execute("SELECT id, title, article_type, has_full_content FROM news_articles ORDER BY published_at DESC LIMIT 10")
    for row in cursor.fetchall():
        print(row)

    conn.close()
except Exception as e:
    print(f"Error: {e}")
