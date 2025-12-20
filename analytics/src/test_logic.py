import yfinance as yf
import pandas as pd
import time

def test_fetch(symbol="NVDA", tf="1D"):
    print(f"Testing {symbol} {tf}...")
    try:
        # Defaults from app.py
        yf_period = "2y"
        yf_interval = "1d"
        
        if tf == "1D":
            yf_period = "3d"
            yf_interval = "5m"
        elif tf == "5D":
            yf_period = "1mo"
            yf_interval = "30m"
        # ... others ...

        print(f"Fetching {yf_period} {yf_interval}...")
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=yf_period, interval=yf_interval)
        
        if hist.empty:
            print("EMPTY HIST")
            return

        print(f"Got {len(hist)} rows")
        
        # INDICATORS
        hist["SMA50"] = hist["Close"].rolling(window=50).mean()
        hist["SMA200"] = hist["Close"].rolling(window=200).mean()
        v = hist["Volume"]
        p = (hist["High"] + hist["Low"] + hist["Close"]) / 3
        hist["VWAP"] = (p * v).cumsum() / v.cumsum()
        
        # SLICING
        last_date = hist.index[-1]
        
        if tf == "1D":
             # Robust 1D Slice: Use string comparison
             last_date_str = hist.index[-1].strftime("%Y-%m-%d")
             print(f"Slicing 1D for {last_date_str}")
             hist = hist[hist.index.strftime("%Y-%m-%d") == last_date_str]
             
        # SERIALIZATION
        is_intraday = "m" in yf_interval or "h" in yf_interval
        date_fmt = "%Y-%m-%d %H:%M" if is_intraday else "%Y-%m-%d"
        
        print("Formatting dates...")
        hist["date"] = hist.index.strftime(date_fmt)
        
        print("Rounding...")
        cols_to_round = ["Open", "High", "Low", "Close", "SMA50", "SMA200", "VWAP"]
        for c in cols_to_round:
            if c in hist.columns:
                hist[c] = hist[c].round(2)
        
        print("Renaming...")
        final_cols = ["date", "Open", "High", "Low", "Close", "Volume", "SMA50", "SMA200", "VWAP"]
        output_df = hist[final_cols].copy()
        output_df = output_df.where(pd.notnull(output_df), None)
        output_df.columns = ["date", "open", "high", "low", "close", "volume", "sma50", "sma200", "vwap"]
        
        print("Converting to dict...")
        data = output_df.to_dict(orient="records")
        print(f"Success! {len(data)} points")
        # print(data[0]) 

    except Exception as e:
        print("CRASHED!")
        print(e)
        import traceback
        traceback.print_exc()

test_fetch("NVDA", "1D")
