import sqlite3
import os

db_path = "../../backend/data/quantify.db"
if not os.path.exists(db_path):
    # try absolute path based on workspace just in case
    db_path = r"c:\Users\hayde\Quantify\Quantify\backend\data\quantify.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(news_articles)")
columns = cursor.fetchall()
for col in columns:
    print(col)
conn.close()
