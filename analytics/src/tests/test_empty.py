def test_quotes_no_zero_values(client):
    res = client.get("/quotes")
    data = res.json()

    for sym, obj in data.items():
        # adjust exclusions depending on known broken sources
        if sym != "^RUT":
            assert obj["price"] != 0, f"{sym} returned zero price"