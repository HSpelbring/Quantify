# analytics/src/tests/test_quotes_schema.py

from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_quotes_schema(client):
    res = client.get("/quotes")
    assert res.status_code == 200
    
    data = res.json()
    
    for sym, obj in data.items():
        assert "price" in obj
        assert "change" in obj
        assert "history" in obj
        assert isinstance(obj["history"], list)