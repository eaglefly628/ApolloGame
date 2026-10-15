# AI Python 核心代码导览

本文所说的 AI Python 指创作台后端 `main_entry/`：它接收游戏生成和角色对话请求，组织提示词、模型调用、校验与提议结果。game114 的网格、流场、A* 和 ORCA 运行在 TypeScript 引擎中，见 [移动与寻路手册](movement-pathfinding.md) 和 [game114 交付记录](../design/game114/navigation-delivery.md)；`build-textures.py` 只是该样例的素材脚本。

## 入口和主调用链

| 入口 | 实际职责 |
| --- | --- |
| `zerocraft.py` | 项目命令入口，同时聚合 `main_entry/` 的兼容导入名；`apollo.py` 只转发到它。新代码应直接引用各自的 `main_entry` 模块。 |
| `main_entry/cli.py` | `main()` 分发 `workshop`、`player`、`platform`、`test` 等命令；需要时启动 Vite 与 API 服务。 |
| `main_entry/server.py` | HTTP 路由、请求/响应边界；将 `POST /api/generate`、`POST /api/agent/chat` 等交给业务处理函数。 |

```text
创作台 / API 客户端
  ├─ POST /api/generate ── server.handle_generate
  │    → generate_api（模式分派）
  │    → generation / design_flow / lowmodel（生成、设计先行、模板编辑）
  │    → llm_transport → 模型服务或 claude_code
  │    → manifest-check、结果和日志
  └─ POST /api/agent/chat ── server.handle_agent_chat
       → agent_chat（角色上下文、回复解析与提议）
       → llm_transport → 模型服务或 claude_code
       → manifest-check、工作台会话状态和日志
```

## 模块职责

| 模块 | 负责什么；何时改它 |
| --- | --- |
| `generate_api.py` | 创建、修订、设计对话/拆解/修订、原型和模板编辑的模式分派；改请求模式与输入检查时看这里。 |
| `generation.py` | 调模型、解析 JSON、调用 manifest 校验、最多按配置重试并把错误改写成可执行修正指令；改通用生成回路时看这里。 |
| `design_flow.py`、`design_prompts.py`、`lowmodel.py` | 设计先行工作流及其提示词、低模模板编辑；只对相应模式生效。 |
| `agent_chat.py`、`agent_prompts.py` | 策划 `gd`、程序 `pe`、美术 `art` 的上下文、提示词、对话与回复拆分。输出可含 manifest、设计文档、TS 逻辑、美术操作或能力缺口提议；提议的实际写入另由工作台 API 处理。 |
| `llm_transport.py`、`claude_code.py` | 统一供应商列表、凭据读取、模型请求与响应格式；Claude Code 订阅通道在后者。新增模型传输先检查这里，避免在上层复制 HTTP 客户端。 |
| `config.py`、`settings_api.py` | 本地模型/密钥设置及设置 API。凭据优先级为本地配置、进程环境变量、`.env`；配置文件是被忽略的本机文件。 |
| `paths.py`、`blueprints.py`、`ts_carts.py` | slug/路径检查、manifest 装载门、蓝图检查；程序角色启用 TS 卡带时才额外检查 `logic.ts` 提议。各类产物按自身类型过门禁。 |
| `library.py`、`library_api.py`、`workshop_store.py` | 游戏库与设计文档的读取/写入、工作台角色会话状态；区分“模型提议”和用户在工作台应用改动。 |
| `mock.py`、`llm_log.py` | 无外部模型的演示/测试响应，以及模型往返日志。`mock` 返回固定示例，不能用来判断真实生成质量。 |

`server.py` 还接入美术、资产、生产板、打包等端点；它们有各自的 `assets`、`art_*`、`pipeline_board`、`packaging` 等模块，不属于上述游戏生成与角色对话的核心调用链。

## 本地使用与验证

在项目根目录执行：

```bash
python3 zerocraft.py help       # 查看当前命令
python3 zerocraft.py workshop   # 启动创作台及所需页面服务
python3 zerocraft.py typecheck  # 调用项目 TypeScript 类型检查
```

工作台中的模型配置由 `settings_api.py` 保存；生成请求走 `/api/generate`，已有游戏的角色协作走 `/api/agent/chat`。前者的 `mode` 默认是 `create`，可用 `revise` 等模式，`autofix: true` 会启动校验修正回路。后者需要有效的 `slug`、`role` 和以用户消息结尾的 `messages`。如需离线验证调用链，可设置 `ZEROCRAFT_MOCK_LLM=1` 并显式选 `provider: "mock"`；返回值会标明 `mock: true`，只是固定示例。真正的游戏逻辑装载与画面移动仍需走 TypeScript 引擎测试。

改 Python 后可先运行 `python3 -m compileall -q main_entry zerocraft.py apollo.py` 检查语法，再按变更涉及的入口运行 `scripts/` 下对应 smoke 脚本。涉及 manifest 时还要通过 `paths.py` 调用的真实 manifest-check，不能只检查模型返回了合法 JSON。
