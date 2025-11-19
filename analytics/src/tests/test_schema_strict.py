def test_quotes_strict_schema(client):
    res = client.get("/quotes").json()

    for symbol, data in res.items():
        assert set(data.keys()) == {"price", "change", "history"}, "Unexpected schema fields"
