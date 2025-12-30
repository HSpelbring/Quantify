import requests
import json
import sys

try:
    print("Testing GET http://localhost:8000/news ...")
    response = requests.get("http://localhost:8000/news?symbols=SPY")
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Success! Received {len(data)} articles.")
        if len(data) > 0:
            print("Sample Article:")
            print(json.dumps(data[0], indent=2))
            
            # Verify articleType
            if 'articleType' in data[0]:
                print(f"PASS: Found 'articleType': {data[0]['articleType']}")
            else:
                print("FAIL: 'articleType' missing in response!")
                sys.exit(1)
        else:
            print("Warning: No articles returned.")
    else:
        print("Error Response:")
        print(response.text)
        sys.exit(1)

except Exception as e:
    print(f"Exception checking endpoint: {e}")
    sys.exit(1)
