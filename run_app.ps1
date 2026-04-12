$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"
$logsDir = Join-Path $projectRoot ".logs"

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

function Test-ServiceHealth {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
            Start-Sleep -Milliseconds 750
        }
    }

    return $false
}

function Stop-PortProcess {
    param([Parameter(Mandatory = $true)][int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Preparing MedPrice AI..." -ForegroundColor Yellow
Stop-PortProcess -Port 8000
Stop-PortProcess -Port 5173

$backendStdoutLog = Join-Path $logsDir "backend.stdout.log"
$backendStderrLog = Join-Path $logsDir "backend.stderr.log"
$frontendStdoutLog = Join-Path $logsDir "frontend.stdout.log"
$frontendStderrLog = Join-Path $logsDir "frontend.stderr.log"

Write-Host "Starting MedPrice AI Backend (FastAPI)..." -ForegroundColor Green
$backendProcess = Start-Process `
    -FilePath "python" `
    -ArgumentList "-m","uvicorn","main:app","--host","0.0.0.0","--port","8000" `
    -WorkingDirectory $backendDir `
    -RedirectStandardOutput $backendStdoutLog `
    -RedirectStandardError $backendStderrLog `
    -PassThru

if (-not (Test-ServiceHealth -Url "http://127.0.0.1:8000/health" -TimeoutSeconds 25)) {
    Write-Host "Backend failed to start. Check .logs\backend.stdout.log and .logs\backend.stderr.log" -ForegroundColor Red
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    exit 1
}

Write-Host "Starting MedPrice AI Frontend (Vite)..." -ForegroundColor Cyan
$frontendProcess = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run","dev","--","--host","0.0.0.0" `
    -WorkingDirectory $frontendDir `
    -RedirectStandardOutput $frontendStdoutLog `
    -RedirectStandardError $frontendStderrLog `
    -PassThru

if (-not (Test-ServiceHealth -Url "http://127.0.0.1:5173" -TimeoutSeconds 25)) {
    Write-Host "Frontend failed to start. Check .logs\frontend.stdout.log and .logs\frontend.stderr.log" -ForegroundColor Red
    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    exit 1
}

Write-Host "Backend:  http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:5173" -ForegroundColor Cyan
Write-Host "Logs:     .logs\\backend.stdout.log, .logs\\backend.stderr.log, .logs\\frontend.stdout.log, and .logs\\frontend.stderr.log" -ForegroundColor Yellow

Start-Process "http://127.0.0.1:5173" | Out-Null

Write-Host "Both servers are healthy. Press Ctrl+C to stop them." -ForegroundColor Yellow

try {
    while ($true) {
        if ($backendProcess.HasExited) {
            Write-Host "Backend stopped unexpectedly. Check .logs\\backend.stdout.log and .logs\\backend.stderr.log" -ForegroundColor Red
            break
        }

        if ($frontendProcess.HasExited) {
            Write-Host "Frontend stopped unexpectedly. Check .logs\\frontend.stdout.log and .logs\\frontend.stderr.log" -ForegroundColor Red
            break
        }

        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
