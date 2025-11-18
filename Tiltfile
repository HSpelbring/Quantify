# --- PYTHON ANALYTICS (Port 8000) ---
local_resource(
    name='analytics',
    serve_cmd='cd analytics/src && python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload',
    deps=['analytics/src'],
    allow_parallel=False
)

# --- GO BACKEND (Port 8080) ---
local_resource(
    name='backend',
    serve_cmd='cd backend && go run cmd/server/main.go',
    deps=['backend'],
    allow_parallel=False,
    resource_deps=['analytics']
)

# --- ANGULAR FRONTEND (Port 4200) ---
local_resource(
    name='frontend',
    serve_cmd='cd client && ng serve --open --proxy-config proxy.conf.json',
    deps=[
        'client/src',
        'client/public',
        'client/angular.json',
        'client/package.json',
        'client/tsconfig.json',
        'client/tsconfig.app.json',
        'client/tsconfig.spec.json',
        'client/proxy.conf.json',
        'client/package-lock.json'
        ],
    ignore=[
        'client/node_modules/**',
        'client/dist/**',
        'client/.angular/cache/**',
        'client/**/*.tsbuildinfo'
    ],
    allow_parallel=False,
    resource_deps=['backend'],
)

# Helper function using argument array (Windows-safe)
def api_cmd(name, url):
    return local_resource(
        name="API_" + name,
        cmd=["curl.exe", url],
        allow_parallel=True,
        trigger_mode=TRIGGER_MODE_MANUAL,
    )

api_cmd("health",          "http://localhost:8080/api/health")
api_cmd("funds",           "http://localhost:8080/api/funds")
api_cmd("fund_by_param",   "http://localhost:8080/api/fund/AAPL")
api_cmd("fund_by_query",   "http://localhost:8080/api/fund?symbol=AAPL")
api_cmd("fundamentals",    "http://localhost:8080/api/fundamentals/AAPL")
api_cmd("history",         "http://localhost:8080/api/history/AAPL?range=1mo")
api_cmd("eod",             "http://localhost:8080/api/eod")
api_cmd("insight",         "http://localhost:8080/api/insight")
api_cmd("python_quotes",   "http://localhost:8000/quotes")
