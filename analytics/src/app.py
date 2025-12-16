
# Last updated: Real News Integration (Fixed Parsing)
from fastapi import FastAPI
from analytics.insights import generate_insight
import yfinance as yf
from fastapi.middleware.cors import CORSMiddleware
import time
import traceback
import requests
import pandas as pd
import io
import os
from datetime import datetime
import random
import re
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Initialize NLTK
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    nltk.download('vader_lexicon')

sia = SentimentIntensityAnalyzer()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# -------------------------------
# QUOTE CACHE (10-second TTL)
# -------------------------------
QUOTE_CACHE = None
QUOTE_CACHE_TIME = 0
CACHE_TTL = 10  # seconds

FINNHUB_KEY = os.getenv("FINNHUB_API_KEY")

def get_intraday_history(symbol: str):
    """
    Returns today's 1-minute close prices as a list of floats.
    Used for sparkline intraday graphs.
    """
    try:
        ticker = yf.Ticker(symbol)
        # Fetch with prepost=True to ensure we can get data up to 16:30
        df = ticker.history(period="1d", interval="1m", prepost=True)

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
        
        hist = df["Close"]

        if hist.empty:
            return []

        hist = hist.fillna(method="ffill")

        # Guarantee conversion to normal Python floats
        return [float(x) for x in hist.tolist()]
    except Exception as e:
        print(f"Intraday history error for {symbol}: {e}")
        return []

def finnhub_quote(symbol: str):
    if not FINNHUB_KEY:
        print("NO FINNHUB API KEY SET")
        return None

    url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_KEY}"
    try:
        r = requests.get(url, timeout=5)
        if r.status_code != 200:
            print(f"Finnhub {symbol} bad status {r.status_code}")
            return None

        data = r.json()
        if data.get("c", 0) <= 0:
            print(f"Finnhub {symbol} invalid data: {data}")
            return None

        return {
            "price": round(float(data["c"]), 2),
            "change": round(float(data["dp"]), 2)
        }
    except Exception as e:
        print(f"Finnhub error for {symbol}: {e}")
        return None

def get_analyst_ratings(ticker, info):
    """
    Helper to extract analyst ratings from yfinance ticker.
    Returns dict with consensus and counts.
    """
    try:
        # Default empty structure
        recs = {
            "consensus": info.get("recommendationKey", "none").replace("_", " ").title(),
            "strongBuy": 0,
            "buy": 0,
            "hold": 0,
            "sell": 0,
            "strongSell": 0
        }
        
        # Try fetching the summary
        summary = ticker.recommendations_summary
        if summary is not None and not summary.empty:
            # Usually the first row (index 0) is the latest "0m" (current month)
            # or it might be aggregated. We take the row with highest total opinions or just first one.
            # `recommendations_summary` columns: period, strongBuy, buy, hold, sell, strongSell
            
            latest = summary.iloc[0]
            recs["strongBuy"] = int(latest.get("strongBuy", 0))
            recs["buy"] = int(latest.get("buy", 0))
            recs["hold"] = int(latest.get("hold", 0))
            recs["sell"] = int(latest.get("sell", 0))
            recs["strongSell"] = int(latest.get("strongSell", 0))
            
        return recs

    except Exception as e:
        print(f"Error fetching analyst ratings: {e}")
        return {
            "consensus": "N/A",
            "strongBuy": 0, "buy": 0, "hold": 0, "sell": 0, "strongSell": 0
        }

@app.get("/insights")
def get_insights():
    data = generate_insight()
    return data

# -------------------------------------------------------------------------
# REAL NEWS FETCHING & TAGGING
# -------------------------------------------------------------------------

