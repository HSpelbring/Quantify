def test_quotes_order(client):
    res = client.get("/quotes").json()

    expected_order = ["^GSPC", "^NDX", "^DJI", "^RUT", "^VIX", "BTC-USD"]
    returned_order = list(res.keys())

    assert returned_order == expected_order