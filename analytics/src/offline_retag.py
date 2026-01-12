# Offline Retagger
import sqlite3
import json
import os
import sys

# Ensure we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app import auto_tag_news
except ImportError as e:
    print(f"Error importing app: {e}")
    # Fallback or exit? We need app logic.
    sys.exit(1)

db_path = "../../backend/data/quantify.db"
if not os.path.exists(db_path):
    db_path = r"c:\Users\hayde\Quantify\Quantify\backend\data\quantify.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Fetching ALL articles for retagging...")
# Process ALL articles to ensure we clean up legacy tags even on partial content
cursor.execute("SELECT id, title, content, tags FROM news_articles")
rows = cursor.fetchall()

print(f"Found {len(rows)} articles. Retagging using NEW logic...")
count = 0
for row in rows:
    aid, title, content, old_tags_json = row
    
    # Use the app's comprehensive tagger
    # Handling None content is done inside auto_tag_news, but let's be explicit
    real_content = content if content else ""
    
    # Generate new tags (Overwriting old ones completely)
    try:
        new_tags = auto_tag_news(title, content=real_content)
        
        # Save
        tags_json = json.dumps(new_tags)
        cursor.execute("UPDATE news_articles SET tags = ? WHERE id = ?", (tags_json, aid))
        count += 1
    except Exception as e:
        print(f"Error processing article {aid}: {e}")
    
    if count % 100 == 0:
        print(f"Processed {count}...")
    
conn.commit()
conn.close()
print(f"Done. Retagged {count} articles.")