# Global Whitelist of Tracked Entities (Stocks & Funds)
# Only articles mentioning these will pass the filter (if strict mode enabled)
KNOWN_ENTITIES = {
    # Tech / Mag 7
    "apple": "AAPL", "aapl": "AAPL",
    "microsoft": "MSFT", "msft": "MSFT",
    "nvidia": "NVDA", "nvda": "NVDA",
    "alphabet": "GOOG", "google": "GOOG", "goog": "GOOG", "googl": "GOOG",
    "amazon": "AMZN", "amzn": "AMZN",
    "meta": "META", "facebook": "META",
    "tesla": "TSLA", "tsla": "TSLA",
    
    # Semi
    "amd": "AMD", 
    "broadcom": "AVGO", 
    "intel": "INTC", "intc": "INTC",
    "micron": "MU", "mu": "MU",
    "tsmc": "TSM",
    
    # Major Funds / Indices
    "spy": "SPY", "s&p 500": "SPY", "sp500": "SPY",
    "qqq": "QQQ", "nasdaq": "QQQ", "ndx": "QQQ",
    "dia": "DIA", "dow jones": "DIA", "dow": "DIA",
    "iwm": "IWM", "russell 2000": "IWM",
    "vix": "VIX",
    
    # Other Blue Chips
    "netflix": "NFLX", "nflx": "NFLX",
    "disney": "DIS", "dis": "DIS",
    "jpmorgan": "JPM", "jpm": "JPM",
    "coca cola": "KO", "ko": "KO",
    "pepsi": "PEP", "pep": "PEP",
    "walmart": "WMT", "wmt": "WMT",
    "costco": "COST", "cost": "COST",
    "dell": "DELL", "uber": "UBER", "oracle": "ORCL"
}

def load_dynamic_tickers():
    """
    Fetches S&P 500 list from Wikipedia to populate the whitelist dynamically.
    Fail-safe: fallbacks to manual list if this fails.
    """
    print("Loading S&P 500 symbols from Wikipedia...")
    try:
        # Wikipedia blocks python-requests/pandas default UA, need browser UA
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        r = requests.get('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies', headers=headers)
        
        # Parse HTML string
        tables = pd.read_html(io.StringIO(r.text))
        df = tables[0] # First table
        
        count = 0
        for _, row in df.iterrows():
            sym = row['Symbol'].replace(".", "-") # BRK.B -> BRK-B standard
            name = str(row['Security'])
            
            # Map Symbol
            KNOWN_ENTITIES[sym.lower()] = sym
            
            # Map Name (Cleaned)
            # Remove legal suffixes to find "Adobe" from "Adobe Inc."
            clean = name.lower()
            for suffix in [" inc.", " corp.", " plc", " co.", " company", " ltd.", " group", " holdings", " trust"]:
                clean = clean.replace(suffix, "")
            
            KNOWN_ENTITIES[clean] = sym
            
            # Heuristic: Map first word if distinct (e.g. "Adobe")
            # Avoid generic words: "General" (General Motors vs General Electric), "Western", "United"
            first = clean.split()[0]
            if len(first) >= 4 and first not in ["american", "united", "general", "national", "first", "northern", "southern", "western", "eastern", "public", "citizens"]:
                if first not in KNOWN_ENTITIES:
                    KNOWN_ENTITIES[first] = sym
            
            count += 1
            
        print(f"Successfully loaded {count} S&P 500 companies into whitelist.")
            
    except Exception as e:
        print(f"Warning: Could not load S&P 500 list (using manual whitelist only). Error: {e}")

# Load immediately on startup (async in bg might be better but this is fast enough)
load_dynamic_tickers()

