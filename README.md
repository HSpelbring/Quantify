# Quantify
Simple stock portfolio management system.

**To run:**
[in /Quantify/client] ng serve --open --> Builds and serves the Angular frontend locally on http://localhost:4200. Opens the live dashboard UI.
[in /Quantify/analytics/src] python app.py --> Launches the Python FastAPI microservice on http://localhost:8000. Handles /price, /analyze, and others later.
[in /Quantify/backend] go run cmd/server/main.go --> Starts the Go proxy backend (API gateway) on http://localhost:8080. It forwards frontend requests to the Python service.