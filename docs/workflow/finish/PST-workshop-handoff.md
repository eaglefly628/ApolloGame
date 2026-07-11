# PST 维护交接档 · Workshop 统一工作台（REQ-WORKSHOP）

> Lead 亲手施工（owner 2026-07-11 授权），完工后**维护权移交 PST**。本档=你接手要知道的全部：
> 部件地图 / 接口契约 / 红线 / 验证方法 / 已知债。唯一 spec 仍是
> `docs/design/workshop-spec-2026-07-10.md`（语义裁决以它为准；本档只是维护视角的导览）。

## 0. 一句话架构

**Workshop 壳（`workshop/index.dc.html`·对外展示台）+ apollo.py（唯一后端）+ 旧工作台（launcher React·完整开发端）**
三者同源同数据：壳走 `/api/*` 与 `/games/*`，旧工作台走同一批端点——没有第二份状态。

## 1. 部件地图（改哪找哪）

| 部件 | 文件 | 说明 |
|---|---|---|
| Workshop 壳 | `workshop/index.dc.html` | x-dc 模板 + 内嵌 `Component extends DCLogic`。**support.js 是生成的 dc-runtime，勿手编** |
| 壳伺服 | `apollo.py` `_serve_workshop` | `GET /workshop/*`（`python apollo.py workshop` 一键起） |
| 游戏资产静态 | `apollo.py` `_serve_public_games` | `GET /games/**`（只读·路径穿越 403）——台账 servedPath 缩略图同源可显 |
| 下载包 | `apollo.py` `_serve_export` | `GET /api/library/<slug>/export`（内存 zip·排除 `.git/snapshots/mock`）·owner 拍板「发布=下载包」 |
| 能力目录 | `apollo.py` `handle_catalog` | `GET /api/catalog`（vite-node dump·进程内缓存）——壳无 vite 侧 import，生成/程序对话词汇表从这取 |
| 双角色对话 | `apollo.py` `handle_agent_chat` | `POST /api/agent/chat`（下详）·系统词 `AGENT_GD_SYSTEM`/`AGENT_PE_SYSTEM` |
| 订阅通道 | `apollo.py` `_claude_code_*` | claude-code 子进程（下详·红线区） |
| 数据桥 | `apollo.py` `library_create`/`library_put_manifest`/`handle_pipeline_concept`/`handle_art_reskin` | create 带 description→meta+S1 立项卡；PUT 即台账；换皮谱系 |
| 八阶段板 | `scripts/game-pipeline.mjs` + `src/studio/GamePipelinePanel.tsx` | cart-S8=轻量终检（mockDebt∧manifest-check∧bench·证据绑 gameHash） |
| launcher 导流 | `src/launcher.tsx` + `src/studio/DataCartridgeRunner.tsx`（LibActionBar） | 🏭/⤓ 导出/保存成功「下一步→🏭」/⇄ Workshop 链接 |

## 2. 接口契约（壳↔服务端·改动必须两头同步）

- `GET /api/library` → **裸数组** `[{slug, meta{name,description,…}, valid, hasDesign}]`
- `POST /api/library/create` `{name, description?, provider?}` → `{success, slug, meta}`（description ≤300：一处来源两处受益=meta 副标题+S1 pitch）
- `PUT /api/library/<slug>/manifest` `{manifest, note}` → 先 `_run_manifest_check` 后落盘+版本化+**自动重 derive 台账**（mergeLedger append-only·编号不漂移）
- `GET /api/pipeline?slug=` → `{success, stages:[{id,title,status: ok|warn|fail|dim, machine{state,detail}, human}], concept{name,pitch,…}, gameHash, next}`
- `GET /api/art/ledger?slug=` → `{success, rows:[{no, status, query, slot, gen{servedPath,mock,…}}]}`（servedPath=/games/… 正好走静态路由）
- `POST /api/agent/chat` `{slug, role: gd|pe, messages[≤40·末条须 user], provider?, model?, catalog?}` →
  `{success, reply, manifest?|manifestError?, artHints?(仅 gd), attempts, provider, model}`
  - 服务端**绝不代落盘**：manifest 只是提议——壳「✔ 应用改动」显式 PUT 才落
  - 校验失败自动回喂一轮（`_llm_ify_error`）；仍败则回 `manifestError`
  - mock 短路（`APOLLO_MOCK_LLM=1`）：`_mock_revise` 确定性微调·过真校验门——冒烟/e2e 全链用