def auto_tag_news(title: str, summary: str = ""):
    """
    Enhanced keyword-based tagger.
    Scans for Sentiment, Categories, AND Tickers/Company Names.
    """
    text = (title + " " + summary).lower()
    tags = []

    # --- 1. ENTITY EXTRACTION (Global Lookup with Strict Tokens) ---
    found_syms = set()
    
    # Tokenize: Split by non-alphanumeric
    raw_tokens = re.split(r'[^a-zA-Z0-9]+', text) # text is lower here... wait.
    # The function first line is `text = (title + " " + summary).lower()`
    # I need case-sensitive tokens!
    
    # Recover cased text
    full_text_cased = title + " " + summary
    tokens_cased = set(re.split(r'[^a-zA-Z0-9]+', full_text_cased))
    tokens_lower = set(t.lower() for t in tokens_cased)
    
    for key, sym in KNOWN_ENTITIES.items():
        # filter out very common words that might be in S&P 500 names
        # e.g. "Target" -> TGT, "Best" -> BBY, "Gap" -> GPS
        # We manually blacklist them if needed, or rely on lowercase.
        if key in ["target", "best", "gap", "now", "pool", "match", "corp", "inc"]:
             # Require strict connection? or blacklist completely?
             if key == "target" and "tgt" in tokens_lower: found_syms.add(sym)
             continue
             
        # Short Ticker Safety (length <= 2) -> Require UPPERCASE match
        # e.g. "A", "F", "T", "ON", "SO"
        if len(key) <= 2 and key == sym.lower():
             if sym in tokens_cased:
                 # Check if it's not part of a word? Regex split handles that.
                 # " SO " matches. "SO" matches. "ALSO" -> "also" (split).
                 # Main risk: "A" at start of sentence. 
                 # "A stock..." -> "A" is in tokens_cased.
                 # Filter Single Letters?
                 if len(key) == 1:
                     continue # Skip single letter tickers (A, F, T, O, etc) to avoid noise
                 found_syms.add(sym)
        else:
             # Normal Match (Names or Long Tickers)
             if key in tokens_lower:
                 found_syms.add(sym)

    for sym in found_syms:
        tags.append({"label": sym, "category": "Stock"})

    # --- 2. SENTIMENT REASONS (Granular) ---
    # POSITIVE INDICATORS
    if any(x in text for x in ["beat", "surpass", "crush", "topple"]):
        tags.append({"label": "Earnings Beat", "category": "Positive"})
    if any(x in text for x in ["upgrade", "buy rating", "raised price", "outperform"]):
        tags.append({"label": "Analyst Upgrade", "category": "Positive"})
    if any(x in text for x in ["record", "high", "soar", "surge", "jump", "rally", "skyrocket"]):
        tags.append({"label": "Price Surge", "category": "Positive"})
    if any(x in text for x in ["gain", "growth", "climb", "rise", "bull"]):
        tags.append({"label": "Momentum", "category": "Positive"})

    # NEGATIVE INDICATORS
    if any(x in text for x in ["miss", "lag", "short of"]):
        tags.append({"label": "Earnings Miss", "category": "Negative"})
    if any(x in text for x in ["downgrade", "sell rating", "cut price", "underperform"]):
        tags.append({"label": "Analyst Downgrade", "category": "Negative"})
    if any(x in text for x in ["drop", "fall", "plunge", "slide", "crash", "slump", "dive", "low"]):
        tags.append({"label": "Price Drop", "category": "Negative"})
    if any(x in text for x in ["loss", "decline", "weak", "bear", "down"]):
        tags.append({"label": "Decline", "category": "Negative"})

    # -- CORPORATE --
    if any(x in text for x in ["dividend", "buyback", "merger", "acquisition", "acquire", "partnership", "appoint", "ceo", "cfo", "earnings", "quarter"]):
        tags.append({"label": "Corporate Action", "category": "Corporate"})

    # -- LEGAL --
    if any(x in text for x in ["sue", "lawsuit", "settle", "investigation", "probe", "fine", "court", "regulatory", "sec ", "antitrust", "ban"]):
        tags.append({"label": "Legal/Regulatory", "category": "Legal"})

    # -- ANALYST --
    if any(x in text for x in ["analyst", "target", "fitch", "moody", "morgan", "goldman", "upgrade", "downgrade", "estimate"]):
        tags.append({"label": "Analyst Update", "category": "Analyst"})

    # -- SECTOR (Approximation) --
    if any(x in text for x in ["tech", "ai ", "software", "cloud", "chip", "semiconductor", "cyber"]):
        tags.append({"label": "Technology", "category": "Sector"})
    if any(x in text for x in ["oil", "gas", "energy", "solar", "wind", "electric"]):
        tags.append({"label": "Energy", "category": "Sector"})
    if any(x in text for x in ["drug", "pharma", "trial", "fda", "biotech"]):
        tags.append({"label": "Healthcare", "category": "Sector"})
    if any(x in text for x in ["bank", "rate", "fed ", "inflation", "finance", "crypto", "bitcoin"]):
        tags.append({"label": "Finance/Macro", "category": "Sector"})
    if any(x in text for x in ["retail", "consumer", "sales", "spending"]):
        tags.append({"label": "Retail", "category": "Sector"})
    if any(x in text for x in ["auto", "car", "vehicle", "ev "]):
        tags.append({"label": "Automotive", "category": "Sector"})

    # Default if empty
    if not tags:
        tags.append({"label": "General News", "category": "Sector"})

    return tags

