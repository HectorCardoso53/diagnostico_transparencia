# =============================================================
#  Sistema de Diagnóstico das Secretarias
#  Script de inicializacao do ambiente de desenvolvimento
#  Uso: .\iniciar.ps1
# =============================================================

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

function Write-Step($msg) {
    Write-Host "`n>> $msg" -ForegroundColor Cyan
}

function Write-OK($msg) {
    Write-Host "   [OK] $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "   [ERRO] $msg" -ForegroundColor Red
}

# =============================================================
#  1. Docker Desktop
# =============================================================
Write-Step "Verificando Docker Desktop..."

$dockerRunning = $false
try {
    docker info 2>$null | Out-Null
    $dockerRunning = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $dockerRunning) {
    Write-Host "   Docker nao esta rodando. Iniciando Docker Desktop..." -ForegroundColor Yellow
    $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerExe) {
        Start-Process $dockerExe
    } else {
        Write-Fail "Docker Desktop nao encontrado em '$dockerExe'. Abra manualmente."
        exit 1
    }

    Write-Host "   Aguardando Docker inicializar (ate 90 segundos)..." -ForegroundColor Yellow
    $timeout = 90
    $elapsed = 0
    do {
        Start-Sleep -Seconds 5
        $elapsed += 5
        try { docker info 2>$null | Out-Null } catch {}
        $dockerRunning = ($LASTEXITCODE -eq 0)
        Write-Host "   ...${elapsed}s" -ForegroundColor DarkGray
    } while (-not $dockerRunning -and $elapsed -lt $timeout)

    if (-not $dockerRunning) {
        Write-Fail "Docker nao inicializou a tempo. Tente abrir o Docker Desktop manualmente."
        exit 1
    }
}

Write-OK "Docker Desktop esta rodando."

# =============================================================
#  2. Container PostgreSQL
# =============================================================
Write-Step "Iniciando container do PostgreSQL..."

Set-Location $Root
docker compose up -d postgres 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Falha ao iniciar o container. Verifique o docker-compose.yml."
    exit 1
}

Write-Host "   Aguardando PostgreSQL ficar pronto..." -ForegroundColor Yellow
$pgReady = $false
for ($i = 0; $i -lt 12; $i++) {
    Start-Sleep -Seconds 3
    $check = docker exec diag_postgres pg_isready -U postgres 2>&1
    if ($check -match "accepting connections") {
        $pgReady = $true
        break
    }
}

if (-not $pgReady) {
    Write-Fail "PostgreSQL nao ficou pronto a tempo."
    exit 1
}

Write-OK "PostgreSQL esta aceitando conexoes."

# =============================================================
#  3. Migrations do Prisma
# =============================================================
Write-Step "Aplicando migrations do Prisma..."

# Carrega variaveis do .env raiz (se existir)
$envFile = Join-Path $Root ".env"
$pgDb   = "diagnostico"
$pgUser = "postgres"
$pgPass = "postgres"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $k = $Matches[1].Trim(); $v = $Matches[2].Trim()
            if ($k -eq "POSTGRES_DB")       { $pgDb   = $v }
            if ($k -eq "POSTGRES_USER")     { $pgUser = $v }
            if ($k -eq "POSTGRES_PASSWORD") { $pgPass = $v }
        }
    }
}

$env:DATABASE_URL = "postgresql://${pgUser}:${pgPass}@localhost:5432/${pgDb}?schema=public"

Set-Location $Backend
$migrateOut = npx prisma migrate deploy 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Erro ao aplicar migrations:`n$migrateOut"
    exit 1
}
Write-OK "Migrations aplicadas."

# =============================================================
#  4. Backend — NestJS (janela separada)
# =============================================================
Write-Step "Iniciando Backend (NestJS)..."

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Backend'; Write-Host '[BACKEND] NestJS iniciando...' -ForegroundColor Cyan; npm run start:dev"
) -WindowStyle Normal

Write-OK "Backend iniciando na porta 3001 (nova janela)."

# =============================================================
#  5. Frontend — Next.js (janela separada)
# =============================================================
Write-Step "Iniciando Frontend (Next.js)..."

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Frontend'; Write-Host '[FRONTEND] Next.js iniciando...' -ForegroundColor Magenta; npm run dev -- --port 3003"
) -WindowStyle Normal

Write-OK "Frontend iniciando na porta 3003 (nova janela)."

# =============================================================
#  Resumo
# =============================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor White
Write-Host "  Ambiente iniciado com sucesso!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor White
Write-Host "  Frontend  -> http://localhost:3003" -ForegroundColor White
Write-Host "  Backend   -> http://localhost:3001/api" -ForegroundColor White
Write-Host "  Banco     -> localhost:5432 (diag_postgres)" -ForegroundColor White
Write-Host ""
Write-Host "  Login: admin@sistema.gov.br / senha123" -ForegroundColor DarkGray
Write-Host "=============================================" -ForegroundColor White
Write-Host ""
