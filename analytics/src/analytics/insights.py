import yfinance as yf
import random

def get_sector_performance():
    """
    Fetches daily performance for major sector ETFs.
    """
    sectors = {
        "Technology": "XLK",
        "Healthcare": "XLV",
        "Financials": "XLF",
        "Real Estate": "XLRE",
        "Energy": "XLE",
        "Materials": "XLB",
        "Consumer Discretionary": "XLY",
        "Industrials": "XLI",
        "Utilities": "XLU",
        "Consumer Staples": "XLP",
        "Communications": "XLC"
    }
    
    performance = []
    
    print("Fetching sector performance...")
    for name, ticker_symbol in sectors.items():
        try:
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(period="2d")
            
            if len(hist) >= 2:
                close = hist["Close"].iloc[-1]
                prev_close = hist["Close"].iloc[-2]
                change = ((close - prev_close) / prev_close) * 100
                performance.append({
                    "name": name,
                    "change": round(change, 2),
                    "price": round(close, 2)
                })
            else:
                 # Fallback if not enough history (e.g. market closed holiday with delay)
                 performance.append({"name": name, "change": 0.0, "price": 0.0})
        except Exception as e:
            print(f"Error fetching {name} ({ticker_symbol}): {e}")
            performance.append({"name": name, "change": 0.0, "price": 0.0})
            
    # Sort by performance (best to worst)
    performance.sort(key=lambda x: x["change"], reverse=True)
    return performance

def generate_insight():
    """
    Returns aggregated market insights.
    """
    # 1. Sector Performance (Real Data)
    sectors = get_sector_performance()
    
    # 2. Fear & Greed (Mock/Random implementation for visual demo)
    # in real app, fetch from CNN Money or alternative
    fng_score = random.randint(30, 80)
    fng_label = "Neutral"
    if fng_score < 25: fng_label = "Extreme Fear"
    elif fng_score < 45: fng_label = "Fear"
    elif fng_score > 75: fng_label = "Extreme Greed"
    elif fng_score > 55: fng_label = "Greed"
    
    # 3. AI Sentiment & News (Mock/Placeholder)
    news_feed = [
        {"title": "Fed likely to hold rates steady as inflation cools", "source": "Finance Daily", "sentiment": "Bullish", "score": 85},
        {"title": "Tech sector visualizes breakout despite headwinds", "source": "TechWire", "sentiment": "Bullish", "score": 72},
        {"title": "Oil prices dip as global demand forecasts lowered", "source": "Energy News", "sentiment": "Bearish", "score": 40},
        {"title": "Retail spending shows resilience in Q3", "source": "MarketWatch", "sentiment": "Neutral", "score": 55},
        {"title": "Crypto markets volatile ahead of regulatory ruling", "source": "CoinDesk", "sentiment": "Neutral", "score": 50}
    ]
    
    return {
        "sentiment": {
            "score": fng_score,
            "label": fng_label,
            "summary": "AI analysis suggests a cautiously optimistic market outlook. Tech sectors are leading the charge while Energy lags behind."
        },
        "sectors": sectors,
        "news": news_feed
    }
