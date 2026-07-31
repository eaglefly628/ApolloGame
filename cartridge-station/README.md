# Cartridge Station

ZeroCraft 掌机**卡带包**的预览 / 管理 / 打包工具。**独立工具**——不依赖引擎或游戏代码，
只用 Python 标准库（与掌机 `start.sh` 的 `python3 -m http.server` 同栈，RK3562 上也能跑）。

## 运行

```sh
cd cartridge-station
python3 serve.py
```

浏览器会自动打开 `http://127.0.0.1:8777`（端口可用 `PORT=9000 python3 serve.py` 改）。

## 包格式

一个卡带包 = `<name>.tar.gz`，解开后：

```
cartridge.html   ZeroCraft OS 掌机壳（入口）
assets/          Vite 构建的 JS / 字体 / 美术
start.sh         python3 http.server + chromium --kiosk 启动脚本
```

包名形如 `apollo-game-g-rk3562.tar.gz` → 自动解析出 游戏代号 `g` / 硬件 `rk3562`。
> 若后续有**其它格式**，在 `serve.py` 的 `add_package()` / `parse_meta()` 里扩展即可。

## 三个命令按钮

| 按钮 | 作用 |
|---|---|
| ➕ **添加包** | 选择 / 拖入 `.tar.gz` → 解包入库（`library/<id>/`） |
| ➖ **移除** | 从库删除（先 Shift+点 或 右键 多选） |
| 📦 **打包新 OS** | 永远输出**单 HTML**（与输入 OS 同格式）：内置游戏保留 + 每个游戏内联为 `pgame.html` + 按键 shim。游戏须**单文件构建**（`npm run build:cartridge:single`）才能跑；多文件会警告（只内联了壳）。 |

- **预览**：点卡带 → 右侧「▶ 启动」用 iframe 真启动 `cartridge.html`。
- **多选**：Shift/Ctrl/⌘+点 或 右键，用于移除 / 打包。

## 按键映射子菜单

顶部「🎛 按键映射」标签 = 掌机六键方案（源自 CartridgeOS PICO-8 布局）：

```
↑↓←→ + O(确认) + X(取消) + START + SELECT + MENU
```

每个按钮可编辑 键盘 `e.code` 与 手柄按钮索引，保存到 `keymap.json`。

## 目录

```
cartridge-station/
├── serve.py        # 后端（stdlib http server + tar 解/打包）
├── web/            # 前端 UI（index.html / app.js / style.css）
├── library/        # 解包后的卡带（git 忽略内容，保留目录）
├── keymap.json     # 按键映射（首次保存后生成）
└── README.md
```
