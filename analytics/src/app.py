from fastapi import FastAPI
from analytics.insights import generate_insight
import yfinance as yf
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"])

@app.get("/analyze")
def analyze():
    """Basic endpoint returning a test insight."""
    data = generate_insight()
    return {"insight": data}

@app.get("/price/{symbol}")
def get_price(symbol: str):
    ticker = yf.Ticker(symbol)
    data = ticker.history(period="1d", interval="1m")  # 1-day, 1-min bars
    if data.empty:
        return {"error": "No data for symbol."}
    latest = data["Close"].iloc[-1]
    return {"symbol": symbol.upper(), "price": round(float(latest), 2)}

@app.get("/quotes")
def get_quotes():
    import yfinance as yf
    import pandas as pd
    import traceback
    import requests
    import io

    print("\n=== Fetching all quotes ===")

    # Map index symbols to ETF or direct CSV fallback
    csv_map = {
        "^GSPC": "SPY",
        "^NDX": "QQQ",
        "^DJI": "DIA",
        "^RUT": "^RUT",
        "^VIX": "^VIX",
        "BTC-USD": "BTC-USD"
    }

    results = {}

    for s, yahoo_symbol in csv_map.items():
        try:
            print(f"\n→ Fetching {s} ({yahoo_symbol}) ...")
            hist = yf.Ticker(yahoo_symbol).history(period="2d", interval="1d")

            if len(hist) >= 2:
                latest = hist["Close"].iloc[-1]
                prev = hist["Close"].iloc[-2]
                pct = round(((latest - prev) / prev) * 100, 2)
                results[s] = {"price": round(float(latest), 2), "change": pct}
                print(f"   ✅ Success via yfinance: {s} = {latest} ({pct}%)")
                continue

            # If yfinance failed (too few rows), use Yahoo CSV fallback
            print(f"   ⚠️ yfinance missing for {s}, using direct CSV")
            url = f"https://query1.finance.yahoo.com/v7/finance/download/{yahoo_symbol}?period1=0&period2=9999999999&interval=1d&events=history"
            r = requests.get(url, timeout=10)
            if r.status_code == 200 and "Date" in r.text:
                df = pd.read_csv(io.StringIO(r.text))
                if len(df) >= 2:
                    latest = df["Close"].iloc[-1]
                    prev = df["Close"].iloc[-2]
                    pct = round(((latest - prev) / prev) * 100, 2)
                    results[s] = {"price": round(float(latest), 2), "change": float(pct)}
                    print(f"   ✅ Success via CSV: {s} = {latest} ({pct}%)")
            else:
                print(f"   ❌ CSV fetch failed for {s}: {r.status_code}")

        except Exception as e:
            print(f"   ❌ Error fetching {s}: {e}")
            traceback.print_exc()

    print("\n=== Final results ===")
    print(results)
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)