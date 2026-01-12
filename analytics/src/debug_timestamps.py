import sqlite3
import os

db_path = "../../backend/data/quantify.db"
if not os.path.exists(db_path):
    db_path = r"c:\Users\hayde\Quantify\Quantify\backend\data\quantify.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Recent Articles with Timestamps ---")
    cursor.execute("SELECT title, article_type, has_full_content, published_at FROM news_articles ORDER BY published_at DESC LIMIT 10")
    for row in cursor.fetchall():
        print(f"[{row[3]}] {row[1]} (Content: {row[2]}) - {row[0][:30]}...")

    conn.close()
except Exception as e:
    print(f"Error: {e}")
