# PPMS Appointment Reminder - Windows Task Scheduler Setup
# Run this script once as Administrator to register the reminder job.
# The job will fire every 5 minutes and send 24h and 1h ahead reminders.
#
# Usage:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#   .\scripts\setup-reminders-scheduler.ps1

param(
    [string]$ProjectPath = $PSScriptRoot + "\..",
    [string]$TaskName    = "PPMS Appointment Reminders"
)

$ProjectPath = Resolve-Path $ProjectPath

$action  = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c cd /d `"$ProjectPath`" && npm run reminders >> `"$ProjectPath\logs\reminders.log`" 2>&1" `
    -WorkingDirectory $ProjectPath

$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 5) -Once -At (Get-Date)

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Create the logs directory if it doesn't exist
$logsDir = Join-Path $ProjectPath "logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

# Register (or update) the task
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task: $TaskName"
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action   $action `
    -Trigger  $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force | Out-Null

Write-Host ""
Write-Host "Task registered: $TaskName"
Write-Host "  Runs every 5 minutes"
Write-Host "  Sends 24h and 1h reminders for confirmed appointments"
Write-Host "  Logs: $logsDir\reminders.log"
Write-Host ""
Write-Host "To verify: Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "To remove: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
