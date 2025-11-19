import pytest
from market_hours import market_open

@pytest.mark.skipif(not market_open(), reason="Market closed—history data may be empty.")
def test_quotes_types(client):
    res = client.get("/quotes").json()

    for symbol, data in res.items():
        assert isinstance(data["price"], float)
        assert isinstance(data["change"], float)
        assert isinstance(data["history"], list)

        for point in data["history"]:
            assert isinstance(point, float)