# Apollo 平台离线打包 · Spec（owner 2026-07-26 拍板·~1 周）

> **目标**：把**整套创作平台**（python 后端引擎 + 工坊/创作台前端 + 精选游戏）打成**一个自包含、双击即跑的 Mac app**——客户机器**不装 node/python、不配环境**。面向：给客户/评估者在**他自己 Mac** 上完整跑引擎（含工坊现场创作）。

## 三决策（owner 2026-07-26·锁定）
1. **随包带「完全独立的 Python」**（可搬迁 standalone python + 预建 venv·**非 PyInstaller**·原生依赖 PIL/模型 SDK 走正常 pip、不折腾冻结）。electron 启动时 spawn 内置 python 跑 `apollo.py`。
2. **🔴 零 key 打包（安全红线·不可破）**：**任何我们的 key 绝不进产物**（生图/ARK/LLM 全不烤入）。运行时 **BYO-key**——owner 把生图 key **线下**给指定客户、客户首启粘贴；LLM 对话为**可选展示**（不给也行·或客户用自己的 Deepseek）。**无 key → 平台 UI + 精选游戏照常跑·live 生成/出图优雅禁用**（不是崩·是灰掉 + 提示填 key）。key 只存运行时 gitignored 配置（`.env`/settings·同现 BYO-key 机制）。
3. **精选构建**：**全部工坊工具 + 创作平台**（不裁）+ **9 游戏白名单**（其余 build 期过滤掉·不入包、不占体积、不露内部 WIP）。

## 游戏白名单（build 期 GAMES 过滤 → 仅这 9 个）
`game101`（海港绯闻 Merge）· `game102`（Pixel Pour）· `game-103`（幸存者）· `game-c`（六人德州）· `game-e`（小丑牌 Balatro）· `game-b`（雀宴 日麻）· `game-g`（翻命扑克）· `game-i`（UI 展示平台）· `game-z`（3D 展示 盒庭）。
**排除**：game-f / game-x / game-d / game-q / game-t / game-a。

## 架构
Electron app 内含：① 静态前端（vite build·launcher GAMES 按白名单过滤）② 可搬迁 python + 预建 venv（后端全依赖）③ 后端源码 `apollo.py`+`main_entry/`（全工具·不裁）④ 9 游戏数据/资产。
**启动流**：electron `main.cjs` → 挑空端口 spawn 内置 python 跑 `apollo.py` → 健康检查 → 前端 API base 指向它 → loadURL；退出时 kill 后端。**首启 BYO-key 引导**（填 or 跳过=离线模式）。**游戏永远离线可玩**（不依赖后端）。

## 一周排期
| 天 | 内容 | 风险 |
|---|---|---|
| **D1** | 可复现地基：生成 `requirements.txt`（现无·扫 import 固化）+ 干净 venv `pip install` 跑通 + 锁 node 依赖 | 低·先决 |
| **D2** | 可搬迁 python spike：standalone python + venv 装全依赖 → 手动 spawn `apollo.py` API 跑通（原生依赖 PIL/模型 SDK 坐实） | 中 |
| **D3** | electron 编排：spawn 后端 + 健康检查 + 前端 API base + 优雅退出 | 低（有 loadFile 先例） |
| **D4** | BYO-key 首启 UX + 无 key 优雅降级（游戏照玩·生成灰掉）+ GAMES 白名单过滤 | 低 |
| **D5** | electron-builder mac「整套平台」目标（现为单游戏）+ 体积 + Gatekeeper（无 Apple 账号→右键打开·要顺滑得公证=开账号） | 中（签名/公证） |
| **D6** | 干净机验收（全新 Mac·无 python/node/key）：双击跑起来?粘 key 能生成?9 游戏离线能玩?修原生依赖/路径 bug | 中高（坑集中） |
| **D7** | 缓冲 + 交付文档 + 离线卡带兜底 | — |

**兜底**：D2 若可搬迁 python 原生依赖闹 → 转 **Docker 镜像**（`docker run`→localhost·最稳·代价=客户装 Docker、非双击）。

## 风险 / 关键点
- 时间风险集中在 **D2/D6 原生依赖打包** + **D5 Gatekeeper 公证**（无 Apple 开发者账号则客户需右键→打开绕过）。
- **安全**：CI/构建脚本里做 key-scan 断言——产物内**零** `ark-`/`sk-`/任何 key 串（防误烤入）。
- **体积**：standalone python + venv + 9 游戏资产可能几百 MB~1GB·可接受（一次性拷）。

## 落地入口
本 spec 交 owner 确认后开工。D1 地基（requirements.txt + 干净装验证）先行——build-only·零 demo 风险·不管最终 electron/Docker 都用得上。
