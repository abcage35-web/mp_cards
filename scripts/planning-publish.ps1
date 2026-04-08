param(
  [string]$Remote = "planning",
  [string]$Branch = "main",
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
  throw "This script must be run inside a git repository."
}

git remote get-url $Remote *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Git remote '$Remote' is not configured."
}

$statusBefore = git status --porcelain
if (-not $statusBefore) {
  Write-Output "No changes to publish."
  exit 0
}

git add -A

$stagedChanges = git diff --cached --name-only
if (-not $stagedChanges) {
  Write-Output "No staged changes to publish."
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "planning auto publish $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

git commit -m $Message
if ($LASTEXITCODE -ne 0) {
  throw "git commit failed."
}

git push $Remote HEAD:$Branch
if ($LASTEXITCODE -ne 0) {
  throw "git push failed."
}

Write-Output "Published to $Remote/$Branch."
