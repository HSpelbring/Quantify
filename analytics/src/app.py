from fastapi import FastAPI
from analytics.insights import generate_insight

app = FastAPI()

@app.get("/analyze")
def analyze():
    """Basic endpoint returning a test insight."""
    data = generate_insight()
    return {"insight": data}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
