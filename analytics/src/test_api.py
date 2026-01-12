import requests

try:
    r = requests.get("http://localhost:8080/api/news?limit=20")
    if r.status_code == 200:
        data = r.json()
        print(f"Total returned: {len(data)}")
        for i, a in enumerate(data):
            print(f"{i+1}. {a.get('title')} [{a.get('articleType')}] (Content: {a.get('hasFullContent')})")
    else:
        print(f"Error: {r.status_code}")
except Exception as e:
    print(f"Exception: {e}")
