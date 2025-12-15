import yfinance as yf
import json

def debug_news():
    print("Fetching news for GOOG...")
    # Ticker.news returns a list of dicts
    news = yf.Ticker("GOOG").news
    print(json.dumps(news, indent=2))

if __name__ == "__main__":
    debug_news()
