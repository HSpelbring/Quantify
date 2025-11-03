from fastapi import FastAPI
from analytics.insights import generate_insight
import yfinance as yf

app = FastAPI()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)