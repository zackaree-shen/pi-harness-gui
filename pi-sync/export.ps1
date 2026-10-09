# pi-sync export: push local ~/.pi/agent config into this repo folder (pi-sync/)
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File export.ps1
# Then:   git add pi-sync && git commit -m "sync: <note>" && git push
$ErrorActionPreference = 'Stop'

$agent = Join-Path (Join-Path $HOME '.pi') 'agent'
$dst   = $PSScriptRoot
if (-not (Test-Path (Join-Path $agent 'settings.json'))) { throw "no pi config found at $agent" }

# --- 1. copy safe items (local -> repo) ---
New-Item -ItemType Directory -Force (Join-Path $dst 'agents'), (Join-Path $dst 'themes') | Out-Null
Copy-Item (Join-Path $agent 'agents\*.md')               (Join-Path $dst 'agents\') -Force
Copy-Item (Join-Path $agent 'themes\*.json')             (Join-Path $dst 'themes\') -Force
foreach ($f in 'settings.json', 'AGENTS.md', 'workflow-settings.json') {
    Copy-Item (Join-Path $agent $f) (Join-Path $dst $f) -Force
}
Write-Host "copied: agents, themes, settings.json, AGENTS.md, workflow-settings.json"

# --- 2. models.json -> sanitized template (NEVER commit raw keys) ---
# Provider name -> environment variable that holds the real key on each machine.
# pi natively supports ${VAR} interpolation in apiKey fields.
$keyMap = @{ 'deepseek' = 'DEEPSEEK_API_KEY'; 'glm' = 'GLM_API_KEY'; 'cc-switch-mini-max' = 'MINIMAX_API_KEY' }
$modelsPath = Join-Path $agent 'models.json'
if (Test-Path $modelsPath) {
    $m = Get-Content $modelsPath -Raw | ConvertFrom-Json
    foreach ($p in $m.providers.PSObject.Properties) {
        if ($p.Value.apiKey) {
            if (-not $keyMap.ContainsKey($p.Name)) {
                throw "provider '$($p.Name)' has an apiKey but no env-var mapping. Add it to `$keyMap or clear the key first."
            }
            $p.Value.apiKey = '${' + $keyMap[$p.Name] + '}'
        }
    }
    [IO.File]::WriteAllText((Join-Path $dst 'models.json.template'), ($m | ConvertTo-Json -Depth 32))
    Write-Host "wrote models.json.template (keys replaced with env-var placeholders)"
}

# --- 3. secret scan: abort if any raw key pattern survives ---
$pattern = 'sk-[A-Za-z0-9_-]{8,}|["'']apiKey["'']\s*:\s*["''][^$]'
$hits = Get-ChildItem $dst -Recurse -File | Select-String -Pattern $pattern
if ($hits) { $hits | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber) $($_.Line.Trim())" }; throw 'SECRET SCAN FAILED - fix above before committing' }
Write-Host 'secret scan: clean'

Write-Host "`nNext: git add pi-sync; git commit; git push"
