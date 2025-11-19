import pytest
from market_hours import market_open

@pytest.mark.skipif(not market_open(), reason="Market closed—history data may be empty.")
def test_price_and_change_sanity(client):
    res = client.get("/quotes").json()

    for symbol, data in res.items():
        assert data["price"] >= 0, f"{symbol} has negative price!"
        assert -50 <= data["change"] <= 50, f"{symbol} change out of range!"