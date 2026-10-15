# ApolloGame / ZeroCraft

数据驱动的 ECS 游戏引擎、创作台与游戏样例。默认开发主线为 `codex/mainbranch`；项目协作规则见 [AGENTS.md](AGENTS.md) 和 [CLAUDE.md](CLAUDE.md)。

## 新机器开始

需要 Git、Node.js 22 和 npm。游戏预览不需要模型 API key。

```bash
git clone --branch codex/mainbranch https://github.com/eaglefly628/ApolloGame.git
cd ApolloGame
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

浏览器打开 `http://127.0.0.1:5173/` 进入游戏库。Game112 为 `/?game=game112`，Game113 为 `/?game=game113#/home`。

2026-10-15 的跨机器恢复快照在 `codex/project-sync-20261015`，合入主线前可直接克隆该分支继续；它是待审查快照，不代表 S1–S8 全部通过。覆盖范围、验证和剩余本机文件见 [同步审查记录](docs/reviews/project-sync-2026-10-15.md)。

## 独立工具和样例

根目录先完成 `npm ci`，再按需要启动：

| 内容 | 命令 | 地址 |
|---|---|---|
| Game114 机关车庭院 | `npm run dev --prefix handoffs/game114/mechanism-sample` | `http://127.0.0.1:5187/` |
| 原生二维动画编辑器 | `npm ci --prefix tools/see-through-workbench`，再 `npm run dev --prefix tools/see-through-workbench` | `http://127.0.0.1:5182/?demo=1` |
| 动画宿主端口示例 | 同动画编辑器服务 | `http://127.0.0.1:5182/engine.html` |

Game114 的模型和庭院贴图随源码提供；不依赖原开发者的临时目录。动画编辑器与示例不需要 GPU 模型；重新从整图推理分层另需 Python 3.12、GPU 环境和下载权重，见 [工作台说明](tools/see-through-workbench/README.md)。

Game112 的候选猫图、玩具原图和生产队列按既有要求保存在被忽略的 `art-local/`，未上传。未安装私有玩具索引时商店显示包裹占位图，正式主厅猫和既有道具仍使用仓库素材。Game113 浏览器里的演示进度只保存在当前浏览器；未授权产品候选照片也不随 Git 转移。

## 可选创作台后端

```bash
python3 -m venv .venv
# macOS / Linux: source .venv/bin/activate
# Windows PowerShell: activate .venv/Scripts/Activate.ps1
python -m pip install -r requirements.txt
python zerocraft.py
```

按终端打印的地址打开创作台。配置模板为 [.apollo-config.example.json](.apollo-config.example.json) 和 [.env.example](.env.example)；复制成对应本机配置后再填自己的 provider 信息。配置文件与凭据不进入 Git。

## 验证

```bash
npm test
npm run build
node scripts/scoped-gate.mjs --run
```

`scoped-gate` 默认比较 `origin/codex/mainbranch`。测试与构建的实际结果以审查记录和命令退出码为准，不在 README 手抄固定用例数量。
