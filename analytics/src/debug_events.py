
import yfinance as yf
import pandas as pd

def check_events(symbol):
    print(f"--- Checking {symbol} ---")
    ticker = yf.Ticker(symbol)
    
    # 1. Splits
    print("Splits (last 5):")
    try:
        splits = ticker.splits
        print(splits.tail(5) if not splits.empty else "No splits")
    except Exception as e:
        print(e)
        
    # 2. Earnings & Surprise
    print("\nEarnings Dates (for Surprise):")
    try:
        # earnings_dates usually has 'EPS Estimate' and 'Reported EPS' and 'Surprise(%)'
        ed = ticker.earnings_dates
        if ed is not None and not ed.empty:
            print(ed.head())
        else:
            print("No earnings_dates found")
    except Exception as e:
        print(f"Error fetching earnings_dates: {e}")

    # 3. Share Count (Buybacks/Dilution)
    print("\nShare Count (Balance Sheet - Ordinary Shares Number):")
    try:
        bs = ticker.quarterly_balance_sheet
        if "Ordinary Shares Number" in bs.index:
            shares = bs.loc["Ordinary Shares Number"]
            print(shares.head())
        elif "Common Stock Shares Outstanding" in bs.index:
             shares = bs.loc["Common Stock Shares Outstanding"]
             print(shares.head())
        else:
            print(f"Keys available: {bs.index.tolist()}")
            
    except Exception as e:
        print(f"Error fetching balance sheet: {e}")

if __name__ == "__main__":
    # List of diverse stocks to check for different event types
    tickers = ["NVDA", "TSLA", "AAPL", "AMZN", "GOOGL", "MSFT", "AMD", "META", "GME", "AMC", "PLTR", "COIN"]
    
    print(f"Scanning {len(tickers)} stocks for events...")
    
    for sym in tickers:
        print(f"\n--- {sym} ---")
        try:
            ticker = yf.Ticker(sym)
            
            # Check Splits
            splits = ticker.splits
            if not splits.empty:
                recent = splits.sort_index(ascending=False).head(1)
                # Check if within last 2 years for relevance
                if not recent.empty:
                    print(f"  [SPLIT] Found: {recent.index[0].date()} ratio {recent.iloc[0]}")

            # Check Share Trend
            bs = ticker.quarterly_balance_sheet
            shares = None
            if not bs.empty:
                if "Ordinary Shares Number" in bs.index:
                    shares = bs.loc["Ordinary Shares Number"].sort_index(ascending=False)
                elif "Common Stock Shares Outstanding" in bs.index:
                    shares = bs.loc["Common Stock Shares Outstanding"].sort_index(ascending=False)
            
            if shares is not None and len(shares) >= 2:
                curr = shares.iloc[0]
                prev = shares.iloc[1]
                if prev > 0:
                    chg = ((curr - prev) / prev) * 100
                    if chg < -0.1:
                        print(f"  [BUYBACK] Share count dropped {chg:.2f}%")
                    elif chg > 0.1:
                        print(f"  [DILUTION] Share count rose {chg:.2f}%")

            # Check Earnings Surprise
            ed = ticker.earnings_dates
            if ed is not None and not ed.empty:
                 # Find recent reported with surprise
                 reported = ed[ed["Surprise(%)"].notna()]
                 if not reported.empty:
                     latest = reported.sort_index(ascending=False).iloc[0]
                     print(f"  [EARNINGS SURPRISE] Date: {latest.name.date()} Surprise: {latest['Surprise(%)']:.2f}%")
                 
                 # Check upcoming
                 future = ed[ed["Surprise(%)"].isna()]
                 if not future.empty:
                     next_date = future.sort_index().iloc[0]
                     print(f"  [NEXT EARNINGS] Date: {next_date.name}")

        except Exception as e:
            print(f"  Error: {e}")
