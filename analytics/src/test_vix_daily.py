
import yfinance as yf
import pandas as pd
import sys

symbol = "^VIX"
print(f"Fetching daily history for {symbol}...")
try:
    hist = yf.Ticker(symbol).history(period="5d", interval="1d")
    print(hist)
    
    if len(hist) >= 2:
        latest = hist["Close"].iloc[-1]
        prev = hist["Close"].iloc[-2]
        open_price = hist["Open"].iloc[-1]
        pct = round(((latest - prev) / prev) * 100, 2)
        print(f"Latest: {latest}, Prev: {prev}, Open: {open_price}, Change: {pct}%")
    else:
        print("Not enough history data")

except Exception as e:
    print(f"Error fetching daily history: {e}")
