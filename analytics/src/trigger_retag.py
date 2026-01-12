import requests
import time

try:
    print("Triggering re-tagging...")
    # Timeout increased because processing 200+ articles might take a few seconds
    r = requests.post("http://localhost:8000/news/retag?limit=0", timeout=60) 
    if r.status_code == 200:
        print(f"Response: {r.json()}")
    else:
        print(f"Error: {r.status_code} - {r.text}")
except Exception as e:
    print(f"Exception: {e}")
