# 原生分层二维动画工作台

从仓库根安装 Node.js 22 依赖后，再安装本工具依赖：

```bash
npm ci --prefix tools/see-through-workbench
npm run dev --prefix tools/see-through-workbench
```

编辑器地址 `http://127.0.0.1:5182/?demo=1`；引擎端口示例为 `/engine.html`。`public/art/index.json` 登记内置示例，`.stretch` 内含模型与贴图。当前猫样例仍待人工审核，不代表已经接入 Game112。

```bash
npm test --prefix tools/see-through-workbench
npm run build --prefix tools/see-through-workbench
npm run audit --prefix tools/see-through-workbench
```

浏览器审计需先在根目录执行 `npx playwright install chromium` 并保持开发服务运行；也可用 `CHROME_PATH` 指定自己机器的浏览器。审计默认使用 Playwright 浏览器，不绑定原开发机的 macOS 路径。静态服务启动器 `macos/Open-Animation.command`、`windows/Open-Animation.cmd` 读取 `dist/`，首次从 Git 克隆后须先构建。

仅查看、编辑和播放现有示例无需 Python 或下载模型。重新推理整图分层时使用独立 Python 3.12 环境：Apple Silicon Mac 运行 `macos/Install.command`，Windows NVIDIA 机器运行 `windows/Install.cmd`。安装器会下载 PyTorch 与上游依赖；模型权重首次推理时下载至 `workspace/hf-cache`。本机曾验证 MPS 推理；CUDA 安装路径已准备，但未在目标 Windows 4090 机器实测。

`workspace/`、Python 虚拟环境、`node_modules/`、`dist/`、模型缓存和可重建的打包 ZIP 均不上传。Game112 的私有候选母图和队列另在游戏工作树的 `art-local/`，也不在此工具中。

上游源码保留于 `vendor/`；来源、版本、样例来源及已知边界见 `source.json`。See-through 使用 Apache-2.0（`vendor/see-through/LICENSE`），Stretchy Studio 使用 MIT（`vendor/stretchystudio/LICENSE`）；`upstream-files.json` 用于字节级核对。预训练权重未捆绑，下载与使用遵循各模型自身条款。本工具不是 Live2D Cubism SDK，也不宣称兼容 `.moc3`。
