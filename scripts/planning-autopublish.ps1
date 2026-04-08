param(
  [string]$Remote = "planning",
  [string]$Branch = "main",
  [int]$DebounceSeconds = 6
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$storageDir = Join-Path $repoRoot "storage"
$pidPath = Join-Path $storageDir "planning-autopublish.pid"
$logPath = Join-Path $storageDir "planning-autopublish.log"
$publishScript = Join-Path $PSScriptRoot "planning-publish.ps1"

New-Item -ItemType Directory -Force -Path $storageDir | Out-Null
Set-Content -Path $pidPath -Value $PID -Encoding ascii

$script:pendingAt = $null
$script:isPublishing = $false
function Register-WatcherEvent {
  param(
    [System.IO.FileSystemWatcher]$Watcher,
    [string]$EventName
  )

  Register-ObjectEvent -InputObject $Watcher -EventName $EventName -Action {
    $path = $Event.SourceEventArgs.FullPath
    if ([string]::IsNullOrWhiteSpace($path)) {
      return
    }

    if ($path -match '\\(\.git|node_modules|dist|storage)(\\|$)') {
      return
    }

    $script:pendingAt = Get-Date
  } | Out-Null
}

$watcher = [System.IO.FileSystemWatcher]::new($repoRoot)
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, DirectoryName, LastWrite, CreationTime, Size'

Register-WatcherEvent -Watcher $watcher -EventName "Changed"
Register-WatcherEvent -Watcher $watcher -EventName "Created"
Register-WatcherEvent -Watcher $watcher -EventName "Deleted"
Register-WatcherEvent -Watcher $watcher -EventName "Renamed"

"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] planning autopublish watcher started" | Out-File -FilePath $logPath -Append -Encoding utf8

try {
  while ($true) {
    Start-Sleep -Seconds 2

    if ($script:isPublishing -or -not $script:pendingAt) {
      continue
    }

    if (((Get-Date) - $script:pendingAt).TotalSeconds -lt $DebounceSeconds) {
      continue
    }

    $script:isPublishing = $true

    try {
      $message = "planning auto publish $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
      & $publishScript -Remote $Remote -Branch $Branch -Message $message *>> $logPath
    } catch {
      "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $($_.Exception.Message)" | Out-File -FilePath $logPath -Append -Encoding utf8
    } finally {
      $script:pendingAt = $null
      $script:isPublishing = $false
    }
  }
} finally {
  Get-EventSubscriber | Unregister-Event -Force -ErrorAction SilentlyContinue
  if (Test-Path $pidPath) {
    Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
  }
}
