from app import auto_tag_news
import rss_service
import json

print("=== Fetching Sample RSS Items ===")
items = rss_service.fetch_rss_news(limit_per_feed=1)

print(f"\nFetched {len(items)} items. Checking Tags...")

for item in items:
    tags = auto_tag_news(item['title'], item['summary'])
    print(f"\nTitle: {item['title']}")
    print(f"Tags: {json.dumps(tags, indent=2)}")

print("\n=== Testing Specific Keywords ===")
test_headlines = [
    "Apple reports earnings beat, stock surges",
    "Tesla implies weak guidance for Q4",
    "Microsoft announces acquisition of OpenAI for $100B",
    "SEC investigates crypto exchange over fraud",
    "Fed raises rates by 25bps, markets tumble"
]

for title in test_headlines:
    tags = auto_tag_news(title)
    print(f"\nHeadline: {title}")
    # Simplify output for readability
    simple_tags = [f"{t['label']} ({t['category']})" for t in tags]
    print(f"Tags: {simple_tags}")
