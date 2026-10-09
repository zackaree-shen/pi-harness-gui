# pi-sync install: apply repo config (pi-sync/) to this machine's ~/.pi/agent
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
#         add -Models to overwrite/create models.json from the template
param([switch]$Models)
$ErrorActionPreference = 'Stop'

$agent = Join-Path (Join-Path $HOME '.pi') 'agent'
$src   = $PSScriptRoot

New-Item -ItemType Directory -Force (Join-Path $agent 'agents'), (Join-Path $agent 'themes') | Out-Null

# --- backup anything we are about to overwrite ---
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $agent "backup-$stamp"
$targets = @()
$targets += Get-Item (Join-Path $src 'agents\*.md')        -ErrorAction SilentlyContinue | ForEach-Object { 'agents\' + $_.Name }
$targets += Get-Item (Join-Path $src 'themes\*.json')      -ErrorAction SilentlyContinue | ForEach-Object { 'themes\' + $_.Name }
$targets += 'settings.json', 'AGENTS.md', 'workflow-settings.json' | Where-Object { Test-Path (Join-Path $src $_) }
$touched = 0
foreach ($rel in $targets) {
    $from = Join-Path $src $rel
    $to   = Join-Path $agent $rel
    if (Test-Path $to) { New-Item -ItemType Directory -Force (Join-Path $backup (Split-Path $rel)) | Out-Null; Copy-Item $to (Join-Path $backup $rel) -Force }
    Copy-Item $from $to -Force; $touched++
}
if ($touched -and (Test-Path $backup)) { Write-Host "backup of replaced files: $backup" }

# --- models.json: keep local by default (it holds real keys) ---
$modelsLocal = Join-Path $agent 'models.json'
if ($Models -or -not (Test-Path $modelsLocal)) {
    Copy-Item (Join-Path $src 'models.json.template') $modelsLocal -Force
    Write-Host 'models.json (re)created from template'
    # pi interpolates ${VAR} at request time; warn about missing vars
    foreach ($v in 'DEEPSEEK_API_KEY', 'GLM_API_KEY', 'MINIMAX_API_KEY') {
        if (-not [Environment]::GetEnvironmentVariable($v, 'User') -and -not [Environment]::GetEnvironmentVariable($v, 'Machine')) {
            Write-Warning "env var $v is not set - set it (setx $v <key>) or paste the real key into models.json"
        }
    }
} else {
    Write-Host 'models.json: local file kept (use -Models to replace from template)'
}

Write-Host "installed $touched files to $agent"
Write-Host 'restart pi sessions to pick up changes; run  pi  /model  to verify providers'
