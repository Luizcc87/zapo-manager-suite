param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$port = 8080
$healthUrl = "http://127.0.0.1:$port/"

function Test-BackendReady {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json'))) {
  throw "ProjectRoot does not contain package.json: $ProjectRoot"
}

if (-not (Test-BackendReady)) {
  if (-not $NoLaunch) {
    $command = "Set-Location -LiteralPath '$ProjectRoot'; npm run dev:backend"
    Start-Process -FilePath powershell.exe -ArgumentList @(
      '-NoExit',
      '-ExecutionPolicy', 'Bypass',
      '-Command', $command
    ) | Out-Null
  }

  $deadline = (Get-Date).AddMinutes(2)
  while (-not (Test-BackendReady)) {
    if ((Get-Date) -gt $deadline) {
      throw "Backend at $healthUrl did not become ready within 2 minutes."
    }
    Start-Sleep -Seconds 2
  }
}

Write-Output "Backend ready at $healthUrl"
