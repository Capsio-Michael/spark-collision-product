[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 8000,
    [string]$Model = 'kimi-k2.5',
    [string]$Database = 'var/kimi-live.db'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
$pythonPath = if ($pythonCommand) { $pythonCommand.Source } else {
    Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
}
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Python was not found. Install Python 3 or use the bundled Codex runtime.' }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $Port is occupied. Stop the old engine first, or use -Port with a free port."
}

Write-Host 'Kimi China / model:' $Model
Write-Host 'Paste your API key at the hidden prompt. It will not be saved to a file or command history.'
Write-Host 'Keep this terminal open while testing. Stop the server with Ctrl+C.'
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
