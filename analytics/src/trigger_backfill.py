import requests

try:
    # limit=0 means process all
    print("Triggering full enrichment...")
    r = requests.post("http://localhost:8000/news/enrich?limit=0", timeout=300) 
    if r.status_code == 200:
        print(f"Response: {r.json()}")
    else:
        print(f"Error: {r.status_code} - {r.text}")
except Exception as e:
    print(f"Exception: {e}")
