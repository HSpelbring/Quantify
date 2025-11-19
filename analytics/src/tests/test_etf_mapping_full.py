def test_full_etf_mapping_behavior(client):
    res = client.get("/quotes").json()

    # ETFs mapped to indices
    assert "^GSPC" in res
    assert "^NDX" in res
    assert "^DJI" in res

    # No raw ETF symbols should appear here
    assert "SPY" not in res
    assert "QQQ" not in res
    assert "DIA" not in res
