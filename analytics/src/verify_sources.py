from app import classify_source_type

print("=== Testing Source Categorization Logic ===")

test_cases = [
    # Verified
    ("Business Wire", "Company announces merged", "Verified"),
    ("PR Newswire", "Earnings Release", "Verified"),
    ("SEC.gov", "Form 8-K", "Verified"),
    
    # Institutional
    ("Reuters", "Market update", "Institutional"),
    ("Bloomberg", "Oil prices surge", "Institutional"),
    ("Yahoo Finance", "Reuters: Market Update", "Institutional"), # provider string usually comes from YF as "Yahoo Finance" but sometimes source is distinct. 
    # Actually my logic checks provider string. If provider is "Yahoo Finance", it matches Secondary unless title heuristics?
    # Wait, my logic says "Yahoo reposting Reuters is Institutional" but checks keywords in provider. 
    # If standard YF access gives provider="Yahoo Finance", it will be Secondary. 
    # If the provider field from YF is "Reuters", it will be Institutional.
    
    # Analyst (Title Heuristics)
    ("Benzinga", "Apple Upgrade to Buy", "Analyst"),
    ("MarketWatch", "Analyst Upgrades NVDA", "Analyst"),
    ("Yahoo Finance", "Analyst Upgrades Tesla", "Analyst"), # Should be Analyst due to title
    
    # Opinionated
    ("Motley Fool", "Why Apple is a Sell", "Opinionated"),
    ("Seeking Alpha", "Bearish thesis on TSLA", "Opinionated"),
    
    # Secondary
    ("Yahoo Finance", "Stock market recap", "Secondary"),
    ("Investing.com", "Daily Update", "Secondary")
]

for provider, title, expected in test_cases:
    result = classify_source_type(provider, title)
    status = "PASS" if result == expected else f"FAIL (Got {result})"
    print(f"[{status}] Provider: '{provider}' | Title: '{title}' -> {expected}")

print("\n=== Done ===")
