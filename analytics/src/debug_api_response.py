import requests
import json

def check_history(symbol, range_val):
    url = f"http://localhost:8000/history/{symbol}?range={range_val}"
    try:
        print(f"Fetching {url}...")
        response = requests.get(url)
        data = response.json()
        
        if "data" in data:
            points = data["data"]
            count = len(points)
            print(f"Symbol: {symbol}, Range: {range_val}")
            print(f"Data Points Returned: {count}")
            if count > 0:
                print("First Point:", points[0])
                print("Last Point:", points[-1])
                # Print first 5 timestamps to check interval
                print("Sample Timestamps:", [p["date"] for p in points[:5]])
            else:
                print("NO DATA POINTS")
        else:
            print("ERROR response:", data)
            
    except Exception as e:
        print(f"Request failed: {e}")

check_history("AAPL", "1D")
check_history("AAPL", "5D")
