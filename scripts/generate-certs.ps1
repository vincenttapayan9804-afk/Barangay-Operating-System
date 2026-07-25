<#
.SYNOPSIS
  Generate mkcert certificates for LAN HTTPS access to BarangayOS.
.DESCRIPTION
  Creates a certificate for your server's LAN IP so the site can be served
  over HTTPS inside the local network — required for PWA installation.

  What this does:
    1. Checks if mkcert is installed (installs via winget if missing)
    2. Detects your primary LAN IPv4 address
    3. Generates certs for that IP + localhost + 127.0.0.1
    4. Places them in backend/certs/ so nginx picks them up

  After running, rebuild and restart:
      cd backend
      docker compose up -d --build

  Access the app at https://<LAN_IP>:8443
  Each device that needs PWA install must trust the mkcert root CA once
  (visit https://<LAN_IP>:8443 and accept the warning, or run mkcert -install
   on each machine).
#>

$CertsDir = Join-Path $PSScriptRoot '..' 'backend' 'certs' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $CertsDir) {
    $CertsDir = Join-Path $PSScriptRoot '..' 'backend' 'certs'
}
$null = New-Item -ItemType Directory -Force -Path $CertsDir

# ── 1. Ensure mkcert is installed ──────────────────────────────────────────
$mkcert = Get-Command 'mkcert' -ErrorAction SilentlyContinue
if (-not $mkcert) {
    Write-Host "mkcert not found. Installing via winget…" -ForegroundColor Yellow
    try {
        winget install FiloSottile.mkcert -e --accept-package-agreements
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'User') + ";$env:Path"
        $mkcert = Get-Command 'mkcert' -ErrorAction SilentlyContinue
    } catch {
        Write-Error "Failed to install mkcert. Install manually from https://github.com/FiloSottile/mkcert/releases"
        exit 1
    }
}

if (-not $mkcert) {
    Write-Error "mkcert still not found after install. Restart your terminal or add it to PATH manually."
    exit 1
}

Write-Host "✓ mkcert found: $($mkcert.Source)" -ForegroundColor Green

# ── 2. Install local CA (one-time) ──────────────────────────────────────────
Write-Host "Installing mkcert root CA…" -ForegroundColor Cyan
& $mkcert.Source -install
if ($LASTEXITCODE -ne 0) {
    Write-Error "mkcert -install failed. Try running as Administrator."
    exit 1
}
Write-Host "✓ Root CA installed" -ForegroundColor Green

# ── 3. Detect LAN IP ──────────────────────────────────────────────────────
$lanIp = $null
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceOperationalStatus -eq 'Up' }
foreach ($adapter in $adapters) {
    $ip = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
          Where-Object { $_.IPAddress -notmatch '^127\.|^169\.254\.' }
    if ($ip) {
        $lanIp = $ip.IPAddress
        break
    }
}

if (-not $lanIp) {
    Write-Error "Could not detect a LAN IP. Specify it manually with: .\generate-certs.ps1 -LanIp 192.168.1.100"
    exit 1
}

Write-Host "✓ Detected LAN IP: $lanIp" -ForegroundColor Green

# ── 4. Generate certs ─────────────────────────────────────────────────────
$certName = "${lanIp}-local"
Write-Host "Generating certificate for $lanIp, localhost, 127.0.0.1…" -ForegroundColor Cyan
Push-Location $CertsDir
try {
    & $mkcert.Source -cert-file cert.pem -key-file cert-key.pem $lanIp localhost 127.0.0.1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Certificate generation failed."
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host "`n✓ Certificates created in: $CertsDir" -ForegroundColor Green
Write-Host "  - cert.pem" -ForegroundColor Green
Write-Host "  - cert-key.pem" -ForegroundColor Green

Write-Host "`n── Next steps ─────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "1. Rebuild and restart the stack:"
Write-Host "   cd $(Resolve-Path (Join-Path $PSScriptRoot '..' 'backend'))"
Write-Host "   docker compose up -d --build"
Write-Host ""
Write-Host "2. Access the app at: https://${lanIp}:8443"
Write-Host ""
Write-Host "3. On each device that needs PWA install, visit the URL once"
Write-Host "   and accept the certificate warning (or install mkcert there too)."
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Cyan
