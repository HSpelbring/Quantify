def test_etf_index_mapping(client):
    res = client.get("/quotes")
    data = res.json()

    assert "^GSPC" in data
    assert "^NDX" in data
    assert "^DJI" in data
    assert "^VIX" in data
    assert "^RUT" in data