import yfinance as yf
import json
import time

def debug_timestamp():
    print("Fetching news for AAPL...")
    try:
        news = yf.Ticker("AAPL").news
        if not news:
            print("No news found")
            return
        
        item = news[0]
        print("\n--- TOP LEVEL KEYS ---")
        print(list(item.keys()))
        
        print("\n--- TIMESTAMP CHECK ---")
        print(f"Top 'providerPublishTime': {item.get('providerPublishTime')}")
        
        if "content" in item:
            content = item["content"]
            print("\n--- CONTENT KEYS ---")
            print(list(content.keys()))
            print(f"Content 'pubDate': {content.get('pubDate')}")
            print(f"Content 'providerPublishTime': {content.get('providerPublishTime')}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_timestamp()
