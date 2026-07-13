param(
  [ValidateSet('api', 'ui', 'all', 'real')]
  [string]$Mode = 'all',

  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json'))) {
  throw "ProjectRoot does not contain package.json: $ProjectRoot"
}

$commands = switch ($Mode) {
  'api'  { @('test:manager:api') }
  'ui'   { @('test:manager:ui') }
  'all'  { @('test:manager') }
  'real' { @('test:smoke:real') }
}

$results = @()
foreach ($scriptName in $commands) {
  Push-Location $ProjectRoot
  try {
    $started = Get-Date
    & npm run $scriptName
    $exit = $LASTEXITCODE
    $results += [pscustomobject]@{
      script = $scriptName
      exitCode = $exit
      startedAt = $started.ToString('o')
      finishedAt = (Get-Date).ToString('o')
    }
    if ($exit -ne 0) {
      break
    }
  } finally {
    Pop-Location
  }
}

$failed = $results | Where-Object { $_.exitCode -ne 0 } | Select-Object -First 1
$summary = [pscustomobject]@{
  ok = -not $failed
  mode = $Mode
  projectRoot = $ProjectRoot
  results = $results
}

$summary | ConvertTo-Json -Depth 5
if ($failed) {
  exit $failed.exitCode
}
