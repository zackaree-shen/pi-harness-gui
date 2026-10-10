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

## HTML 产出规范（技术方案 / 报告类 HTML 文档）

你产出的任何 HTML 报告 / 技术方案文档，必须遵守以下规范：

1. 视觉：GitHub-light 风格——背景 #ffffff、软灰块 #f6f8fa、正文 #1f2328、次要文字 #57606a、
   边框 #d0d7de、主蓝 #1f6feb、行内代码 #953800。单页连续流（不做卡片分节），max-width 1080px 居中，
   h1/h2 底边框分节，表格软灰表头+斑马纹。提示框：note 黄 #fff8c5 / bad 红 #ffebe9 / ok 绿 #dafbe1，
   标签 pill 蓝 #ddf4ff。深色主题用 GitHub-dark 对应色：#0d1117 / #161b22 / #e6edf3 / #8b949e /
   #30363d / 蓝 #58a6ff。禁止暖纸底、衬线标题等“清新”风，禁止 ASCII 字符画。

2. 双语切换（全文，不是只切界面）：每一段、每个表格单元格、每个提示框都写双份内容
   `<span class="zh">中文</span><span class="en">English</span>`，默认中文；右上角 EN/中文 按钮
   纯 CSS 切换：`body .en{display:none}` + `body:has(#langSwitch:checked) .zh{display:none}` +
   `body:has(#langSwitch:checked) .en{display:inline}`。

3. 深浅色切换（零 JS 硬性要求）：右上角常驻 🌙深色/☀️浅色 按钮，隐藏 checkbox + `<label for>` +
   `body:has(#themeSwitch:checked){…}` 纯 CSS 实现；CSS 变量必须挂在 body 上（不挂 :root）；
   JS 只允许做 localStorage 记忆且整体 try/catch。任何交互在 JS 被禁用时必须仍可用
   （飞书云盘预览沙箱禁脚本，纯 JS 按钮是死按钮）。按钮 label 文字用双 span 靠 CSS 换显隐。

4. 图解：用 Mermaid 语义写图，但必须预渲染成内联 SVG 嵌入（外包白底圆角卡片，深色下也可读），
   不依赖 CDN+JS 渲染。

5. 可读性优先：行高 ≥1.9，列表项间距 ≥8px，节间距留足；表格单元格多项内容拆 `<ul>` 逐条
   （禁止五六件事挤一格）；长段落改“加粗导语+子列表”；长 URL/标识符 `overflow-wrap:anywhere`；
   表格外包 `overflow-x:auto`。内容做减法，术语带大白话解释，假设读者零基础。

6. 交付前验证（必须，静态检查不算数）：无头 Chromium/Edge 渲染并逐一目检 4 个组合
   （浅/深 × 中/英，用注入 checked 属性的临时副本模拟），再渲染剥离全部 `<script>` 的版本
   确认禁 JS 时一切仍可用。图片 base64 内嵌，单文件自包含。

7. 交付方式：产出单个 .html 上传飞书云盘（`lark-cli drive +upload`，相对路径；已传过用
   `--file-token` 原地覆盖保链接）。不要创建飞书文档，除非我明确要求。
