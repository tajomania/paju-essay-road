$ErrorActionPreference = 'Stop'
$taskData = if ($env:LOCAL_DATA_DIR) { $env:LOCAL_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'PajuEssayRoad' }
$taskPidFile = Join-Path $taskData 'server.pid'
if (Test-Path -LiteralPath $taskPidFile) {
    $taskServerPid = [int](Get-Content -LiteralPath $taskPidFile)
    $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskServerPid"
    $taskExpectedServer = Join-Path $PSScriptRoot 'server.mjs'
    if ($taskProcess -and $taskProcess.Name -eq 'node.exe' -and $taskProcess.CommandLine.Contains($taskExpectedServer)) { Stop-Process -Id $taskServerPid }
}
