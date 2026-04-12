$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot "backend"

Write-Host "Starting MedPrice on port 8000..." -ForegroundColor Cyan
Write-Host "Keep this terminal open while using the app or port forwarding." -ForegroundColor Yellow
Write-Host "Open: http://127.0.0.1:8000" -ForegroundColor Green

Set-Location $backendDir
python -m uvicorn main:app --host 0.0.0.0 --port 8000
