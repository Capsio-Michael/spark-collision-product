$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $previewNode = $nodeCommand.Source
} else {
    $previewNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $previewNode)) {
    throw '需要可用的 Node.js 运行时。请安装 Node.js 后运行 npm run dev。'
}
& $previewNode (Join-Path $PSScriptRoot 'scripts\dev-server.mjs')