- `GET/PUT /api/settings` → `{providers:[{id,name,models,model,apiKeyMasked,hasConfigKey,keyAvailable,…}], genKeys:[{envKey,apiKeyMasked,hasConfigKey,keyAvailable}], default}`
  - PUT 只送 dirty 字段；**空串=清除**；`genKeys` 三把=`DASHSCOPE_API_KEY / TRIPO_API_KEY / MESHY_API_KEY`（owner 07-11 收编旧美术台配置）

## 3. 红线（动之前读三遍）

1. **claude-code 子进程工具面全禁**：`_claude_code_args` 的 `--disallowedTools Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit,TodoWrite` + `--max-turns 1` + 空目录 cwd（`.apollo/claude-code-cwd`）——**一个都不许放开**（安全红线·spec §四）。transcript 走 stdin（防 ARG_MAX）。
2. **key/token 纪律**：只存 `.apollo-config.json`（gitignored）或 env；回显一律 `_mask_key` 打码；绝不落日志/入库。
3. **mock 三道闸不变**：mock 命名空间 `gen/mock/`、applyReplacements 默认跳 mock、approve 拒 mock——壳/板不得绕。
4. **不代签人门**：signoff 必须真人指令；agent-chat 不代落盘。
5. **引擎目录零触碰**：`src/{engine,skills,assembly,renderer,services,net}` 是主程域；Workshop 维护全在 `workshop/ + apollo.py + scripts/ + src/studio/ + src/launcher.tsx` 层。
6. **anthropic raw 通道 4.7+ 合规**：不发采样参数；`thinking:{type:adaptive}`；content blocks 遍历取 text；`stop_reason==refusal` 明报错；system 尾块 `cache_control:ephemeral`。型号表=`claude-opus-4-8`（默认·订阅档同型）/`claude-sonnet-5`/`claude-haiku-4-5`。

## 4. 验证方法（改完必跑·全部退出码判断）

```
python3 -c "import ast; ast.parse(open('apollo.py').read())"   # AST 快查
python3 scripts/pipeline-smoke.py     # 44 断言：数据桥+cart-S8+agent-chat+壳伺服面（⑧=壳/静态/zip/catalog）
python3 scripts/art-replace-smoke.py  # 45 断言：美术管线+mock 三道闸
npx tsc --noEmit && npx vitest run && npx vite build
```
壳侧改 `index.dc.html` 后：起 `python apollo.py workshop` 真浏览器过一遍
（八屏 + mock 生成链 `APOLLO_MOCK_LLM=1` + 对白编辑「✔ 应用改动」+ 下载包 + 设置保存打码回显）。

## 5. 已知债 / 后续单（不在本单）

- **T3 批量吞吐冒烟**（Opus 单·requests.md）；**进度灯**（PST 既有心跳队列单）
- 真 key 采购=owner（DASHSCOPE P0 / TRIPO P1 / MESHY P2）——到货后壳设置屏直接能填
- 壳 `/api/catalog` 首调冷启动 ~10-20s（vite-node）·失败缓存为空不重试——若成痛点提单加重试/预热
- 对白编辑历史不落盘（刷新即清）——spec 记 v2 候选；VN/shell 退役等旧债各归各主
- Fable 5 展示档在 claude-code 通道 models 里可选（owner：展示更强）——量产默认 Opus 4.8（订阅）

## 6. 变更纪律

语义级改动（状态机/端点形状/红线）先回 `docs/design/workshop-spec-2026-07-10.md` 改 spec 或 requests.md 提单等 Lead 裁决；
纯修缺陷/补测试直接干，回执照 T1/T2 格式附门禁实数。
