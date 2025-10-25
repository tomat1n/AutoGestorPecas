# AutoGestorPecas: Watch and Auto Push to GitHub (PowerShell)
param(
  [string]$Path = "c:\Users\waler\Desktop\AutoGestorPecas",
  [string]$Branch = "main"
)

Write-Host "Starting watcher on: $Path (branch: $Branch)" -ForegroundColor Green

# Ensure git user is configured (optional)
try {
  git -C $Path config user.name | Out-Null
} catch {
  git -C $Path config user.name "AutoGestor Bot" | Out-Null
}
try {
  git -C $Path config user.email | Out-Null
} catch {
  git -C $Path config user.email "autogestor@local" | Out-Null
}

# Setup file system watcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $Path
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

function Push-Changes {
  param([string]$Reason)
  try {
    Start-Sleep -Milliseconds 600
    git -C $Path add -A
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $msg = "Auto push: $timestamp ($Reason)"
    # commit may fail if nothing changed
    git -C $Path commit -m $msg 2>$null | Out-Null
    git -C $Path push origin $Branch | Out-Null
    Write-Host "[$timestamp] Pushed ($Reason)" -ForegroundColor Cyan
  } catch {
    Write-Host "Push failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

# Register events
Register-ObjectEvent $watcher Changed -SourceIdentifier FileChanged -Action { Push-Changes -Reason "Changed" } | Out-Null
Register-ObjectEvent $watcher Created -SourceIdentifier FileCreated -Action { Push-Changes -Reason "Created" } | Out-Null
Register-ObjectEvent $watcher Deleted -SourceIdentifier FileDeleted -Action { Push-Changes -Reason "Deleted" } | Out-Null
Register-ObjectEvent $watcher Renamed -SourceIdentifier FileRenamed -Action { Push-Changes -Reason "Renamed" } | Out-Null

Write-Host "Watching for file changes. Press Ctrl+C to stop." -ForegroundColor Green

# Keep the script running
while ($true) {
  Start-Sleep -Seconds 2
}