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
        "^GSPC": ["^GSPC", "SPY"],
        "^NDX": ["^NDX", "QQQ"],
        "^DJI": ["^DJI", "DIA"],
        "^RUT": ["^RUT"],
        "^VIX": ["^VIX"],
        "BTC-USD": ["BTC-USD"],
    }

    results = {}

    for index_symbol, candidate_list in fetch_order.items():
        print(f"\n-> Fetching {index_symbol} ...")
        success = False

        # === 1. Try yfinance for each candidate ticker ===
        for ticker in candidate_list:
            try:
                hist = yf.Ticker(ticker).history(period="2d", interval="1d")
                if len(hist) >= 2:
                    latest = hist["Close"].iloc[-1]
                    prev = hist["Close"].iloc[-2]
                    pct = round(((latest - prev) / prev) * 100, 2)

                    results[index_symbol] = {
                        "price": round(float(latest), 2),
                        "change": pct,
                    }
                    print(f"   OK: {ticker} = {latest} ({pct}%)")
                    success = True
                    break

            except Exception as e:
                print(f"   ERROR: yfinance failed: {e}")

        if success:
            continue

        # === 2. CSV fallback for primary ticker ===
        primary = candidate_list[0]
        print(f"   Trying CSV fallback for {primary} ...")
        try:
            url = (
                f"https://query1.finance.yahoo.com/v7/finance/download/"
                f"{primary}?period1=0&period2=9999999999&interval=1d&events=history"
            )
            r = requests.get(url, timeout=10)
            if r.status_code == 200 and "Date" in r.text:
                df = pd.read_csv(io.StringIO(r.text))
                if len(df) >= 2:
                    latest = df["Close"].iloc[-1]
                    prev = df["Close"].iloc[-2]
                    pct = round(((latest - prev) / prev) * 100, 2)

                    results[index_symbol] = {
                        "price": round(float(latest), 2),
                        "change": pct,
                    }
                    print(f"   OK CSV: {primary} = {latest} ({pct}%)")
                    continue

            print(f"   CSV FAILED for {primary} status={r.status_code}")

        except Exception as e:
            print(f"   CSV ERROR: {e}")

        # === 3. FINAL GUARANTEED FALLBACK ===
        print(f"   FALLBACK: {index_symbol} set to 0 / 0")
        results[index_symbol] = {"price": 0, "change": 0}

    print("\n=== Final results (fresh) ===")
    print(results)

    # update cache
    QUOTE_CACHE = results
    QUOTE_CACHE_TIME = now

    return results