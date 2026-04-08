param(
  [string]$Remote = "planning",
  [string]$Branch = "main",
  [int]$DebounceSeconds = 6
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$storageDir = Join-Path $repoRoot "storage"
$pidPath = Join-Path $storageDir "planning-autopublish.pid"
$scriptPath = Join-Path $PSScriptRoot "planning-autopublish.ps1"

New-Item -ItemType Directory -Force -Path $storageDir | Out-Null

if (Test-Path $pidPath) {
  $existingPid = Get-Content -Path $pidPath -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingPid -match '^\d+$') {
    $process = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
    if ($process) {
      Write-Output "planning autopublish is already running (PID $existingPid)."
      exit 0
    }
  }

  Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
}

$arguments = @(
  "-NoLogo",
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $scriptPath,
  "-Remote", $Remote,
  "-Branch", $Branch,
  "-DebounceSeconds", $DebounceSeconds
)

$process = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru

Write-Output "Started planning autopublish (PID $($process.Id))."
