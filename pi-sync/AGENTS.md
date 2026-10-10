# 全局规则（对所有项目生效）

## 严禁在 pi 会话内更新 pi 自身

在当前正在运行的 pi 会话里，**绝对不要**执行任何会替换 pi 安装目录的命令，包括：

- `pi update`、`pi update --all`、`pi update --extensions`
- `pi update --self`、`pi update self`、`pi update pi`
- `npm i -g @earendil-works/pi-coding-agent`、`npm install -g @earendil-works/pi-coding-agent`
- 任何直接改动 `C:\Users\Administrator\AppData\Roaming\npm\node_modules\@earendil-works\pi-coding-agent\` 的写操作

### 原因

npm 全局安装是**原地覆盖** `dist/bundle/chunks/`。chunk 文件名带内容哈希，覆盖时旧哈希文件被删除，
而当前进程的模块图仍指向旧哈希，于是下一次惰性 import 直接崩溃且**无法在会话内恢复**：

```
Error: Cannot find module '...\dist\bundle\chunks\openai-completions-XXXXXXXX.js'
       imported from ...\dist\bundle\chunks\chunk-XXXXXXXX.js
```

这个会话之后每次请求都会失败，只能杀掉进程重启 pi。

### 正确做法

不要代为执行更新。应当**告知用户**：

> pi 有新版本。请先关闭所有 pi 会话，然后在独立的 PowerShell 窗口里运行：
> ```powershell
> pi update
> pi update --extensions
> ```
> 更新完成后再重新启动 pi。

当 pi 显示 `Update Available` 或 `Package Updates Available` 时，只做转述，不执行。

## 配置变更后必须同步 pi-sync 仓库

当我在本会话（或应用户要求）修改了 `~/.pi/agent/` 下被 pi-sync 管理的配置时——即：`agents/*.md`（专家）、`settings.json`、`AGENTS.md`、`themes/*.json`、`workflow-settings.json`，以及 `models.json` 的结构性改动（新增/删除模型或提供商，不含密钥）——**不要只改本地就结束**，必须完成一轮同步：

1. 在 pi-harness-gui 仓库根目录（本机 clone 路径，如 `C:\selfDIr\Tools\pi-harness-gui` 或 `D:\LittleTools\pi-harness-gui`）执行 `powershell -NoProfile -ExecutionPolicy Bypass -File pi-sync/export.ps1`（本地 → 仓库，自动脱敏 models.json 并做泄密扫描；扫描失败必须停下修复，不许跳过）
2. `git fetch origin`，如有新提交用 `git pull --rebase --autostash`（保护仓库里用户未提交的 WIP）
3. 只 `git add pi-sync`，绝不带入仓库里其他未提交改动
4. `git commit -m "sync(pi-sync): <改了什么> [skip ci]"`（配置提交跳过 CI）
5. `git push origin dev`（该仓库已配置 `core.sshCommand` 使用 github_clone_key，直接 push 即可；若遇 `Connection closed by remote host` 等瞬时网络错误，重试最多 3 次）

安全红线：真实 API key 永不进仓库；推送前 export.ps1 的泄密扫描必须通过；不确定是否属于同步范围时，问用户。
