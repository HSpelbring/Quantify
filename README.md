## 🧾 Quantify — Simple Stock Portfolio Management System

Quantify is a lightweight, multi-language application for viewing and analyzing live market data.  
It uses a **modular microservice architecture** — separating frontend, backend, and analytics layers —  
to ensure flexibility, scalability, and clear separation of concerns.

---

### 🏗️ System Overview

| Layer | Language | Description |
|-------|-----------|--------------|
| **Client (Frontend)** | Angular | Provides a responsive dashboard UI that displays live fund data, charts, and trends. Communicates with the Go backend via REST API calls. |
| **Backend (API Gateway)** | Go (Gin) | Acts as a proxy layer. Handles requests from the Angular app and routes them to the Python analytics service. Implements caching, error handling, and data normalization. |
| **Analytics Microservice** | Python (FastAPI) | Fetches and aggregates real-time financial data using external APIs (e.g., Yahoo Finance). Performs calculations, transformations, and analysis before returning clean JSON data to the Go backend. |

---

### ⚙️ How It Works

1. **Frontend (Angular)** requests market data from `/api/funds`.
2. **Go Backend** receives the request and checks for cached data.
   - If fresh data is cached → returns immediately.
   - If not → calls the Python service to fetch updated quotes.
3. **Python FastAPI Service** retrieves data from external APIs (like Yahoo Finance or Finnhub),  
   performs calculations (e.g., percentage change, averages), and sends results back as JSON.
4. **Go Backend** normalizes and forwards the response to the Angular UI.
5. **Angular UI** updates charts, prices, and tickers live on the dashboard.

---

### Running the Application

#### 1 Frontend
```bash
cd Quantify/client
ng serve --open

#### 2 Analytics
```bash
cd Quantify/analytics/src
python app.py

#### 3 Backend
```bash
cd Quantify/backend
go run cmd/server/main.go