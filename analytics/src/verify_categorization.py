from app import classify_source_type, auto_tag_news
import json

test_cases = [
    {"provider": "Reuters", "title": "Fed signals rate hike"},
    {"provider": "Bloomberg", "title": "Stock market rally continues"},
    {"provider": "CNBC", "title": "Nvidia earnings preview"},
    {"provider": "Yahoo Finance", "title": "Best stocks to buy now"},
    {"provider": "Nasdaq", "title": "Tech stocks lead market higher"},
    {"provider": "MarketWatch", "title": "Dow Jones drops 200 points"},
    {"provider": "Investing.com", "title": "Bitcoin reaches new high"},
    {"provider": "Benzinga", "title": "Analyst upgrades Apple to Buy"},
    {"provider": "Zacks", "title": "Strong Buy stocks for 2024"},
    {"provider": "PR Newswire", "title": "Company A announces merger"},
    {"provider": "Business Wire", "title": "Company B reports Q3 earnings"},
    {"provider": "Seeking Alpha", "title": "Why I am selling Tesla"},
    {"provider": "Motley Fool", "title": "3 stocks to hold forever"},
    {"provider": "Unknown Source", "title": "Random market commentary"}
]

print(f"{'Source':<20} | {'Title':<40} | {'Type':<15}")
print("-" * 80)

for tc in test_cases:
    a_type = classify_source_type(tc['provider'], tc['title'])
    print(f"{tc['provider']:<20} | {tc['title'][:40]:<40} | {a_type:<15}")

print("\n=== Checking Analyst Keywords in Title ===")
analyst_titles = [
    "JPMorgan upgrades Apple to Overweight",
    "Goldman Sachs cuts price target on Tesla",
    "Morgan Stanley initiates coverage on Nvidia"
]

for title in analyst_titles:
    a_type = classify_source_type("Unknown", title)
    print(f"{'Unknown':<20} | {title:<40} | {a_type:<15}")
