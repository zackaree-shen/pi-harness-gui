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
