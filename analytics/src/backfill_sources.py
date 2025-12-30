import sqlite3
import os
from app import classify_source_type

db_path = r"c:\Users\hayde\Quantify\Quantify\backend\data\quantify.db"

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Fetch all articles without a type
    cursor.execute("SELECT id, source, title FROM news_articles WHERE article_type IS NULL OR article_type = ''")
    rows = cursor.fetchall()
    
    print(f"Found {len(rows)} articles to backfill...")
    
    count = 0
    for row in rows:
        article_id, source, title = row
        # Apply strict classification
        new_type = classify_source_type(source, title)
        
        cursor.execute("UPDATE news_articles SET article_type = ? WHERE id = ?", (new_type, article_id))
        count += 1
        
    conn.commit()
    print(f"Successfully backfilled {count} articles.")

except Exception as e:
    print(f"Error backfilling DB: {e}")
    conn.rollback()

conn.close()