def is_relevant_news(title: str) -> bool:
    """
    Returns False if the article is deemed 'junk' or 'noise' (clickbait, personal finance, etc.)
    """
    text = title.lower()
    
    # Allow-list high quality signals regardless of noise? No, filter aggressively first.
    
    noise_keywords = [
        "dave ramsey", "suze orman", "kiyosaki", "rich dad", 
        "motley fool", "zacks", "seeking alpha",
        "emergency fund", "401(k)", "401k", "retirement", 
        "social security", "credit card", "mortgage", "student loan",
        "how to invest", "millionaire", "become rich",
        "shiba inu", "doge", "meme coin", # unless user specifically asked for crypto?
        "top stocks to buy", "prediction", "forecast" # clickbait usually
    ]
    
    if any(n in text for n in noise_keywords):
        return False
        
    return True

@app.get("/news")
def get_market_news(symbols: str = ""):
    """
    Fetch news for a comma-separated list of symbols.
    If empty, fetches general market news via a default list.
    """
    targets = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    
    # Default watch list if none provided
    if not targets:
        targets = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOG", "AMZN", "AMD", "SPY"]
    
    all_news = []
    seen_titles = set()

    for sym in targets:
        try:
            ticker = yf.Ticker(sym)
            raw_news = ticker.news
            
            # Limiting to 5 recent items per ticker to keep response fast but diverse
            for item in raw_news[:5]:
                # Handle nested 'content' structure if present (yfinance update)
                content = item.get("content", item) 
                
                title = content.get("title", item.get("title", ""))
                if title in seen_titles:
                    continue

                # Filter out junk/noise
                if not is_relevant_news(title):
                    continue

                seen_titles.add(title)
                
                # Extract provider/publisher
                # structure varies: might be 'provider': {'displayName': '...'} or just 'publisher' string
                provider = "Yahoo Finance"
                if "provider" in content:
                    prov_data = content["provider"]
                    if isinstance(prov_data, dict):
                        provider = prov_data.get("displayName", "Yahoo Finance")
                    else:
                        provider = str(prov_data)
                elif "publisher" in content:
                    provider = content["publisher"]

                # Extract link (Safe Handling of dict vs string)
                raw_link = content.get("canonicalUrl") or content.get("link") or content.get("clickThroughUrl")
                link = ""
                
                if isinstance(raw_link, dict):
                     link = str(raw_link.get("url", ""))
                elif isinstance(raw_link, str):
                     link = str(raw_link)
                
                # Extract timestamp (Parse pubDate which is ISO string)
                pub_date_str = content.get("pubDate")
                pub_time_raw = 0.0
                display_time = ""

                if pub_date_str:
                    try:
                        # Parse ISO string "2023-12-15T14:30:00Z"
                        # fromisoformat requires +00:00 instead of Z in older python, but safer to replace
                        dt = datetime.fromisoformat(pub_date_str.replace("Z", "+00:00"))
                        pub_time_raw = dt.timestamp()
                        display_time = pub_date_str
                    except Exception as e:
                        print(f"Date parse error: {e}")
                        pub_time_raw = time.time()
                        display_time = datetime.fromtimestamp(pub_time_raw).isoformat()
                else:
                    # Fallback if no pubDate
                    pub_time_raw = item.get("providerPublishTime", time.time())
                    display_time = datetime.fromtimestamp(pub_time_raw).isoformat()


                # Auto-Tagging
                # We NO LONGER blindly add the queried symbol. 
                # Strict Whitelist Mode: Article must explicitly mention a known entity in Title/Text.
                tags = auto_tag_news(title)
                
                # Check if any Stock/Fund was found in the title
                has_tracked_entity = any(t['category'] == 'Stock' for t in tags)
                
                if not has_tracked_entity:
                    # Drop article if it doesn't mention something we care about
                    continue
                
                # If we kept it, we can optionally add the queried 'sym' if it wasn't found but we trust the source?
                # User said "reverse system... if stock... included". Strict is safer.
                # But what if "iPhone sales up" (implies AAPL)? My map has "apple".
                # If I want to be safe, I rely on the map.
                
                # Sentiment Analysis
                sentiment_score = 0.0
                sentiment_label = "Neutral"
                
                try:
                    scores = sia.polarity_scores(title)
                    sentiment_score = scores['compound']
                    if sentiment_score >= 0.05:
                        sentiment_label = "Positive"
                        # De-conflict: Remove Negative tags (e.g. 'Drop') if overall sentiment is mainly Positive
                        tags = [t for t in tags if t['category'] != 'Negative']
                    elif sentiment_score <= -0.05:
                        sentiment_label = "Negative"
                         # De-conflict: Remove Positive tags (e.g. 'Gain') if overall sentiment is mainly Negative
                        tags = [t for t in tags if t['category'] != 'Positive']
                except Exception:
                    pass

                all_news.append({
                    "id": item.get("id", item.get("uuid", str(time.time()))),
                    "title": title,
                    "source": provider,
                    "timestamp": display_time, 
                    "sentimentScore": sentiment_score,
                    "sentimentLabel": sentiment_label,
                    "tags": tags,
                    "link": link
                })
        except Exception as e:
            print(f"Error fetching news for {sym}: {e}")
            continue

    # Sort by Most Recent (ISO strings sort correctly)
    all_news.sort(key=lambda x: x["timestamp"], reverse=True)
    return all_news


