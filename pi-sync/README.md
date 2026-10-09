# pi-sync — pi agent 配置多机同步

像 [dsh-zackary](../README.md) 之于 DSH Desktop 一样，这个目录把 `~/.pi/agent` 的个人配置同步到所有电脑。

## 同步什么

| 内容 | 位置（本仓库 → 本机）|
|---|---|
| 8 个专家子智能体 | `pi-sync/agents/*.md` → `~/.pi/agent/agents/` |
| 默认模型/主题/包列表 | `pi-sync/settings.json` → `~/.pi/agent/settings.json` |
| 全局规则（AGENTS.md）| `pi-sync/AGENTS.md` → `~/.pi/agent/AGENTS.md` |
| 自定义主题（matrix 等）| `pi-sync/themes/*.json` → `~/.pi/agent/themes/` |
| 工作流配置 | `pi-sync/workflow-settings.json` → `~/.pi/agent/workflow-settings.json` |
| 模型提供商（**脱敏模板**）| `pi-sync/models.json.template` → `~/.pi/agent/models.json` |

**永不同步**（红线）：`models.json` 原文（含真实 API key）、`auth.json`、`trust.json`、`sessions/`、`web-search-cache/`、`npm/`、`install/`、`bin/`、`pi-subagents/`、`models-store.json`、扩展目录里的 `node_modules/`。

## 新电脑安装（一次性）

```powershell
git clone -b dev git@github.com:zackaree-shen/pi-harness-gui.git
cd pi-harness-gui\pi-sync
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
# 首次会从模板生成 models.json，然后二选一：
#   A. 设环境变量（推荐，pi 原生支持 ${VAR} 插值）：
setx DEEPSEEK_API_KEY "sk-..."
setx GLM_API_KEY "..."
setx MINIMAX_API_KEY "..."
#   B. 或直接把真实 key 粘进 ~/.pi/agent/models.json（它不会回写进仓库）
```

## 日常同步流

```text
改了配置（新增专家/换默认模型/改主题）后，在任一机器：
  pi-sync/export.ps1   # 本地 → 仓库（自动脱敏 models.json + 泄密扫描，扫到真实 key 直接报错拒跑）
  git add pi-sync && git commit -m "sync: ..." && git push

其他机器：
  git pull
  pi-sync/install.ps1  # 仓库 → 本机（覆盖前自动备份到 ~/.pi/agent/backup-<时间戳>/）
```

## 安全边界（继承 dsh-sync 规则）

1. `export.ps1` 内置泄密扫描（`sk-` 前缀 & 裸 `apiKey` 值），扫描不过会 **throw 拒绝**，不许提交
2. 新增模型提供商时，必须同步在 `export.ps1` 的 `$keyMap` 里登记 provider → 环境变量映射，否则导出会报错
3. `install.ps1` 默认**不动**本机已有的 `models.json`（保护本地真实 key），显式 `-Models` 才覆盖
4. 提交前人工 `git status --short` 复查，别把仓库无关文件带进来
