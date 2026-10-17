[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 8000,
    [string]$Model = 'kimi-k2.6',
    [string]$Database = 'var/kimi-live.db',
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bundledPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$candidates = @($bundledPython)
foreach ($commandName in @('python', 'python3')) {
    $candidates += @(Get-Command $commandName -CommandType Application -All -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
}
$pythonPath = $null
foreach ($candidate in ($candidates | Select-Object -Unique)) {
    # WindowsApps may resolve to an installation shortcut, not a working Python.
    if (-not $candidate -or $candidate -match '\\WindowsApps\\' -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    try {
        & $candidate -X utf8 -c 'import sys, sqlite3; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $pythonPath = $candidate; break }
    } catch { continue }
}
if (-not $pythonPath) { throw 'No working Python 3.10+ was found. Install Python or restore the bundled Codex runtime before entering your API key.' }
Write-Host 'Python:' $pythonPath
if ($CheckOnly) {
    & $pythonPath -X utf8 --version
    Write-Host 'Runtime check passed. No API key was requested and no server was started.'
    return
}
$portProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $portProbe.Start()
} catch {
    throw "Port $Port is occupied. Stop the old engine first, or use -Port with a free port."
} finally {
    $portProbe.Stop()
}

Write-Host 'Kimi China / model:' $Model
Write-Host 'Paste your API key at the hidden prompt. It will not be saved to a file or command history.'
Write-Host 'Keep this terminal open while testing. Stop the server with Ctrl+C.'
Write-Host 'Startup checks the available model list before opening the local API.'
$secureKey = Read-Host 'Kimi API Key (hidden)' -AsSecureString
$names = @('SPARK_CHAT_PROVIDER', 'SPARK_KIMI_BASE_URL', 'SPARK_KIMI_MODEL', 'SPARK_KIMI_API_KEY')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$keyPointer = [IntPtr]::Zero
Push-Location -LiteralPath $projectRoot
try {
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $env:SPARK_KIMI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer).Trim()
    if ([string]::IsNullOrWhiteSpace($env:SPARK_KIMI_API_KEY)) { throw 'API key cannot be empty.' }
    $env:SPARK_CHAT_PROVIDER = 'kimi'
    $env:SPARK_KIMI_BASE_URL = 'https://api.moonshot.cn/v1'
    $env:SPARK_KIMI_MODEL = $Model
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    $keyPointer = [IntPtr]::Zero
    & $pythonPath -X utf8 -m engine.server --port $Port --db $Database
    if ($LASTEXITCODE -ne 0) { throw "Engine exited with code $LASTEXITCODE." }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    if ($keyPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer) }
    $secureKey.Dispose()
    Pop-Location
}
