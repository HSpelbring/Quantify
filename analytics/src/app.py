
from fastapi import FastAPI
from analytics.insights import generate_insight
import yfinance as yf
from fastapi.middleware.cors import CORSMiddleware
import time
import traceback
import requests
import pandas as pd
import io
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# -------------------------------
# QUOTE CACHE (10-second TTL)
# -------------------------------
QUOTE_CACHE = None
QUOTE_CACHE_TIME = 0
CACHE_TTL = 10  # seconds

FINNHUB_KEY = os.getenv("FINNHUB_API_KEY")

def get_intraday_history(symbol: str):
    """
    Returns today's 1-minute close prices as a list of floats.
    Used for sparkline intraday graphs.
    """
    try:
        ticker = yf.Ticker(symbol)
        # Fetch with prepost=True to ensure we can get data up to 16:30
        df = ticker.history(period="1d", interval="1m", prepost=True)

        if df.empty:
            return []

        # Filter for 9:30 AM - 4:30 PM (16:30)
        # The index is a datetime object (localized)
        # We can extract the time component
        
        # Ensure index is datetime
        df.index = pd.to_datetime(df.index)
        
        # Filter strictly 09:30 <= time <= 16:30
        mask = (df.index.time >= pd.Timestamp("09:30").time()) & (df.index.time <= pd.Timestamp("16:30").time())
        df = df[mask]
        
        hist = df["Close"]

        if hist.empty:
            return []

        hist = hist.fillna(method="ffill")

        # Guarantee conversion to normal Python floats
        return [float(x) for x in hist.tolist()]
    except Exception as e:
        print(f"Intraday history error for {symbol}: {e}")
        return []

def finnhub_quote(symbol: str):
    if not FINNHUB_KEY:
        print("NO FINNHUB API KEY SET")
        return None

    url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_KEY}"
    try:
        r = requests.get(url, timeout=5)
        if r.status_code != 200:
            print(f"Finnhub {symbol} bad status {r.status_code}")
            return None

        data = r.json()
        if data.get("c", 0) <= 0:
            print(f"Finnhub {symbol} invalid data: {data}")
            return None

        return {
            "price": round(float(data["c"]), 2),
            "change": round(float(data["dp"]), 2)
        }
    except Exception as e:
        print(f"Finnhub error for {symbol}: {e}")
        return None

@app.get("/analyze")
def analyze():
    data = generate_insight()
    return {"insight": data}


@app.get("/price/{symbol}")
def get_price(symbol: str):
    ticker = yf.Ticker(symbol)
    data = ticker.history(period="1d", interval="1m")
    if data.empty:
        return {"error": "No data for symbol."}
    latest = data["Close"].iloc[-1]
    return {"symbol": symbol.upper(), "price": round(float(latest), 2)}


@app.get("/quotes")
def get_quotes():
    global QUOTE_CACHE, QUOTE_CACHE_TIME

    now = time.time()
    if QUOTE_CACHE and (now - QUOTE_CACHE_TIME) < CACHE_TTL:
        print(f"[CACHE] Returning cached results ({int(now - QUOTE_CACHE_TIME)}s old)")
        return QUOTE_CACHE

    print("\n=== Fetching all quotes (fresh) ===")

    fetch_order = {
        "^GSPC": ["^GSPC"],    # S&P 500
        "^NDX": ["^NDX"],      # NASDAQ 100
        "^DJI": ["^DJI"],      # Dow Jones
        "^RUT": ["^RUT"],      # Russell 2000
        "^VIX": ["^VIX"],      # VIX
        "BTC-USD": ["BTC-USD"] # Bitcoin
    }

    results = {}

    for index_symbol, tickers in fetch_order.items():
        primary = tickers[0]
        print(f"\n-> Fetching {index_symbol} ...")

        try:
            # daily price movement
            hist = yf.Ticker(primary).history(period="5d", interval="1d")
            if len(hist) >= 2:
                latest = hist["Close"].iloc[-1]
                prev = hist["Close"].iloc[-2]
                open_price = hist["Open"].iloc[-1]
                pct = round(((latest - prev) / prev) * 100, 2)

                # intraday history (REAL sparkline data)
                intra = get_intraday_history(primary)

                results[index_symbol] = {
                    "price": round(float(latest), 2),
                    "change": pct,
                    "open": round(float(open_price), 2),
                    "history": intra
                }

                print(f"   OK: {primary} = {latest} ({pct}%) with {len(intra)} intraday points")
                continue

        except Exception as e:
            print(f"   ERROR: {e}")

        # fallback:
        print(f"   FALLBACK: {index_symbol} set to 0 / 0")
        results[index_symbol] = {"price": 0, "change": 0, "open": 0, "history": []}

    print("\n=== Final results (fresh) ===")
    print(results)

    QUOTE_CACHE = results
    QUOTE_CACHE_TIME = now
    return results

