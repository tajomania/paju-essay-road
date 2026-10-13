param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskData = if ($env:LOCAL_DATA_DIR) { $env:LOCAL_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'PajuEssayRoad' }
New-Item -ItemType Directory -Path $taskData -Force | Out-Null
$taskNode = Join-Path $taskRoot 'runtime\node.exe'
if (-not (Test-Path -LiteralPath $taskNode)) { $taskNode = (Get-Command node -ErrorAction Stop).Source }
$taskPort = if ($env:LOCAL_PORT) { $env:LOCAL_PORT } else { '8788' }
$taskProtocol = if ($env:LOCAL_TLS_CERT -and $env:LOCAL_TLS_KEY) { 'https' } else { 'http' }
$taskUrl = "$($taskProtocol)://localhost:$taskPort"
$taskHealthUrl = if ($taskProtocol -eq 'http') { "http://127.0.0.1:$taskPort/api/health" } else { "$taskUrl/api/health" }
try { $taskHealth = Invoke-RestMethod -Uri $taskHealthUrl -TimeoutSec 5 } catch { $taskHealth = $null }
if (-not ($taskHealth.ok -and $taskHealth.local -and $taskHealth.app -eq 'paju-essay-road')) {
    $taskServer = Join-Path $PSScriptRoot 'server.mjs'
    Start-Process -FilePath $taskNode -ArgumentList ('"{0}"' -f $taskServer) -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskData 'server.log') -RedirectStandardError (Join-Path $taskData 'server-error.log')
    for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
        Start-Sleep -Milliseconds 500
        try { $taskHealth = Invoke-RestMethod -Uri $taskHealthUrl -TimeoutSec 5; if ($taskHealth.ok -and $taskHealth.local -and $taskHealth.app -eq 'paju-essay-road') { break } } catch {}
    }
}
if (-not ($taskHealth.ok -and $taskHealth.local -and $taskHealth.app -eq 'paju-essay-road')) { throw '서버를 시작하지 못했습니다. 사용 안내문의 포트 및 로그 확인 절차를 참고하세요.' }
if (-not $NoBrowser) { Start-Process $taskUrl }
