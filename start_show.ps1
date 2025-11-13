# Run Python analytics microservice first (port 8000)
Start-Process powershell -ArgumentList "cd analytics\src; python app.py"
Start-Sleep -Seconds 3

# Run Go backend second (port 8080)
Start-Process powershell -ArgumentList "cd backend; go run cmd/server/main.go"
Start-Sleep -Seconds 3

# Run Angular frontend last (port 4200)
Start-Process powershell -ArgumentList "cd client; ng serve --open --proxy-config proxy.conf.json"
