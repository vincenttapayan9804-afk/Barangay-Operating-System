param(
  [Parameter(Mandatory)]
  [string]$ArtifactZip
)

$ErrorActionPreference = "Stop"
$TempDir = Join-Path $env:TEMP "barangay-deploy-$(Get-Random)"

try {
  Write-Host "Extracting artifact..."
  Expand-Archive -Path $ArtifactZip -DestinationPath $TempDir -Force

  Write-Host "Building Docker images..."
  Set-Location -Path (Join-Path $PSScriptRoot '..\backend')
  docker compose build

  Write-Host "Restarting services..."
  docker compose down
  docker compose up -d

  Start-Sleep -Seconds 5
  $response = Invoke-RestMethod -Uri "http://localhost:8090/api/health" -ErrorAction Stop
  if ($response.code -eq 200) {
    Write-Host "Deploy successful. PocketBase is healthy."
    Write-Host "Frontend: http://localhost:8080"
    Write-Host "Admin:    http://localhost:8090/_/"
  }
}
finally {
  if (Test-Path $TempDir) { Remove-Item -Path $TempDir -Recurse -Force }
}
