
import yfinance as yf
import pandas as pd
import sys

def get_intraday_history(symbol: str):
    print(f"Fetching {symbol}...")
    try:
        ticker = yf.Ticker(symbol)
        # Fetch with prepost=True to ensure we can get data up to 16:30
        df = ticker.history(period="1d", interval="1m", prepost=True)
        print(f"Raw data rows: {len(df)}")
        if not df.empty:
            print(df.head())
            print(df.tail())

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
        print(f"Filtered rows: {len(df)}")
        
        hist = df["Close"]

        if hist.empty:
            return []

        hist = hist.fillna(method="ffill")

        # Guarantee conversion to normal Python floats
        return [float(x) for x in hist.tolist()]
    except Exception as e:
        print(f"Intraday history error for {symbol}: {e}")
        return []

res = get_intraday_history("^VIX")
print(f"Result length: {len(res)}")
if len(res) > 0:
    print(res[:5])
