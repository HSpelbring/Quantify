import yfinance as yf
import json

def debug_news():
    print("Fetching news for GOOG...")
    try:
        news = yf.Ticker("GOOG").news
        if not news:
            print("No news found")
            return
        
        first_item = news[0]
        print("KEYS:", list(first_item.keys()))
        print("TITLE:", first_item.get("title"))
        print("PUBLISHER:", first_item.get("publisher"))
        print("LINK:", first_item.get("link"))
        print("UUID:", first_item.get("uuid"))
        
        # Check if content is nested
        if "content" in first_item:
             print("CONTENT KEYS:", list(first_item["content"].keys()))

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_news()
