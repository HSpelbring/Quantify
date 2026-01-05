import feedparser
import time
import json
import os
import hashlib
from datetime import datetime
from email.utils import parsedate_to_datetime
from bs4 import BeautifulSoup

# AUTHORITATIVE SOURCE REGISTRY
RSS_REGISTRY = {
    "Reuters": {
        "category": "Institutional",
        "article_type": "Institutional",
        "feeds": [
            "https://feeds.reuters.com/reuters/businessNews",
            "https://feeds.reuters.com/reuters/marketsNews",
            "https://feeds.reuters.com/reuters/companyNews",
            "https://feeds.reuters.com/reuters/technologyNews"
        ]
    },
    "SEC": {
        "category": "Verified",
        "article_type": "Verified",
        "feeds": [
            "https://www.sec.gov/rss/news/press.xml",
            "https://www.sec.gov/rss/litigation/litreleases.xml",
            "https://www.sec.gov/rss/enforcement.xml"
        ]
    }
}

CACHE_FILE = os.path.join(os.path.dirname(__file__), "rss_cache.json")
USER_AGENT = "QuantifyRSSBot/1.0 (contact: internal)"

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_cache(cache):
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=4)
    except Exception as e:
        print(f"Error saving RSS cache: {e}")

def clean_html(html_text):
    if not html_text:
        return ""
    soup = BeautifulSoup(html_text, 'html.parser')
    return soup.get_text().strip()

def parse_date(date_str):
    if not date_str:
        return time.time()
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.timestamp()
    except:
        return time.time()

def fetch_rss_news(limit_per_feed=10):
    all_articles = []
    seen_ids = set()
    cache = load_cache()
    
    for source_name, config in RSS_REGISTRY.items():
        category = config["category"]
        article_type = config["article_type"]
        
        for url in config["feeds"]:
            try:
                print(f"Polling {source_name}: {url}...")
                
                # Get cache headers
                feed_cache = cache.get(url, {})
                etag = feed_cache.get("etag")
                modified = feed_cache.get("modified")
                
                # Parse with headers and specific user agent
                feed = feedparser.parse(url, etag=etag, modified=modified, agent=USER_AGENT)
                
                # Check status
                if hasattr(feed, 'status'):
                    if feed.status == 304:
                        print(f"  -> No changes (304) for {url}")
                        continue
                
                # Update cache
                cache[url] = {
                    "etag": getattr(feed, 'etag', None),
                    "modified": getattr(feed, 'modified', None),
                    "last_fetch": datetime.now().isoformat()
                }

                for entry in feed.entries[:limit_per_feed]:
                    link = entry.get('link', '')
                    if not link:
                        continue
                        
                    # DEDUPLICATION BY URL HASH
                    # Required format: hash(source + url)
                    article_id = hashlib.md5(f"{source_name}{link}".encode("utf-8")).hexdigest()
                    
                    if article_id in seen_ids:
                        continue
                    seen_ids.add(article_id)

                    title = entry.get('title', '')
                    summary = clean_html(entry.get('summary', '') or entry.get('description', ''))
                    
                    # Timestamp
                    pub_date = entry.get('published', '') or entry.get('updated', '')
                    timestamp = parse_date(pub_date)
                    
                    # Image extraction
                    image_url = ""
                    if 'media_content' in entry:
                        for m in entry.media_content:
                            if 'image' in m.get('type', '') or 'jpeg' in m.get('type', '') or 'png' in m.get('type', ''):
                                image_url = m.get('url', '')
                                break
                    if not image_url and 'media_thumbnail' in entry:
                        thumbs = entry.media_thumbnail
                        if isinstance(thumbs, list) and thumbs:
                            image_url = thumbs[0].get('url', '')

                    all_articles.append({
                        "id": article_id,
                        "title": title,
                        "summary": summary,
                        "link": link,
                        "published_raw": timestamp,
                        "source": source_name,
                        "source_category": category,
                        "articleType": article_type, # Using articleType for frontend compatibility
                        "image": image_url,
                        "ingested_at": datetime.now().isoformat()
                    })
            except Exception as e:
                print(f"Error fetching {url}: {e}")

    save_cache(cache)
    
    # Sort by new
    all_articles.sort(key=lambda x: x['published_raw'], reverse=True)
    return all_articles

if __name__ == "__main__":
    # Test
    news = fetch_rss_news(limit_per_feed=2)
    print(f"Fetched {len(news)} articles.")
    for n in news[:5]:
        print(f"- [{n['source']} | {n['articleType']}] {n['title']} ({datetime.fromtimestamp(n['published_raw'])})")
        print(f"  ID: {n['id']}")
