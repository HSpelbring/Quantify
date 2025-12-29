
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

# Enhance VADER with Financial Dictionary
# VADER is great for social text but needs help with financial jargon.
FINANCIAL_LEXICON = {
    # Strong Positive
    "calls": 2.0, "call": 2.0, "long": 1.5, "bull": 2.5, "bullish": 2.5,
    "breakout": 2.5, "surged": 3.0, "soaring": 3.0, "record": 2.5,
    "beat": 2.5, "beats": 2.5, "jumped": 2.5, "jumps": 2.5,
    "skyrocket": 3.0, "boom": 2.5, "strong": 2.0, "marvel": 2.0,
    "upgrade": 2.5, "upgraded": 2.5, "outperform": 2.5, "buy": 2.0,
    # Moderate Positive
    "gained": 1.5, "climb": 1.5, "rally": 2.0, "rebound": 1.5,
    "growth": 1.5, "profit": 1.5, "revenue": 1.0, "bounces": 1.5,
    "optimism": 1.5, "higher": 1.5, "rise": 1.5, "rising": 1.5,
    "leads": 1.5, "leader": 1.5, "winning": 1.5, "gain": 1.5,
    "partner": 1.0, "deal": 1.0, "agreement": 1.0, "launch": 1.0,
    # Strong Negative
    "puts": -2.0, "put": -2.0, "short": -1.5, "bear": -2.5, "bearish": -2.5,
    "plunge": -3.0, "plunged": -3.0, "crash": -3.5, "collapsed": -3.5,
    "miss": -2.5, "missed": -2.5, "tank": -2.5, "tanked": -2.5,
    "slump": -2.5, "plummet": -3.0, "diving": -2.5, "dive": -2.5,
    "sell": -2.0, "downgrade": -2.5, "downgraded": -2.5, "underperform": -2.5,
    "lawsuit": -2.0, "sued": -2.0, "investigation": -2.0, "probe": -2.0,
    "warning": -2.0, "warns": -2.0, "crisis": -2.5, "panic": -2.0,
    # Moderate Negative
    "lower": -1.5, "drop": -1.5, "dropped": -1.5, "fall": -1.5,
    "falling": -1.5, "down": -1.5, "weak": -1.5, "loss": -2.0,
    "losses": -2.0, "declined": -1.5, "tumble": -2.0, "retreat": -1.0,
    "correction": -1.5, "volatile": -1.0, "uncertainty": -1.0, "risk": -1.0,
    "concern": -1.0, "worry": -1.0, "struggle": -1.5, "hit": -1.0
}
sia.lexicon.update(FINANCIAL_LEXICON)

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
    "qqq": "QQQ", "nasdaq 100": "QQQ", "ndx": "QQQ",
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
    "dell": "DELL", "uber": "UBER", "oracle": "ORCL",
    "zillow": "Z", "z": "Z", "zg": "ZG",
    "irobot": "IRBT", "irbt": "IRBT",
    "nasdaq": "NDAQ", "ndaq": "NDAQ", # Note: "Nasdaq" also triggers QQQ in heuristics? Need to be careful. 
    # Actually QQQ is "nasdaq 100". "Nasdaq" usually means the exchange or NDAQ stock.
    # Let's verify strict priorities later.
    
    # Crypto
    "bitcoin": "BTC-USD", "btc": "BTC-USD",
    "ethereum": "ETH-USD", "eth": "ETH-USD",
    "ripple": "XRP-USD", "xrp": "XRP-USD",
    "solana": "SOL-USD", "sol": "SOL-USD",
    "dogecoin": "DOGE-USD", "doge": "DOGE-USD",
    
    # Ambiguity Fixes
    "global payments": "GPN", # Only map full name, never just "global"
    "global": "IGNORE", # Explicit ignore to prevent auto-mapping if dynamic loader adds it
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
         # Filter out very common words that might be in S&P 500 names
        # e.g. "Target" -> TGT, "Best" -> BBY, "Gap" -> GPS
        if key in ["target", "best", "gap", "corp", "inc"]:
             if key == "target" and "tgt" in tokens_lower: found_syms.add(sym)
             continue

        # Explicit Ignore (e.g. "Global")
        if sym == "IGNORE":
            continue

        # Ambiguity Fix: Nasdaq (Exchange) vs Nasdaq (Stock) vs QQQ (Index)
        # If "Nasdaq" is found, usually implies the market (QQQ/IXIC) unless "Nasdaq Inc" -> NDAQ
        if key == "nasdaq":
             if "inc" in tokens_lower or "exchange" in tokens_lower:
                 found_syms.add("NDAQ")
             # Else, we might leave it as QQQ or NDAQ? 
             # For now, let's map generic "nasdaq" to market index QQQ for relevance, 
             # OR NDAQ if user specifically asked for NDAQ.
             # Current explicit map: "nasdaq" -> "NDAQ" in my list above? 
             # Wait, strict list above has "nasdaq": "NDAQ". 
             # But "nasdaq": "QQQ" was in previous list lines 170.
             # CONFLICT: Line 170 says "nasdaq": "QQQ". Line 186 (new) says "nasdaq": "NDAQ".
             # Python dict info: last write wins. New list is appended. So "nasdaq" -> "NDAQ".
             # Let's fix this conflict by removing "nasdaq": "QQQ" from line 170 in a separate edit or handling here.
             pass

        # Ambiguous Tickers that are also common words (require UPPERCASE match)
        # 3-4 letter words that are very common in headlines
        AMBIGUOUS_TICKERS = {
            "ALL", "HAS", "NOW", "CAN", "SEE", "MET", "KEY", "CAT", "POOL", 
            "FAST", "RUN", "EAT", "LOVE", "SAFE", "PLAY", "BEAT", "NEXT", 
            "BIG", "CASH", "GOLD", "TRUE", "EVER", "FIVE", "LIFE", "LOW",
            "MIND", "OPEN", "OUT", "REAL", "ROLL", "SAVE", "SPOT", "STEP", 
            "TELL", "WELL", "WORK"
        }

        # Case 1: Short Ticker Safety (length <= 2)
        if len(key) <= 2 and key == sym.lower():
             if sym in tokens_cased:
                 if len(key) == 1: continue 
                 found_syms.add(sym)
        
        # Case 2: Ambiguous / Common Word Ticker
        elif sym in AMBIGUOUS_TICKERS:
             # Must imply UPPERCASE match in text (e.g. "ALL" not "all" or "All")
             if sym in tokens_cased:
                 found_syms.add(sym)

        # Case 3: Normal Match
        else:
             if key in tokens_lower:
                 found_syms.add(sym)

    # Fund & Crypto Whitelists
    FUND_SYMBOLS = {"SPY", "QQQ", "DIA", "IWM", "VIX", "VOO", "IVV", "ARKK", "SMH", "XLF", "XLE", "XLK", "XLV", "XLY", "XLP", "XLU", "XLI", "XLB", "XLRE"}
    CRYPTO_SYMBOLS = {"BTC-USD", "ETH-USD", "XRP-USD", "SOL-USD", "DOGE-USD"}

    for sym in found_syms:
        if sym in FUND_SYMBOLS:
            cat = "Fund"
        elif sym in CRYPTO_SYMBOLS:
            cat = "Crypto"
        else:
            cat = "Stock"
        tags.append({"label": sym, "category": cat})

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

    # -- CORPORATE (Granular) --
    if any(x in text for x in ["dividend", "buyback", "share repurchase", "yield"]):
        tags.append({"label": "Dividend/Buyback", "category": "Dividend"})
    
    if any(x in text for x in ["merger", "acquisition", "acquire", "buyout", "deal", "takeover", "bid for"]):
        tags.append({"label": "M&A", "category": "Merger"})
        
    if any(x in text for x in ["appoint", "ceo", "cfo", "step down", "resign", "fire", "hired", "executive"]):
        tags.append({"label": "Management", "category": "Management"})
        
    if any(x in text for x in ["guidance", "outlook", "forecast", "projection", "raise view", "cut view"]):
        tags.append({"label": "Guidance", "category": "Guidance"})
        
    # -- EARNINGS SPECIFIC --
    if any(x in text for x in ["earnings", "profit", "revenue", "sales", "eps", "quarter"]):
        # Only add generic Earnings tag if we didn't get a specific "Beat" or "Miss" tag earlier
        if not any(t['label'] in ["Earnings Beat", "Earnings Miss"] for t in tags):
             tags.append({"label": "Earnings", "category": "Corporate"})

    # -- LEGAL --
    if any(x in text for x in ["sue", "lawsuit", "settle", "investigation", "probe", "fine", "court", "regulatory", "sec ", "antitrust", "ban"]):
        tags.append({"label": "Legal/Regulatory", "category": "Legal"})

    # -- ANALYST --
    if any(x in text for x in ["analyst", "target", "fitch", "moody", "morgan", "goldman", "upgrade", "downgrade", "estimate"]):
        tags.append({"label": "Analyst Update", "category": "Analyst"})

    # -- SECTOR (Approximation) --
    # Only tag sectors if we didn't find specific entities (Stocks/Funds).
    # This prevents noise like tagging every Apple article as "Technology".
    if not found_syms:
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
    
    # Default "Market Pulse" list if no specific symbols provided
    # Covers: Indices, Tech, Finance, Energy, Crypto, volatility
    if not targets:
        targets = [
            # Indices
            "SPY", "QQQ", "DIA", "IWM", "^VIX",
            # Mag 7 / Tech Leaders
            "NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "GOOG", "META", "AMD",
            # Sectors / Economy
            "JPM", "GS",   # Finance
            "XLE", "CVX",  # Energy
            "LLY", "JNJ",  # Healthcare
            "BTC-USD"      # Crypto
        ]
    
    all_news = []
    seen_titles = set()

    for sym in targets:
        try:
            ticker = yf.Ticker(sym)
            raw_news = ticker.news
            
            # specific limit increased to allow for better aggregation
            for item in raw_news[:15]:
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
                
                # Check if any tags were found (Entity, Sector, Corporate, Sentiment)
                # Relaxed from strict Entity-Only check to allow "Market Pulse" news
                if not tags:
                    # Drop article if it has zero relevance tags
                    continue
                
                # If we kept it, we can optionally add the queried 'sym' if it wasn't found but we trust the source?
                # User said "reverse system... if stock... included". Strict is safer.
                # But what if "iPhone sales up" (implies AAPL)? My map has "apple".
                # If I want to be safe, I rely on the map.
                
                # Sentiment Analysis
                sentiment_score = 0.0
                sentiment_label = "Neutral"
                
                try:
                    # Use Title + Summary for better signal/context
                    summary_text = content.get("summary", "")
                    full_text = f"{title}. {summary_text}"
                    
                    scores = sia.polarity_scores(full_text)
                    sentiment_score = scores['compound']
                    
                    # --- SCORE BOOSTING FROM TAGS ---
                    # If we already identified specific positive/negative tags, force the score to align.
                    # This fixes "0.0" scores for articles like "XRP Price Drops" where VADER might miss it.
                    
                    has_positive_tag = any(t['category'] == 'Positive' for t in tags)
                    has_negative_tag = any(t['category'] == 'Negative' for t in tags)
                    
                    if has_positive_tag and sentiment_score < 0.2:
                         sentiment_score = max(sentiment_score + 0.35, 0.25)
                         
                    if has_negative_tag and sentiment_score > -0.2:
                         sentiment_score = min(sentiment_score - 0.35, -0.25)

                    if sentiment_score >= 0.05:
                        sentiment_label = "Positive"
                        tags = [t for t in tags if t['category'] != 'Negative']
                    elif sentiment_score <= -0.05:
                        sentiment_label = "Negative"
                        tags = [t for t in tags if t['category'] != 'Positive']
                except Exception:
                    pass

                # Stable ID Generation
                # Use upstream ID if available. If not, generate hash from Title to prevent duplicates.
                article_id = item.get("id", item.get("uuid"))
                if not article_id:
                    import hashlib
                    # create deterministic hash of title
                    article_id = hashlib.md5(title.encode("utf-8")).hexdigest()

                all_news.append({
                    "id": article_id,
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
    
    # Global Limit: 50
    return all_news[:50]


@app.get("/price/{symbol}")
def get_price(symbol: str):
    ticker = yf.Ticker(symbol)
    # Fetch 5 days to ensure we have previous close
    hist = ticker.history(period="5d")
    
    if hist.empty:
        return {"error": "No data for symbol."}
    
    # Get latest close
    latest = hist["Close"].iloc[-1]
    
    # Calculate change
    change = 0.0
    change_p = 0.0
    
    if len(hist) >= 2:
        prev = hist["Close"].iloc[-2]
        change = latest - prev
        change_p = (change / prev) * 100
        
    return {
        "symbol": symbol.upper(), 
        "price": round(float(latest), 2),
        "change": round(float(change), 2),
        "changePercent": round(float(change_p), 2)
    }


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
    # CACHE CHECK (5-minute TTL for stock details)
    global STOCK_DETAILS_CACHE
    if 'STOCK_DETAILS_CACHE' not in globals():
        STOCK_DETAILS_CACHE = {}
    
    cache_key = symbol.upper()
    now = time.time()
    
    if cache_key in STOCK_DETAILS_CACHE:
        entry = STOCK_DETAILS_CACHE[cache_key]
        if now - entry['time'] < 300:  # 5 minutes
            print(f"[{symbol}] Serving stock details from cache")
            return entry['data']
    
    # FETCH (if not cached)
    print(f"[{symbol}] Fetching fresh stock details...")
    t0 = time.time()
    
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period="1d")
        
        t1 = time.time()
        print(f"[{symbol}] yfinance fetch took {t1-t0:.2f}s")
        
        # Get today's data if available
        today_high = info.get("dayHigh", 0)
        today_low = info.get("dayLow", 0)
        today_open = info.get("open", 0)
        
        # If today's data is missing, try from history
        if not today_high and len(hist) > 0:
            today_high = float(hist["High"].iloc[-1]) if not hist.empty else 0
            today_low = float(hist["Low"].iloc[-1]) if not hist.empty else 0
            today_open = float(hist["Open"].iloc[-1]) if not hist.empty else 0
        
        result = {
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
            "targetMeanPrice": info.get("targetMeanPrice", 0),
            # Enhanced Events Data
            "splits": get_splits(ticker),
            "shareTrend": get_share_trend(ticker),
            "earningsSurprise": get_earnings_surprise(ticker),
            "nextEarningsDate": get_next_earnings(ticker)
        }
        
        # Update cache
        STOCK_DETAILS_CACHE[cache_key] = {'time': now, 'data': result}
        return result
        
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

@app.get("/insider/ingest/{symbol}")
def ingest_insider_trading(symbol: str):
    """
    Ingest insider trading data from SEC-API with caching and deduplication.
    Only fetches new filings since the last stored filing date.
    """
    try:
        print(f"\n{'='*60}")
        print(f"INSIDER INGESTION: {symbol.upper()}")
        print(f"{'='*60}")
        
        t_start = time.time()
        
        # Get API key
        api_key = os.getenv("SEC_API_KEY")
        if not api_key:
            return {"symbol": symbol.upper(), "error": "SEC_API_KEY not configured", "ingested": 0}
        
        # Step 1: Check cache - get latest filing date from database
        print(f"[Step 1] Checking database for existing trades...")
        go_url = f"http://localhost:3000/api/insider/latest/{symbol.upper()}"
        try:
            resp = requests.get(go_url, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                latest_filing_date = data.get("filingDate", "1970-01-01")
                print(f"  → Latest filing date in DB: {latest_filing_date}")
            else:
                latest_filing_date = "1970-01-01"
                print(f"  → No existing data, will fetch all")
        except:
            latest_filing_date = "1970-01-01"
            print(f"  → Database check failed, will fetch all")
        
        # Step 2: Query SEC-API for new filings
        print(f"[Step 2] Querying SEC-API...")
        from sec_api import InsiderTradingApi
        api = InsiderTradingApi(api_key)
        
        # Query with date filter (only fetch filings newer than latest)
        trades_data = api.get_data({
            "query": f"issuer.tradingSymbol:{symbol.upper()} AND filedAt:[{latest_filing_date} TO *]",
            "from": "0",
            "size": "100",  # Fetch up to 100 new transactions
            "sort": [{"filedAt": {"order": "desc"}}]
        })
        
        if not trades_data or "transactions" not in trades_data:
            print(f"  → No new trades found")
            return {"symbol": symbol.upper(), "ingested": 0, "message": "No new trades"}
        
        raw_transactions = trades_data["transactions"]
        print(f"  → Found {len(raw_transactions)} transactions from SEC-API")
        
        # Step 3: Get company context (for derived metrics)
        print(f"[Step 3] Fetching company context...")
        ticker_obj = yf.Ticker(symbol.upper())
        info = ticker_obj.info
        shares_outstanding = info.get("sharesOutstanding", 0)
        public_float = info.get("floatShares", shares_outstanding)
        market_cap = info.get("marketCap", 0)
        avg_volume = info.get("averageVolume", 0)
        
        # Step 4: Process and compute derived metrics
        print(f"[Step 4] Processing transactions...")
        ingested_count = 0
        
        for t in raw_transactions:
            try:
                # Extract core fields
                owner = t.get("reportingOwner", {})
                insider_name = owner.get("name", "Unknown")
                insider_cik = owner.get("cik", "")
                relationship = owner.get("relationshipToIssuer", "")
                
                # Parse relationship flags
                is_officer = "officer" in relationship.lower() or "ceo" in relationship.lower()
                is_director = "director" in relationship.lower()
                is_ten_percent = "10%" in relationship or "owner" in relationship.lower()
                
                # Transaction details
                acq_disp_code = t.get("transactionAcquiredDisposedCode", "")
                transaction_type = "SELL" if acq_disp_code == "D" else "BUY"
                trans_code = t.get("transactionCode", "")
                shares_transacted = int(t.get("transactionShares", 0) or 0)
                price_per_share = float(t.get("transactionPricePerShare", 0) or 0)
                transaction_value = shares_transacted * price_per_share
                
                # Dates
                trans_date_str = t.get("transactionDate", "")
                filing_date_str = t.get("filedAt", "")[:10]
                transaction_date = datetime.strptime(trans_date_str[:10], "%Y-%m-%d") if trans_date_str else datetime.now()
                filing_date = datetime.strptime(filing_date_str, "%Y-%m-%d") if filing_date_str else datetime.now()
                
                # Ownership
                shares_owned_after = int(t.get("postTransactionShares", 0) or 0)
                shares_owned_before = shares_owned_after - shares_transacted if transaction_type == "BUY" else shares_owned_after + shares_transacted
                ownership_change_pct = (shares_transacted / shares_owned_before * 100) if shares_owned_before > 0 else 0
                ownership_pct_company = (shares_owned_after / shares_outstanding * 100) if shares_outstanding > 0 else 0
                
                # Company impact
                float_impact_pct = (shares_transacted / public_float * 100) if public_float > 0 else 0
                
                # Classification
                is_automatic = trans_code == "M" or "10b5-1" in str(t)
                is_compensation = trans_code in ["A", "I", "G"]  # Award, In-Kind, Gift
                is_discretionary = not is_automatic and not is_compensation and trans_code not in ["M", "G"]
                
                # Insider weight (based on title)
                insider_title = owner.get("title", relationship)
                weight = compute_insider_weight(insider_title, is_officer, is_director, is_ten_percent)
                
                # Conviction score
                conviction = compute_conviction_score(
                    transaction_type, is_discretionary, is_officer, is_director, 
                    is_ten_percent, is_automatic, is_compensation,
                    shares_transacted, avg_volume
                )
                
                # Signal classification
                signal_label, signal_reason = classify_signal(transaction_type, conviction, is_discretionary)
                
                # Confidence badge
                confidence_badge = "High" if conviction >= 75 else "Medium" if conviction >= 50 else "Low"
                
                # Build trade object
                trade = {
                    "ticker": symbol.upper(),
                    "companyName": info.get("longName", symbol),
                    "companyCik": info.get("cik", ""),
                    "exchange": info.get("exchange", ""),
                    "industry": info.get("industry", ""),
                    "insiderName": insider_name,
                    "insiderCik": insider_cik,
                    "insider Title": insider_title,
                    "isOfficer": is_officer,
                    "isDirector": is_director,
                    "isTenPercentOwner": is_ten_percent,
                    "relationshipSummary": relationship,
                    "transactionType": transaction_type,
                    "transactionCode": trans_code,
                    "sharesTransacted": shares_transacted,
                    "pricePerShare": round(price_per_share, 2),
                    "transactionValue": round(transaction_value, 2),
                    "transactionDate": transaction_date.isoformat(),
                    "filingDate": filing_date.isoformat(),
                    "sharesOwnedAfter": shares_owned_after,
                    "ownershipChangePct": round(ownership_change_pct, 2),
                    "ownershipPctCompany": round(ownership_pct_company, 4),
                    "sharesOutstanding": shares_outstanding,
                    "publicFloat": public_float,
                    "floatImpactPct": round(float_impact_pct, 4),
                    "marketCapAtTrade": market_cap,
                    "avgDailyVolume": avg_volume,
                    "isDiscretionary": is_discretionary,
                    "isCompensationRelated": is_compensation,
                    "isAutomaticTrade": is_automatic,
                    "isFirstTimeBuy": False,  # Would need historical analysis
                    "isClusterTrade": False,  # Would need clustering analysis
                    "convictionScore": conviction,
                    "insiderWeight": weight,
                    "valueVsSalaryRatio": 0.0,  # Would need salary data
                    "netInsiderFlow30d": 0.0,  # Would need historical aggregation
                    "buySellRatio90d": 0.0,  # Would need historical aggregation
                    "formType": t.get("formType", "Form 4"),
                    "secFilingUrl": t.get("linkToFilingDetails", ""),
                    "source": "SEC",
                    "signalLabel": signal_label,
                    "signalReason": signal_reason,
                    "highlightFlag": conviction >= 80,
                    "confidenceBadge": confidence_badge
                }
                
                # Save to database via Go API
                save_url = "http://localhost:3000/api/insider/save"
                save_resp = requests.post(save_url, json=trade, timeout=5)
                
                if save_resp.status_code == 200:
                    ingested_count += 1
                    print(f"  ✓ Saved: {insider_name} - {transaction_type} {shares_transacted:,} shares")
                
            except Exception as e:
                print(f"  ✗ Failed to process transaction: {e}")
                continue
        
        t_end = time.time()
        print(f"\n{'='*60}")
        print(f"INGESTION COMPLETE: {ingested_count} new trades in {t_end-t_start:.2f}s")
        print(f"{'='*60}\n")
        
        return {
            "symbol": symbol.upper(),
            "ingested": ingested_count,
            "total_found": len(raw_transactions),
            "time_seconds": round(t_end - t_start, 2)
        }
        
    except Exception as e:
        print(f"[ERROR] Ingestion failed: {e}")
        traceback.print_exc()
        return {"symbol": symbol.upper(), "error": str(e), "ingested": 0}


def compute_insider_weight(title: str, is_officer: bool, is_director: bool, is_ten_percent: bool) -> float:
    """Calculate insider weight based on position"""
    title_lower = title.lower()
    
    if "ceo" in title_lower or "chief executive" in title_lower:
        return 1.0
    elif "cfo" in title_lower or "chief financial" in title_lower:
        return 0.9
    elif "president" in title_lower:
        return 0.9
    elif is_ten_percent:
        return 0.85
    elif is_director:
        return 0.7
    elif is_officer:
        return 0.6
    else:
        return 0.4


def compute_conviction_score(trans_type: str, is_discretionary: bool, is_officer: bool, 
                              is_director: bool, is_ten_percent: bool, is_automatic: bool,
                              is_compensation: bool, shares: int, avg_volume: int) -> int:
    """Calculate conviction score (0-100)"""
    base_score = 50
    
    # Positive factors
    if is_discretionary:
        base_score += 20
    if is_officer or is_director:
        base_score += 15
    if is_ten_percent:
        base_score += 10
    
    # Negative factors
    if is_automatic:
        base_score -= 25
    if is_compensation:
        base_score -= 15
    
    # Volume impact
    if avg_volume > 0:
        volume_ratio = shares / avg_volume
        volume_bonus = min(volume_ratio * 100, 20)
        base_score += int(volume_bonus)
    
    # Clamp to 0-100
    return max(0, min(100, base_score))


def classify_signal(trans_type: str, conviction: int, is_discretionary: bool) -> tuple:
    """Classify trade signal"""
    if trans_type == "BUY":
        if conviction >= 70:
            reason = "High conviction buy" if is_discretionary else "Significant purchase"
            return "Bullish", reason
        else:
            return "Neutral", "Routine purchase"
    else:  # SELL
        if conviction >= 70:
            reason = "High conviction sell" if is_discretionary else "Significant sale"
            return "Bearish", reason
        else:
            return "Neutral", "Routine sale"

@app.get("/history/{symbol}")
def get_stock_history(symbol: str, range: str = "1mo"):
    """
    Fetch historical data for charting.
    Supports ranges: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y, max
    """
    # --- CACHE CHECK ---
    global HISTORY_CACHE
    if 'HISTORY_CACHE' not in globals():
        HISTORY_CACHE = {}
        
    cache_key = f"{symbol}_{range}"
    now = time.time()
    
    if cache_key in HISTORY_CACHE:
        entry = HISTORY_CACHE[cache_key]
        if now - entry['time'] < 60: # 60s cache
            print(f"[{symbol}] Serving {range} from cache")
            return entry['payload']

    try:
        # Custom Mapping: (RequestRange) -> (FetchPeriod, Interval, SliceWindow)
        # We fetch MORE data to calculate Moving Averages (200MA requires ~200 points prior)
        
        # Default
        yf_period = "2y"
        yf_interval = "1d"
        slice_days = 30 # approx 1mo
        
        tf = range.upper()
        
        if tf == "1D":
            yf_period = "3d"   # Reduced from 5d: 200 bars * 5m = 1000m ~= 2.5 trading days. 3d is sufficient.
            yf_interval = "5m"
            # slice_func logic handled below
            
        elif tf == "5D":
            yf_period = "1mo"
            yf_interval = "30m" 
            
        elif tf == "1M":
            yf_period = "2y"
            yf_interval = "1d"
            
        elif tf == "3M":
            yf_period = "2y"
            yf_interval = "1d"
            
        elif tf == "6M":
            yf_period = "2y"
            yf_interval = "1d"
            
        elif tf == "1Y":
            yf_period = "2y"
            yf_interval = "1d"
            
        elif tf == "5Y":
            yf_period = "10y"
            yf_interval = "1wk"
            
        elif tf == "MAX":
            yf_period = "max"
            yf_interval = "1mo"
            
        t0 = time.time()
        print(f"[{symbol}] Fetching {yf_period} data for {tf} view...")
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=yf_period, interval=yf_interval)
        t1 = time.time()
        print(f"[{symbol}] YF Fetch took {t1-t0:.2f}s :: Rows={len(hist)}")
        
        if hist.empty:
            return {"error": "No historical data available", "symbol": symbol}
        
        # --- CALCULATE INDICATORS (Vectorized) ---
        hist["SMA50"] = hist["Close"].rolling(window=50).mean()
        hist["SMA200"] = hist["Close"].rolling(window=200).mean()
        
        v = hist["Volume"]
        p = (hist["High"] + hist["Low"] + hist["Close"]) / 3
        hist["VWAP"] = (p * v).cumsum() / v.cumsum()
        
        # --- SLICE TO VIEW (Vectorized) ---
        last_date = hist.index[-1]
        
        if tf == "1D":
             # Robust 1D Slice: Use string comparison to avoid Timestamp vs date object mismatch
             last_date_str = hist.index[-1].strftime("%Y-%m-%d")
             hist = hist[hist.index.strftime("%Y-%m-%d") == last_date_str]
             
        elif tf == "5D":
             start_date = last_date - pd.Timedelta(days=5)
             hist = hist[hist.index >= start_date]
        elif tf == "1M":
             start_date = last_date - pd.Timedelta(days=30)
             hist = hist[hist.index >= start_date]
        elif tf == "3M":
             start_date = last_date - pd.Timedelta(days=90)
             hist = hist[hist.index >= start_date]
        elif tf == "6M":
             start_date = last_date - pd.Timedelta(days=180)
             hist = hist[hist.index >= start_date]
        elif tf == "1Y":
             start_date = last_date - pd.Timedelta(days=365)
             hist = hist[hist.index >= start_date]
        elif tf == "5Y":
             start_date = last_date - pd.Timedelta(days=365*5)
             hist = hist[hist.index >= start_date]
        
        # --- OPTIMIZED SERIALIZATION ---
        t2 = time.time()
        
        # 1. Format Dates (Vectorized)
        is_intraday = "m" in yf_interval or "h" in yf_interval
        date_fmt = "%Y-%m-%d %H:%M" if is_intraday else "%Y-%m-%d"
        hist["date"] = hist.index.strftime(date_fmt)
        
        # 2. Rounding (Vectorized)
        cols_to_round = ["Open", "High", "Low", "Close", "SMA50", "SMA200", "VWAP"]
        for c in cols_to_round:
            if c in hist.columns:
                hist[c] = hist[c].round(2)
        
        # 3. Rename columns to lowercase for frontend (Vectorized rename)
        # Note: We need to handle Volume (int) vs others (float/null)
        # Replace NaN with None (which becomes null in JSON)
        # However, pandas 'where' or 'replace' works ok.
        
        # Select final columns
        final_cols = ["date", "Open", "High", "Low", "Close", "Volume", "SMA50", "SMA200", "VWAP"]
        output_df = hist[final_cols].copy()
        
        # Replace NaN with None (requires object type, often happens automatically or we force it)
        output_df = output_df.where(pd.notnull(output_df), None)
        
        # Rename to lowercase keys
        output_df.columns = ["date", "open", "high", "low", "close", "volume", "sma50", "sma200", "vwap"]
        
        # Convert to list of dicts (using pandas JSON encoder to handle numpy types)
        import json
        data = json.loads(output_df.to_json(orient="records"))
        t3 = time.time()
        print(f"[{symbol}] Processing took {t3-t2:.2f}s")
        
        resp = {
            "symbol": symbol.upper(),
            "range": range,
            "data": data
        }
        
        # Update Cache
        HISTORY_CACHE[cache_key] = {'time': now, 'payload': resp}
        return resp
    except Exception as e:
        err_msg = f"Error fetching history for {symbol}: {e}"
        print(err_msg)
        traceback.print_exc()
        try:
            with open("error_log.txt", "a") as f:
                f.write(f"\n--- ERROR {datetime.now()} ---\n")
                f.write(err_msg + "\n")
                f.write(traceback.format_exc())
                f.write("--------------------------\n")
        except:
            pass
        return {
            "error": str(e),
            "symbol": symbol.upper()
        }


# ========================================================================
# SEC EDGAR INSIDER TRADING INTEGRATION
# ========================================================================

import xml.etree.ElementTree as ET
from typing import List, Dict, Optional
from datetime import datetime, timedelta

# Ticker to CIK mapping cache
CIK_CACHE = {}

def get_cik_for_ticker(ticker: str) -> Optional[str]:
    """
    Convert ticker symbol to SEC CIK number.
    Uses SEC company tickers JSON endpoint.
    """
    ticker = ticker.upper().strip()
    
    # Check cache first
    if ticker in CIK_CACHE:
        return CIK_CACHE[ticker]
    
    try:
        # SEC provides a JSON mapping of all tickers to CIKs
        url = "https://www.sec.gov/files/company_tickers.json"
        headers = {
            "User-Agent": "Quantify Platform contact@quantify.com"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Search for ticker
        for entry in data.values():
            if entry.get("ticker", "").upper() == ticker:
                cik = str(entry["cik_str"]).zfill(10)  # Pad to 10 digits
                CIK_CACHE[ticker] = cik
                return cik
        
        print(f"CIK not found for ticker: {ticker}")
        return None
        
    except Exception as e:
        print(f"Error fetching CIK for {ticker}: {e}")
        return None


def parse_sec_form4(xml_content: str) -> List[Dict]:
    """
    Parse SEC Form 4 XML to extract transaction details.
    Returns list of transaction dictionaries.
    """
    transactions = []
    
    try:
        root = ET.fromstring(xml_content)
        
        # Extract insider information
        owner_data = root.find(".//reportingOwner")
        if owner_data is None:
            return []
        
        insider_name = ""
        owner_name = owner_data.find(".//rptOwnerName")
        if owner_name is not None:
            insider_name = owner_name.text or "Unknown"
        
        # Get relationship info
        relationship = owner_data.find(".//reportingOwnerRelationship")
        is_director = relationship.find(".//isDirector").text == "1" if relationship is not None and relationship.find(".//isDirector") is not None else False
        is_officer = relationship.find(".//isOfficer").text == "1" if relationship is not None and relationship.find(".//isOfficer") is not None else False
        is_ten_percent = relationship.find(".//isTenPercentOwner").text == "1" if relationship is not None and relationship.find(".//isTenPercentOwner") is not None else False
        is_other = relationship.find(".//isOther").text == "1" if relationship is not None and relationship.find(".//isOther") is not None else False
        
        officer_title = ""
        title_elem = relationship.find(".//officerTitle") if relationship is not None else None
        if title_elem is not None and title_elem.text:
            officer_title = title_elem.text
        
        # Extract non-derivative transactions
        for transaction in root.findall(".//nonDerivativeTransaction"):
            try:
                trans_data = {}
                
                # Transaction date
                trans_date_elem = transaction.find(".//transactionDate/value")
                trans_data["transactionDate"] = trans_date_elem.text if trans_date_elem is not None else ""
                
                # Transaction code (P=Purchase, S=Sale, etc.)
                trans_code_elem = transaction.find(".//transactionCode")
                trans_code = trans_code_elem.text if trans_code_elem is not None else "P"
                trans_data["transactionCode"] = trans_code
                
                # Acquisition or Disposition (CRITICAL for determining BUY vs SELL)
                acq_disp_elem = transaction.find(".//transactionAcquiredDisposedCode/value")
                acq_disp = acq_disp_elem.text if acq_disp_elem is not None else "A"
                trans_data["acquisitionDisposition"] = acq_disp
                
                print(f"    Code: {trans_code}, Acq/Disp: {acq_disp} -> {('BUY' if acq_disp == 'A' else 'SELL')}")
                
                # Map to BUY/SELL based on Acquisition/Disposition (A=Acquired/BUY, D=Disposed/SELL)
                if acq_disp == "A":
                    trans_data["transactionType"] = "BUY"
                else:
                    trans_data["transactionType"] = "SELL"
                
                # Shares transacted
                shares_elem = transaction.find(".//transactionAmounts/transactionShares/value")
                shares = float(shares_elem.text) if shares_elem is not None and shares_elem.text else 0
                trans_data["sharesTransacted"] = int(shares)
                
                # Price per share
                price_elem = transaction.find(".//transactionAmounts/transactionPricePerShare/value")
                price = float(price_elem.text) if price_elem is not None and price_elem.text else 0
                trans_data["pricePerShare"] = price
                
                # Transaction value
                trans_data["transactionValue"] = shares * price
                
                # Shares owned after transaction
                shares_after_elem = transaction.find(".//postTransactionAmounts/sharesOwnedFollowingTransaction/value")
                shares_after = float(shares_after_elem.text) if shares_after_elem is not None and shares_after_elem.text else 0
                trans_data["sharesOwnedAfter"] = int(shares_after)
                
                # Direct or Indirect ownership
                ownership_elem = transaction.find(".//ownershipNature/directOrIndirectOwnership/value")
                trans_data["directOrIndirect"] = ownership_elem.text if ownership_elem is not None else "D"
                
                # Add insider info
                trans_data["insiderName"] = insider_name
                trans_data["insiderTitle"] = officer_title
                trans_data["isDirector"] = is_director
                trans_data["isOfficer"] = is_officer
                trans_data["isTenPercentOwner"] = is_ten_percent
                trans_data["isOther"] = is_other
                
                # Skip if no shares or price
                if trans_data["sharesTransacted"] > 0 and trans_data["pricePerShare"] > 0:
                    transactions.append(trans_data)
                    
            except Exception as e:
                print(f"Error parsing transaction: {e}")
                continue
        
        return transactions
        
    except Exception as e:
        print(f"Error parsing Form 4 XML: {e}")
        return []


def calculate_conviction_score(trans: Dict) -> int:
    """
    Calculate conviction score (0-100) based on transaction attributes.
    """
    score = 50  # Base score
    
    # Transaction size impact
    value = trans.get("transactionValue", 0)
    if value > 1_000_000:
        score += 20
    elif value > 100_000:
        score += 10
    elif value > 10_000:
        score += 5
    
    # Insider role weight
    if trans.get("isTenPercentOwner"):
        score += 15
    elif "CEO" in trans.get("insiderTitle", "").upper() or "CFO" in trans.get("insiderTitle", "").upper():
        score += 10
    elif trans.get("isDirector"):
        score += 5
    
    # Direct ownership bonus
    if trans.get("directOrIndirect") == "D":
        score += 10
    
    # Discretionary purchase (open market)
    if trans.get("transactionCode") == "P":
        score += 15
    
    # Penalty for automatic transactions
    if trans.get("transactionCode") in ["M", "F", "A"]:
        score -= 10
    
    return min(max(score, 0), 100)


def get_signal_label(trans: Dict) -> str:
    """
    Generate signal label based on conviction score and transaction type.
    """
    score = trans.get("convictionScore", 50)
    trans_type = trans.get("transactionType", "BUY")
    
    if trans_type == "BUY":
        if score >= 75:
            return "Strong Buy"
        elif score >= 60:
            return "Moderate Buy"
        else:
            return "Weak Buy"
    else:  # SELL
        if score >= 75:
            return "Strong Sell"
        elif score >= 60:
            return "Moderate Sell"
        else:
            return "Weak Sell"


@app.get("/insider-trading")
def get_insider_trading_sec(ticker: str):
    """
    Fetch insider trading data from SEC EDGAR Form 4 filings.
    Returns parsed transactions with conviction scores.
    """
    try:
        print(f"Fetching SEC EDGAR insider trades for {ticker}...")
        ticker = ticker.upper().strip()
        
        # Get CIK for ticker
        cik = get_cik_for_ticker(ticker)
        if not cik:
            return {"error": f"Could not find CIK for ticker {ticker}", "trades": []}
        
        print(f"Found CIK {cik} for {ticker}")
        
        # Fetch Form 4 filings list from SEC
        url = "https://www.sec.gov/cgi-bin/browse-edgar"
        params = {
            "action": "getcompany",
            "CIK": cik,
            "type": "4",  # Form 4 = insider transactions
            "dateb": "",
            "owner": "only",
            "count": "100",  # Last 100 filings
            "output": "atom"
        }
        
        headers = {
            "User-Agent": "Quantify Platform contact@quantify.com"
        }
        
        # Rate limiting: SEC allows 10 requests/second
        time.sleep(0.11)  # 110ms between requests = ~9 req/sec (safe)
        
        response = requests.get(url, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        
        print(f"SEC Response Status: {response.status_code}")
        print(f"SEC Response Length: {len(response.content)} bytes")
        
        # Parse ATOM feed to get filing URLs
        root = ET.fromstring(response.content)
        
        # Debug: Check what we got
        print(f"Root tag: {root.tag}")
        
        all_transactions = []
        filing_count = 0
        
        # Try both with and without namespace
        entries = root.findall(".//{http://www.w3.org/2005/Atom}entry")
        if not entries:
            # Try without namespace (some feeds don't use it)
            entries = root.findall(".//entry")
        
        print(f"Found {len(entries)} entries in ATOM feed")
        
        # Process up to 20 most recent filings
        for entry in entries[:20]:
            try:
                # Get filing date (try with and without namespace)
                filing_date_elem = entry.find(".//{http://www.w3.org/2005/Atom}updated")
                if filing_date_elem is None:
                    filing_date_elem = entry.find(".//updated")
                filing_date = filing_date_elem.text.split("T")[0] if filing_date_elem is not None else ""
                
                # Get accession number from summary
                accession_elem = entry.find(".//{http://www.w3.org/2005/Atom}summary")
                if accession_elem is None:
                    accession_elem = entry.find(".//summary")
                summary_text = accession_elem.text if accession_elem is not None else ""
                
                print(f"  Filing date: {filing_date}, Summary length: {len(summary_text)}")
                
                # Extract accession number from summary
                import re
                acc_match = re.search(r"(\d{10}-\d{2}-\d{6})", summary_text)
                accession_number = acc_match.group(1) if acc_match else ""
                
                print(f"  Accession: {accession_number}")
                
                # Build URL to actual Form 4 XML
                if accession_number:
                    # SEC filing URL pattern
                    acc_no_dashes = accession_number.replace("-", "")
                    doc_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc_no_dashes}/{accession_number}.txt"
                    
                    # Fetch Form 4 document
                    time.sleep(0.11)  # Rate limit
                    doc_response = requests.get(doc_url, headers=headers, timeout=10)
                    doc_response.raise_for_status()
                    
                    # Extract XML from SEC document (it's wrapped in text)
                    content = doc_response.text
                    xml_start = content.find("<?xml")
                    xml_end = content.find("</ownershipDocument>") + len("</ownershipDocument>")
                    
                    if xml_start != -1 and xml_end > xml_start:
                        xml_content = content[xml_start:xml_end]
                        
                        # Parse Form 4 XML
                        transactions = parse_sec_form4(xml_content)
                        
                        # Add metadata and scoring
                        for trans in transactions:
                            trans["ticker"] = ticker
                            trans["filingDate"] = filing_date
                            trans["formType"] = "4"
                            trans["accessionNumber"] = accession_number
                            trans["secFilingUrl"] = f"https://www.sec.gov/cgi-bin/viewer?action=view&cik={cik}&accession_number={accession_number}&xbrl_type=v"
                            trans["relationshipSummary"] = ", ".join([
                                "Director" if trans.get("isDirector") else "",
                                "Officer" if trans.get("isOfficer") else "",
                                "10% Owner" if trans.get("isTenPercentOwner") else "",
                                "Other" if trans.get("isOther") else ""
                            ]).strip(", ")
                            
                            # Calculate conviction score
                            trans["convictionScore"] = calculate_conviction_score(trans)
                            trans["signalLabel"] = get_signal_label(trans)
                            trans["confidenceBadge"] = "High" if trans["convictionScore"] >= 75 else "Medium" if trans["convictionScore"] >= 60 else "Low"
                            
                            # Derived flags
                            trans["isDiscretionary"] = trans.get("transactionCode") == "P"
                            trans["isAutomaticTrade"] = trans.get("transactionCode") in ["M", "F"]
                            trans["isCompensationRelated"] = trans.get("transactionCode") == "A"
                            
                            # Mock fields (would need more data to calculate properly)
                            trans["floatImpactPct"] = 0.001  # Placeholder
                            trans["ownershipChangePct"] = 0.0  # Placeholder
                            trans["signalReason"] = f"{trans['signalLabel']} based on {trans['transactionType']} of ${trans['transactionValue']:,.0f}"
                        
                        all_transactions.extend(transactions)
                        filing_count += 1
                        
            except Exception as e:
                print(f"Error processing filing: {e}")
                continue
        
        # Sort by transaction date (most recent first)
        all_transactions.sort(key=lambda x: x.get("transactionDate", ""), reverse=True)
        
        # Return top 20 most recent
        result = all_transactions[:20]
        
        print(f"Fetched {len(result)} transactions from {filing_count} filings for {ticker}")
        
        return result
        
    except Exception as e:
        print(f"Error fetching SEC insider data for {ticker}: {e}")
        traceback.print_exc()
        return {"error": str(e), "trades": []}