@app.get("/stock/{symbol}")
def get_stock_details(symbol: str):
    """
    Fetch comprehensive stock details for a given symbol.
    Returns all data needed for the lookup page.
    """
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period="1d")
        
        # Get today's data if available
        today_high = info.get("dayHigh", 0)
        today_low = info.get("dayLow", 0)
        today_open = info.get("open", 0)
        
        # If today's data is missing, try from history
        if not today_high and len(hist) > 0:
            today_high = float(hist["High"].iloc[-1]) if not hist.empty else 0
            today_low = float(hist["Low"].iloc[-1]) if not hist.empty else 0
            today_open = float(hist["Open"].iloc[-1]) if not hist.empty else 0
        
        return {
            "symbol": symbol.upper(),
            "name": info.get("longName", symbol),
            "price": info.get("currentPrice") or info.get("regularMarketPrice", 0),
            "change": info.get("regularMarketChange", 0),
            "changePercent": info.get("regularMarketChangePercent", 0),
            "dayHigh": today_high,
            "dayLow": today_low,
            "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh", 0),
            "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow", 0),
            "marketCap": info.get("marketCap", 0),
            "volume": info.get("volume", 0),
            "averageVolume": info.get("averageVolume", 0),
            "trailingPE": info.get("trailingPE", 0),
            "trailingEps": info.get("trailingEps", 0),
            "open": today_open,
            "previousClose": info.get("previousClose", 0),
            # Company information
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "fullTimeEmployees": info.get("fullTimeEmployees", 0),
            "description": info.get("longBusinessSummary", "No description available"),
            "website": info.get("website", ""),
            "country": info.get("country", "N/A"),
            "city": info.get("city", "N/A")
        }
    except Exception as e:
        print(f"Error fetching stock details for {symbol}: {e}")
        traceback.print_exc()
        return {
            "error": str(e),
            "symbol": symbol.upper()
        }

@app.get("/history/{symbol}")
def get_stock_history(symbol: str, range: str = "1mo"):
    """
    Fetch historical data for charting.
    Supports ranges: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y, max
    """
    try:
        # Map frontend timeframe to yfinance period & interval
        # Default to daily
        yf_period = "1mo"
        yf_interval = "1d"
        
        tf = range.upper()
        
        if tf == "1D":
            yf_period = "1d"
            yf_interval = "5m"
        elif tf == "5D":
            yf_period = "5d"
            yf_interval = "30m"
        elif tf == "1M":
            yf_period = "1mo"
            yf_interval = "1d"
        elif tf == "3M":
            yf_period = "3mo"
            yf_interval = "1d"
        elif tf == "6M":
            yf_period = "6mo"
            yf_interval = "1d"
        elif tf == "1Y":
            yf_period = "1y"
            yf_interval = "1d"
        elif tf == "5Y":
            yf_period = "5y"
            yf_interval = "1wk"
        elif tf == "MAX":
            yf_period = "max"
            yf_interval = "1mo"
        
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=yf_period, interval=yf_interval)
        
        if hist.empty:
            return {"error": "No historical data available", "symbol": symbol}
        
        # Convert to list of data points
        data = []
        is_intraday = "m" in yf_interval or "h" in yf_interval

        for index, row in hist.iterrows():
            # Format date based on interval
            date_str = index.strftime("%Y-%m-%d %H:%M") if is_intraday else index.strftime("%Y-%m-%d")
            
            data.append({
                "date": date_str,
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"])
            })
        
        return {
            "symbol": symbol.upper(),
            "range": range,
            "data": data
        }
    except Exception as e:
        print(f"Error fetching history for {symbol}: {e}")
        traceback.print_exc()
        return {
            "error": str(e),
            "symbol": symbol.upper()
        }
