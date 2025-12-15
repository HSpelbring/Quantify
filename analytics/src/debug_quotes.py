import yfinance as yf
import pandas as pd
import time

def get_intraday_history(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="1d", interval="1m", prepost=True)
        if df.empty: return []
        df.index = pd.to_datetime(df.index)
        mask = (df.index.time >= pd.Timestamp("09:30").time()) & (df.index.time <= pd.Timestamp("16:30").time())
        df = df[mask]
        hist = df["Close"]
        if hist.empty: return []
        hist = hist.fillna(method="ffill")
        return [float(x) for x in hist.tolist()]
    except Exception as e:
        print(f"Intraday error: {e}")
        return []

def get_quotes():
    print("\n=== DEBUG: Fetching quotes ===")
    fetch_order = {
        "^GSPC": ["^GSPC"],
        "^NDX": ["^NDX"]
    }
    
    results = {}
    for index_symbol, tickers in fetch_order.items():
        primary = tickers[0]
        print(f"Fetching {primary}...")
        try:
            hist = yf.Ticker(primary).history(period="5d", interval="1d")
            if len(hist) >= 2:
                latest = hist["Close"].iloc[-1]
                intra = get_intraday_history(primary)
                print(f"SUCCESS: {index_symbol} = {latest}, intraday pts: {len(intra)}")
            else:
                print(f"FAIL: Not enough history for {index_symbol}")
        except Exception as e:
            print(f"EXCEPTION for {index_symbol}: {e}")

if __name__ == "__main__":
    get_quotes()