@app.get("/price/{symbol}")
def get_price(symbol: str):
    ticker = yf.Ticker(symbol)
    data = ticker.history(period="1d", interval="1m")
    if data.empty:
        return {"error": "No data for symbol."}
    latest = data["Close"].iloc[-1]
    return {"symbol": symbol.upper(), "price": round(float(latest), 2)}


@app.get("/quotes")
def get_quotes():
    global QUOTE_CACHE, QUOTE_CACHE_TIME

    now = time.time()
    if QUOTE_CACHE and (now - QUOTE_CACHE_TIME) < CACHE_TTL:
        print(f"[CACHE] Returning cached results ({int(now - QUOTE_CACHE_TIME)}s old)")
        return QUOTE_CACHE

    print("\n=== Fetching all quotes (fresh) ===")

    fetch_order = {
        "^GSPC": ["^GSPC"],    # S&P 500
        "^NDX": ["^NDX"],      # NASDAQ 100
        "^DJI": ["^DJI"],      # Dow Jones
        "^RUT": ["^RUT"],      # Russell 2000
        "^VIX": ["^VIX"],      # VIX
        "BTC-USD": ["BTC-USD"] # Bitcoin
    }

    results = {}

    for index_symbol, tickers in fetch_order.items():
        primary = tickers[0]
        print(f"\n-> Fetching {index_symbol} ...")

        try:
            # daily price movement
            hist = yf.Ticker(primary).history(period="5d", interval="1d")
            if len(hist) >= 2:
                latest = hist["Close"].iloc[-1]
                prev = hist["Close"].iloc[-2]
                open_price = hist["Open"].iloc[-1]
                pct = round(((latest - prev) / prev) * 100, 2)

                # intraday history (REAL sparkline data)
                intra = get_intraday_history(primary)

                results[index_symbol] = {
                    "price": round(float(latest), 2),
                    "change": pct,
                    "open": round(float(open_price), 2),
                    "history": intra
                }

                print(f"   OK: {primary} = {latest} ({pct}%) with {len(intra)} intraday points")
                continue

        except Exception as e:
            print(f"   ERROR: {e}")

        # fallback:
        print(f"   FALLBACK: {index_symbol} set to 0 / 0")
        results[index_symbol] = {"price": 0, "change": 0, "open": 0, "history": []}

    print("\n=== Final results (fresh) ===")
    print(results)

    QUOTE_CACHE = results
    QUOTE_CACHE_TIME = now
    return results

