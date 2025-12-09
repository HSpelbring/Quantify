import yfinance as yf
import traceback

def test_symbol(symbol):
    print(f"\nTesting {symbol}...")
    try:
        ticker = yf.Ticker(symbol)
        
        # Test 1: Daily History
        hist = ticker.history(period="2d", interval="1d")
        print(f"  [Daily] Rows: {len(hist)}")
        if not hist.empty:
            print(f"  [Daily] Last Close: {hist['Close'].iloc[-1]}")
        else:
            print("  [Daily] EMPTY")

        # Test 2: Intraday History
        intra = ticker.history(period="1d", interval="1m")
        print(f"  [Intra] Rows: {len(intra)}")
        if not intra.empty:
            print(f"  [Intra] Last Close: {intra['Close'].iloc[-1]}")
        else:
            print("  [Intra] EMPTY")

    except Exception:
        traceback.print_exc()

symbols = ["SPY", "QQQ", "DIA", "^RUT", "^VIX", "BTC-USD"]
for s in symbols:
    test_symbol(s)
