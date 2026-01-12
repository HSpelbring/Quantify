import sqlite3
import os
import statistics

db_path = "../../backend/data/quantify.db"
if not os.path.exists(db_path):
    db_path = r"c:\Users\hayde\Quantify\Quantify\backend\data\quantify.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Article Content Statistics ---")
    
    # Get lengths of enriched articles
    cursor.execute("""
        SELECT title, length(content), article_type 
        FROM news_articles 
        WHERE has_full_content = 1 AND content IS NOT NULL
        ORDER BY length(content) DESC
    """)
    
    rows = cursor.fetchall()
    
    if not rows:
        print("No enriched articles found.")
    else:
        lengths = [r[1] for r in rows]
        print(f"Total Enriched Articles: {len(lengths)}")
        print(f"Average Length: {int(statistics.mean(lengths))} chars")
        print(f"Median Length: {int(statistics.median(lengths))} chars")
        print(f"Max Length: {max(lengths)} chars")
        print(f"Min Length: {min(lengths)} chars")

    conn.close()
except Exception as e:
    print(f"Error: {e}")
