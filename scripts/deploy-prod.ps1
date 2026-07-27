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
  Set-Location -Path (Join-Path $PSScriptRoot '..\backend\supabase')
  docker compose build

  Write-Host "Restarting services..."
  docker compose down
  docker compose up -d

  Start-Sleep -Seconds 5
  # Hits GoTrue's own published port directly (127.0.0.1:9999 in
  # docker-compose.yml), not through Kong — every route behind Kong
  # requires an apikey header, which a plain health probe doesn't send.
  Invoke-RestMethod -Uri "http://localhost:9999/health" -ErrorAction Stop | Out-Null
  Write-Host "Deploy successful. Auth (GoTrue) is healthy."
  Write-Host "Frontend: http://localhost:8080"
}
finally {
  if (Test-Path $TempDir) { Remove-Item -Path $TempDir -Recurse -Force }
}
