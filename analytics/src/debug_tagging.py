import sys
import os

# Ensure we can import from src
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import auto_tag_news
from tagging_config import EVENT_TAGS

def debug_tag_matching(title, content=""):
    print(f"\n--- Testing Article: {title} ---")
    tags = auto_tag_news(title, content=content)
    
    # Re-implement simple matching to see WHAT matched
    search_text = (title + " " + content).lower()
    
    found_miss = False
    for t in tags:
        print(f"Matched Tag: {t['label']} ({t['category']})")
        if t['label'] == "Earnings Miss":
            found_miss = True

    if found_miss:
        print("\n[DEBUG] 'Earnings Miss' triggers:")
        for et in EVENT_TAGS:
            if et['tag'] == "Earnings Miss":
                for kw in et['keywords']:
                    if kw in search_text:
                        print(f"  - MATCHED KEYWORD: '{kw}'")

# Test cases based on user report (generic articles getting flagged)
test_articles = [
    {
        "title": "Market falls short of previous highs as tech slide continues", 
        "content": "The S&P 500 fell short of its record high today. Investors were disappointed."
    },
    {
        "title": "Economic data weaker than expected",
        "content": "Job growth was weaker than expected this month, signaling a slowdown."
    },
    {
        "title": "Tesla stock drops",
        "content": "Shares fell short term support levels."
    }
]

for a in test_articles:
    debug_tag_matching(a['title'], a['content'])
