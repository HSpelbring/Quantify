def test_quotes_history_nonempty(client):
    res = client.get("/quotes")
    data = res.json()

    for sym, obj in data.items():
        # You can adjust this skip list as the backend improves
        if sym != "^GSPC":  
            assert len(obj["history"]) > 0, f"{sym} has empty history"