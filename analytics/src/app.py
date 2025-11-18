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
        hist = ticker.history(period="1d", interval="1m")["Close"]

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
        "^GSPC": ["SPY"],      # SPY = S&P500 intraday source
        "^NDX": ["QQQ"],       # QQQ = NASDAQ100 intraday
        "^DJI": ["DIA"],       # DIA = Dow intraday
        "^RUT": ["^RUT"],      # RUT intraday exists
        "^VIX": ["^VIX"],      # VIX intraday exists
        "BTC-USD": ["BTC-USD"]
    }

    results = {}

    for index_symbol, tickers in fetch_order.items():
        primary = tickers[0]
        print(f"\n-> Fetching {index_symbol} ...")

        try:
            # daily price movement
            hist = yf.Ticker(primary).history(period="2d", interval="1d")
            if len(hist) >= 2:
                latest = hist["Close"].iloc[-1]
                prev = hist["Close"].iloc[-2]
                pct = round(((latest - prev) / prev) * 100, 2)

                # intraday history (REAL sparkline data)
                intra = get_intraday_history(primary)

                results[index_symbol] = {
                    "price": round(float(latest), 2),
                    "change": pct,
                    "history": intra
                }

                print(f"   OK: {primary} = {latest} ({pct}%) with {len(intra)} intraday points")
                continue

        except Exception as e:
            print(f"   ERROR: {e}")

        # fallback:
        print(f"   FALLBACK: {index_symbol} set to 0 / 0")
        results[index_symbol] = {"price": 0, "change": 0, "history": []}

    print("\n=== Final results (fresh) ===")
    print(results)

    QUOTE_CACHE = results
    QUOTE_CACHE_TIME = now
    return results