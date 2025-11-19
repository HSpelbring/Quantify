from unittest.mock import patch
import yfinance as yf
import pytest
from market_hours import market_open

@pytest.mark.skipif(not market_open(), reason="Market closed—history data may be empty.")
def test_yfinance_failure_fallback(monkeypatch, client):
    def broken_history(*args, **kwargs):
        raise Exception("Forced failure")

    with patch.object(yf.Ticker, "history", broken_history):
        res = client.get("/quotes").json()

        for data in res.values():
            assert data["price"] >= 0
            assert isinstance(data["history"], list)