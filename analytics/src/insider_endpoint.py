@app.get("/insider/{symbol}")
def get_insider_trading(symbol: str):
    """
    Fetch insider trading data for a stock.
    Returns recent buy/sell transactions by company insiders.
    """
    try:
        print(f"[{symbol}] Fetching insider trading data...")
        t0 = time.time()
        
        ticker = yf.Ticker(symbol)
        
        # Get insider transactions
        insider_transactions = ticker.insider_transactions
        
        if insider_transactions is None or insider_transactions.empty:
            print(f"[{symbol}] No insider trading data available")
            return {
                "symbol": symbol.upper(),
                "transactions": []
            }
        
        # Take most recent 15 transactions
        recent = insider_transactions.head(15)
        
        transactions = []
        for idx, row in recent.iterrows():
            # Safely extract date
            date_val = row.get("Start Date", idx)
            if hasattr(date_val, "strftime"):
                date_str = date_val.strftime("%Y-%m-%d")
            else:
                date_str = str(date_val)
            
            # Determine transaction type
            trans_type = str(row.get("Transaction", "")).upper()
            is_sale = any(x in trans_type for x in ["SALE", "SOLD", "S"])
            
            transactions.append({
                "date": date_str,
                "insider": str(row.get("Insider Trading", "Unknown")),
                "title": str(row.get("Title", "N/A")),
                "transactionType": "Sale" if is_sale else "Purchase",
                "shares": int(row.get("Shares", 0)) if pd.notnull(row.get("Shares")) else 0,
                "price": round(float(row.get("Value", 0)), 2) if pd.notnull(row.get("Value")) else 0,
                "sharesOwned": int(row.get("Shares Owned", 0)) if pd.notnull(row.get("Shares Owned")) else 0
            })
        
        t1 = time.time()
        print(f"[{symbol}] Insider data fetched in {t1-t0:.2f}s ({len(transactions)} transactions)")
        
        return {
            "symbol": symbol.upper(),
            "transactions": transactions
        }
        
    except Exception as e:
        print(f"Error fetching insider data for {symbol}: {e}")
        traceback.print_exc()
        return {
            "symbol": symbol.upper(),
            "transactions": [],
            "error": str(e)
        }
