$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path (Join-Path $repoRoot "storage") "planning-autopublish.pid"

if (-not (Test-Path $pidPath)) {
  Write-Output "planning autopublish is not running."
  exit 0
}

$pidValue = Get-Content -Path $pidPath -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pidValue -match '^\d+$') {
  $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id ([int]$pidValue) -Force
  }
}

Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
Write-Output "Stopped planning autopublish."
