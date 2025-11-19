import pytest
from market_hours import market_open

@pytest.mark.skipif(not market_open(), reason="Market closed—history data may be empty.")
def test_all_symbols_have_history(client):
    res = client.get("/quotes").json()

    for symbol, data in res.items():
        assert len(data["history"]) > 0, f"{symbol} has empty history"