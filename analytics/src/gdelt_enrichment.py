import sqlite3
import requests
import os
import time
import re
from bs4 import BeautifulSoup
import traceback

# Path handling
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_REL_PATH = "../../backend/data/quantify.db"
DB_PATH = os.path.join(BASE_DIR, DB_REL_PATH)

GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc"

def get_db_connection():
    if not os.path.exists(DB_PATH):
        # Fallback for absolute path if relative fails (dev env specific)
        alt_path = r"c:\Users\hayde\Quantify\Quantify\backend\data\quantify.db"
        if os.path.exists(alt_path):
            return sqlite3.connect(alt_path)
        raise FileNotFoundError(f"Database not found at {DB_PATH}")
    return sqlite3.connect(DB_PATH)

def clean_text(html_content):
    if not html_content: return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Remove scripts and styles
    for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
        script.decompose()
        
    # Get text
    text = soup.get_text(separator=' ')
    
    # Collapse whitespace
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = '\n'.join(chunk for chunk in chunks if chunk)
    
    return text

def fetch_full_text(url):
    """
    Tries to fetch the URL and extract main text.
    Simple extraction for now.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return None
            
        return clean_text(resp.text)
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def search_gdelt_for_url(title):
    """
    Queries GDELT for the specific title to find a matching URL.
    Returns the URL if found.
    """
    try:
        # Strict quote query
        query = f'"{title}"'
        params = {
            "query": query,
            "mode": "artlist",
            "maxrecords": "1",
            "format": "json"
        }
        r = requests.get(GDELT_API, params=params, timeout=10)
        data = r.json()
        
        if "articles" in data and len(data["articles"]) > 0:
            return data["articles"][0]["url"]
    except Exception as e:
        print(f"GDELT Error for {title}: {e}")
    return None

def enrich_pending_articles(limit=5, tagger_callback=None):
    """
    Finds articles without full content and tries to enrich them.
    Priority:
    1. If existing URL works, scrape it.
    2. If not, ask GDELT for a better URL (deduplication via title).
    
    Limit <= 0 means process ALL pending articles.
    tagger_callback: Optional function(title, content) -> list of tags
    """
    print(f"Starting enrichment cycle (Limit: {limit})...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Select candidates
    # We prioritize Verified/Institutional
    query = """
        SELECT id, title, url, source, article_type 
        FROM news_articles 
        WHERE has_full_content = 0 
        AND source != 'SEC' -- SEC RSS is usually PDF links or specific, handled differently?
        ORDER BY published_at DESC 
    """
    
    if limit > 0:
        query += f" LIMIT {limit}"
        
    cursor.execute(query)
    
    rows = cursor.fetchall()
    print(f"Found {len(rows)} articles to enrich.")
    
    enriched_count = 0
    
    for row in rows:
        article_id, title, url, source, a_type = row
        print(f"Enriching: {title[:50]}...")
        
        full_text = None
        
        # Strategy 1: Try Original URL
        if url:
            # print(f"  -> Fetching original URL: {url[:50]}...")
            full_text = fetch_full_text(url)
            
        # Strategy 2: GDELT Lookup (if original failed or was empty)
        if not full_text or len(full_text) < 500:
            # print("  -> Text too short or failed. Asking GDELT...")
            gdelt_url = search_gdelt_for_url(title)
            if gdelt_url and gdelt_url != url:
                print(f"  -> GDELT found alt URL: {gdelt_url[:50]}...")
                full_text = fetch_full_text(gdelt_url)

        if full_text and len(full_text) > 200:
            # Re-Tag if callback provided
            new_tags_json = None
            if tagger_callback:
                try:
                    # tagging return list of dicts
                    new_tags = tagger_callback(title, content=full_text)
                    if new_tags:
                        new_tags_json = json.dumps(new_tags)
                except Exception as e:
                    print(f"  -> Tagging Error: {e}")

            # Update DB
            try:
                if new_tags_json:
                     cursor.execute("""
                        UPDATE news_articles 
                        SET content = ?, has_full_content = 1, tags = ?
                        WHERE id = ?
                    """, (full_text, new_tags_json, article_id))
                else:
                    cursor.execute("""
                        UPDATE news_articles 
                        SET content = ?, has_full_content = 1
                        WHERE id = ?
                    """, (full_text, article_id))
                
                conn.commit()
                print("  -> Success!")
                enriched_count += 1
            except Exception as e:
                print(f"  -> DB Save Error: {e}")
        else:
            print("  -> Failed to extract meaningful content.")
            
        time.sleep(1) # Be nice to APIs
        
    conn.close()
    return {"status": "complete", "enriched": enriched_count}

if __name__ == "__main__":
    enrich_pending_articles(limit=0)
