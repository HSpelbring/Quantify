
import yfinance as yf
import pandas as pd

symbol = "AAPL"
ticker = yf.Ticker(symbol)

print(f"--- Info for {symbol} ---")
info = ticker.info
print(f"recommendationKey: {info.get('recommendationKey')}")
print(f"numberOfAnalystOpinions: {info.get('numberOfAnalystOpinions')}")

print("\n--- Recommendations Summary ---")
try:
    rec_summary = ticker.recommendations_summary
    if rec_summary is not None and not rec_summary.empty:
        print(rec_summary)
    else:
        print("No recommendations_summary found.")
except Exception as e:
    print(f"Error fetching recommendations_summary: {e}")

print("\n--- Recommendations (Historical) ---")
try:
    recs = ticker.recommendations
    if recs is not None and not recs.empty:
        print(recs.tail())
    else:
        print("No recommendations found.")
except Exception as e:
    print(f"Error fetching recommendations: {e}")
