import sqlite3
import os

# Path relative to analytics/src
db_path = "../../backend/data/quantify.db"

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    # try absolute path based on workspace just in case
    db_path = r"c:\Users\hspelbring\Downloads\Quantify\Quantify\backend\data\quantify.db"

if not os.path.exists(db_path):
    print(f"Still not found at {db_path}")
    exit(1)

print(f"Opening DB at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", [t[0] for t in tables])

    # Count articles
    try:
        cursor.execute("SELECT Count(*) FROM news_articles")
        count = cursor.fetchone()[0]
        print(f"Total Articles: {count}")
    except Exception as e:
        print(f"Could not count articles: {e}")

    # Show recent
    print("\n--- Recent Articles ---")
    try:
        cursor.execute("SELECT title, source FROM news_articles ORDER BY created_at DESC LIMIT 5")
        for row in cursor.fetchall():
            print(f"[{row[1]}] {row[0]}")
    except:
        pass

except Exception as e:
    print(f"Error: {e}")
finally:
    if conn: conn.close()
