param(
  [ValidateSet('production', 'staging')]
  [string]$Env = 'production'
)

Write-Host "Building frontend for $Env..."
Set-Location -Path (Join-Path $PSScriptRoot '..\frontend')
npm run build -- --mode $Env

Write-Host "Build complete. Output in frontend/dist/"
Write-Host "To deploy with Docker:"
Write-Host "  cd backend && docker compose up -d --build"