@app.get("/stock/{symbol}")
def get_stock_details(symbol: str):
    """
    Fetch comprehensive stock details for a given symbol.
    Returns all data needed for the lookup page.
    """
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period="1d")
        
        # Get today's data if available
        today_high = info.get("dayHigh", 0)
        today_low = info.get("dayLow", 0)
        today_open = info.get("open", 0)
        
        # If today's data is missing, try from history
        if not today_high and len(hist) > 0:
            today_high = float(hist["High"].iloc[-1]) if not hist.empty else 0
            today_low = float(hist["Low"].iloc[-1]) if not hist.empty else 0
            today_open = float(hist["Open"].iloc[-1]) if not hist.empty else 0
        
        return {
            "symbol": symbol.upper(),
            "name": info.get("longName", symbol),
            "price": info.get("currentPrice") or info.get("regularMarketPrice", 0),
            "change": info.get("regularMarketChange", 0),
            "changePercent": info.get("regularMarketChangePercent", 0),
            "dayHigh": today_high,
            "dayLow": today_low,
            "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh", 0),
            "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow", 0),
            "marketCap": info.get("marketCap", 0),
            "volume": info.get("volume", 0),
            "averageVolume": info.get("averageVolume", 0),
            "trailingPE": info.get("trailingPE", 0),
            "trailingEps": info.get("trailingEps", 0),
            "open": today_open,
            "previousClose": info.get("previousClose", 0),
            "beta": info.get("beta", 0),
            # Events
            "exDividendDate": info.get("exDividendDate", 0),
            "dividendDate": info.get("dividendDate", 0),
            "earningsTimestamp": info.get("earningsTimestamp", 0),
            "earningsTimestampStart": info.get("earningsTimestampStart", 0),
            "earningsTimestampEnd": info.get("earningsTimestampEnd", 0),
            # Fundamentals
            "revenueGrowth": info.get("revenueGrowth", 0),
            "grossMargins": info.get("grossMargins", 0),
            "totalRevenue": info.get("totalRevenue", 0),
            # Company information
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "fullTimeEmployees": info.get("fullTimeEmployees", 0),
            "description": info.get("longBusinessSummary", "No description available"),
            "website": info.get("website", ""),
            "country": info.get("country", "N/A"),
            "city": info.get("city", "N/A"),
            # Analyst Recommendations
            "recommendations": get_analyst_ratings(ticker, info),
            # Enhanced Events Data
            "splits": get_splits(ticker),
            "shareTrend": get_share_trend(ticker),
            "earningsSurprise": get_earnings_surprise(ticker),
            "nextEarningsDate": get_next_earnings(ticker)
        }
    except Exception as e:
        print(f"Error fetching stock details for {symbol}: {e}")
        traceback.print_exc()
        return {
            "error": str(e),
            "symbol": symbol.upper()
        }

def get_next_earnings(ticker):
    try:
        # Check standard info first (sometimes works)
        # But yf.info earningsTimestamp is often last confirmed.
        
        # Check earnings_dates for future
        ed = ticker.earnings_dates
        if ed is not None and not ed.empty:
            # Future earnings have NaN for Surprise(%)
            future = ed[ed["Surprise(%)"].isna()].sort_index()
            if not future.empty:
                # Get the soonest future date
                return future.index[0].strftime("%Y-%m-%d")
        
        # Fallback to calendar
        cal = ticker.calendar
        if cal is not None and not cal.empty:
            if "Earnings Date" in cal: # cal is sometimes a dict or df
                 # new yfinance returns a dict sometimes with keys "Earnings Date" list
                 dates = cal.get("Earnings Date", [])
                 if dates:
                     # dates is list of datetime.date
                     # filter for future? usually calendar is upcoming.
                     # Just return first
                     return dates[0].strftime("%Y-%m-%d")
            # If dataframe
            if hasattr(cal, "iloc"):
                return cal.iloc[0, 0].strftime("%Y-%m-%d") # Assuming first row/col is date

        return None
    except Exception:
        return None

def get_splits(ticker):
    try:
        splits = ticker.splits
        if splits.empty:
            return None
        # Get last 2 splits
        recent = splits.sort_index(ascending=False).head(2)
        res = []
        for date, ratio in recent.items():
            res.append({
                "date": date.strftime("%Y-%m-%d"),
                "ratio": ratio
            })
        return res
    except Exception:
        return None

