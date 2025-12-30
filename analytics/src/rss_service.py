import feedparser
import time
from datetime import datetime
from email.utils import parsedate_to_datetime
from bs4 import BeautifulSoup
import re

# RSS Feeds List
rss_feeds = {
    "Reuters Business": "https://feeds.reuters.com/reuters/businessNews",
    "CNBC Finance": "https://www.cnbc.com/id/10000664/device/rss/rss.html",
    "CNBC Markets": "https://www.cnbc.com/id/10001147/device/rss/rss.html",
    "CNBC Investing": "https://www.cnbc.com/id/15839069/device/rss/rss.html",
    "WSJ Markets": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "Investing.com": "https://www.investing.com/rss/news_25.rss", # General market news
    "MarketWatch Top": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
}

def clean_html(html_text):
    if not html_text:
        return ""
    soup = BeautifulSoup(html_text, 'html.parser')
    return soup.get_text()

def parse_date(date_str):
    if not date_str:
        return time.time()
    try:
        # RFC 822 (standard RSS)
        dt = parsedate_to_datetime(date_str)
        return dt.timestamp()
    except:
        return time.time()

def fetch_rss_news(limit_per_feed=10):
    all_articles = []
    seen_links = set()

    for source_name, url in rss_feeds.items():
        try:
            print(f"Fetching RSS: {source_name}...")
            feed = feedparser.parse(url)
            
            for entry in feed.entries[:limit_per_feed]:
                link = entry.get('link', '')
                if link in seen_links:
                    continue
                seen_links.add(link)

                title = entry.get('title', '')
                summary = clean_html(entry.get('summary', '') or entry.get('description', ''))
                
                # Timestamp
                pub_date = entry.get('published', '') or entry.get('updated', '')
                timestamp = parse_date(pub_date)
                
                # Image extraction (basic)
                image_url = ""
                if 'media_content' in entry:
                    # check for image type
                    for m in entry.media_content:
                        if 'image' in m.get('type', '') or 'jpeg' in m.get('type', '') or 'png' in m.get('type', ''):
                            image_url = m.get('url', '')
                            break
                if not image_url and 'media_thumbnail' in entry:
                    # Some feeds like CNBC use this
                    thumbs = entry.media_thumbnail
                    if isinstance(thumbs, list) and thumbs:
                        image_url = thumbs[0].get('url', '')

                all_articles.append({
                    "title": title,
                    "summary": summary,
                    "link": link,
                    "published_raw": timestamp,
                    "source": source_name,
                    "image": image_url
                })
        except Exception as e:
            print(f"Error fetching {source_name}: {e}")

    # Sort by new
    all_articles.sort(key=lambda x: x['published_raw'], reverse=True)
    return all_articles

if __name__ == "__main__":
    # Test
    news = fetch_rss_news(limit_per_feed=2)
    print(f"Fetched {len(news)} articles.")
    for n in news[:3]:
        print(f"- [{n['source']}] {n['title']} ({datetime.fromtimestamp(n['published_raw'])})")
