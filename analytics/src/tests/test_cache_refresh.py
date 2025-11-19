import time
import pytest
from market_hours import market_open

@pytest.mark.skipif(not market_open(), reason="Market closed—history data may be empty.")
def test_cache_refresh(client):
    first = client.get("/quotes").json()

    # wait longer than TTL
    time.sleep(11)

    second = client.get("/quotes").json()

    # The JSON must NOT be literally the same object
    assert first != second, "Cache did not refresh after TTL expired"
