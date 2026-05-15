# WinnerDrop — script de inicio completo
# Ejecutar con: powershell -ExecutionPolicy Bypass -File C:\Users\dioni\winnerdrop\start.ps1

$env:PATH = "C:\PostgreSQL\16\bin;" + $env:PATH

Write-Host "`n=== WinnerDrop Startup ===" -ForegroundColor Cyan

# 1. PostgreSQL
Write-Host "`n[1/3] Iniciando PostgreSQL..." -ForegroundColor Yellow
$pgRunning = Get-Process -Name "postgres" -ErrorAction SilentlyContinue
if ($pgRunning) {
    Write-Host "     PostgreSQL ya estaba corriendo." -ForegroundColor Green
} else {
    & "C:\PostgreSQL\16\bin\pg_ctl.exe" start -D "C:\Users\dioni\pgdata" -o "-p 5433" -l "C:\Users\dioni\pgdata\pg_ctl.log" -w 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    $pgRunning = Get-Process -Name "postgres" -ErrorAction SilentlyContinue
    if ($pgRunning) {
        Write-Host "     PostgreSQL iniciado en puerto 5433." -ForegroundColor Green
    } else {
        Write-Host "     ERROR: No se pudo iniciar PostgreSQL." -ForegroundColor Red
        exit 1
    }
}

# 2. Backend NestJS
Write-Host "`n[2/3] Iniciando Backend (puerto 3001)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location "C:\Users\dioni\winnerdrop\backend"
    npm run start:dev 2>&1
}
Write-Host "     Backend iniciando (job ID: $($backendJob.Id))..." -ForegroundColor Green

# 3. Frontend Next.js
Write-Host "`n[3/3] Iniciando Frontend (puerto 3000)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "C:\Users\dioni\winnerdrop\frontend"
    npm run dev 2>&1
}
Write-Host "     Frontend iniciando (job ID: $($frontendJob.Id))..." -ForegroundColor Green

Write-Host "`n=== Esperando que los servidores arranquen... ===" -ForegroundColor Cyan
Start-Sleep -Seconds 20

# Verificar
$backendOut = Receive-Job $backendJob -Keep | Select-String "Nest application" | Select-Object -Last 1
$frontendOut = Receive-Job $frontendJob -Keep | Select-String "Ready|localhost" | Select-Object -Last 1

Write-Host "`n=== Estado ===" -ForegroundColor Cyan
Write-Host "Backend:  $backendOut" -ForegroundColor $(if ($backendOut) { "Green" } else { "Red" })
Write-Host "Frontend: $frontendOut" -ForegroundColor $(if ($frontendOut) { "Green" } else { "Yellow" })

Write-Host "`n Dashboard: http://localhost:3000" -ForegroundColor Green
Write-Host " API:       http://localhost:3001" -ForegroundColor Green
Write-Host "`nPresiona Ctrl+C para detener todo.`n" -ForegroundColor Gray

# Mantener el script vivo y los jobs corriendo
try {
    while ($true) {
        Start-Sleep -Seconds 30
        # Reiniciar si algo se cayó
        if ($backendJob.State -eq 'Failed' -or $backendJob.State -eq 'Completed') {
            Write-Host "[AUTO] Backend caído — reiniciando..." -ForegroundColor Yellow
            $backendJob = Start-Job -ScriptBlock { Set-Location "C:\Users\dioni\winnerdrop\backend"; npm run start:dev 2>&1 }
        }
        if ($frontendJob.State -eq 'Failed' -or $frontendJob.State -eq 'Completed') {
            Write-Host "[AUTO] Frontend caído — reiniciando..." -ForegroundColor Yellow
            $frontendJob = Start-Job -ScriptBlock { Set-Location "C:\Users\dioni\winnerdrop\frontend"; npm run dev 2>&1 }
        }
    }
} finally {
    Write-Host "`nDeteniendo servicios..." -ForegroundColor Yellow
    Stop-Job $backendJob, $frontendJob
    Remove-Job $backendJob, $frontendJob
    & "C:\PostgreSQL\16\bin\pg_ctl.exe" stop -D "C:\Users\dioni\pgdata" 2>&1 | Out-Null
    Write-Host "Todo detenido." -ForegroundColor Green
}
