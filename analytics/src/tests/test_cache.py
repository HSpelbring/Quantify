import time

def test_quotes_cache(client):
    first = client.get("/quotes").json()
    time.sleep(1)
    second = client.get("/quotes").json()

    # Cache TTL is 10 seconds → both should match
    assert first == second, "Cache not used"