def get_share_trend(ticker):
    try:
        bs = ticker.quarterly_balance_sheet
        if bs.empty:
            return None
            
        # Try different keys for share count
        key = "Ordinary Shares Number"
        if key not in bs.index:
            key = "Common Stock Shares Outstanding"
            if key not in bs.index:
                return None
                
        shares = bs.loc[key].sort_index(ascending=False) # Newest first
        if len(shares) < 2:
            return None
            
        current = shares.iloc[0]
        prev = shares.iloc[1]
        
        if prev == 0: return None
        
        change_pct = ((current - prev) / prev) * 100
        trend = "Stable"
        if change_pct < -0.1: trend = "Buyback"
        elif change_pct > 0.1: trend = "Dilution"
        
        return {
            "trend": trend,
            "changePercent": round(change_pct, 2),
            "date": shares.index[0].strftime("%Y-%m-%d")
        }
    except Exception:
        return None

def get_earnings_surprise(ticker):
    try:
        # earnings_dates: index is timestamp, columns: EPS Estimate, Reported EPS, Surprise(%)
        ed = ticker.earnings_dates
        if ed is None or ed.empty:
            return None
            
        # Filter for rows where 'Surprise(%)' is not NaN (i.e., reported)
        # and sort by date descending
        reported = ed[ed["Surprise(%)"].notna()].sort_index(ascending=False)
        
        if reported.empty:
            return None
            
        latest = reported.iloc[0]
        return {
            "surprisePercent": round(latest["Surprise(%)"] * 100, 2), # usually already decimal 0.10 -> 10%? No, yf is usually raw. Debug output said -10.53, so it is percent.
            # wait, debug output: "0.50  -10.53". If actual is 0.50 and est 0.56. (0.50-0.56)/0.56 = -0.107. 
            # So yfinance "Surprise(%)" column is likely ALREADY multiplied by 100? or simpler?
            # Let's trust the debug output matches common user view. "10.49" sounds like %.
            # So I will just pass it through.
            "surprise": round(latest["Surprise(%)"], 2),
            "date": reported.index[0].strftime("%Y-%m-%d")
        }
    except Exception:
        return None

@app.get("/history/{symbol}")
def get_stock_history(symbol: str, range: str = "1mo"):
    """
    Fetch historical data for charting.
    Supports ranges: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y, max
    """
    try:
        # Map frontend timeframe to yfinance period & interval
        # Default to daily
        yf_period = "1mo"
        yf_interval = "1d"
        
        tf = range.upper()
        
        if tf == "1D":
            yf_period = "1d"
            yf_interval = "5m"
        elif tf == "5D":
            yf_period = "5d"
            yf_interval = "30m"
        elif tf == "1M":
            yf_period = "1mo"
            yf_interval = "1d"
        elif tf == "3M":
            yf_period = "3mo"
            yf_interval = "1d"
        elif tf == "6M":
            yf_period = "6mo"
            yf_interval = "1d"
        elif tf == "1Y":
            yf_period = "1y"
            yf_interval = "1d"
        elif tf == "5Y":
            yf_period = "5y"
            yf_interval = "1wk"
        elif tf == "MAX":
            yf_period = "max"
            yf_interval = "1mo"
        
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=yf_period, interval=yf_interval)
        
        if hist.empty:
            return {"error": "No historical data available", "symbol": symbol}
        
        # Convert to list of data points
        data = []
        is_intraday = "m" in yf_interval or "h" in yf_interval

        for index, row in hist.iterrows():
            # Format date based on interval
            date_str = index.strftime("%Y-%m-%d %H:%M") if is_intraday else index.strftime("%Y-%m-%d")
            
            data.append({
                "date": date_str,
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"])
            })
        
        return {
            "symbol": symbol.upper(),
            "range": range,
            "data": data
        }
    except Exception as e:
        print(f"Error fetching history for {symbol}: {e}")
        traceback.print_exc()
        return {
            "error": str(e),
            "symbol": symbol.upper()
        }
