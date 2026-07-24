# 操作手册 · DokiWorld 卡带导出（外部引擎交付）

> 把 game-a/b/c 交给 DokiWorld 当 iframe 卡带的**操作手册（SOP）**：打包→本地预览→交付部署→验收，照本操作。只讲**本引擎怎么产合规产物 + 怎么操作**；DokiWorld 官方完整字段/消息契约以其《外部游戏交付与消息协议接入指南》为准，不手抄。

---

## 1. 这是什么 / 何时用
- 用途：把游戏导成 DokiWorld 能在 `sandbox="allow-scripts"` iframe 里加载的**独立卡带**（协议桥 + 计分回传 + `game.json`）。
- 实现：导出插件 `tools/export-targets/dokiworld.mjs`（core=`tools/export-game.mjs` 的 `--target` 插件架构·不绑定 DokiWorld·接别的引擎再加一个插件）。
- **当前支持**：`game-a / game-b / game-c`。别的游戏会报错指路，不伪造产物。
- **铁律**：一律走导出（工作台/CLI），**绝不手改游戏源码**；引擎主干 `src/games/**` 零改动，注入只在导出产物上。

## 2. 两种产物（发布屏两个平台，按需选）

| 平台按钮 | 产物 | 何时用 |
|---|---|---|
| 🌸 **DokiWorld 卡带（源码工程）** | 可构建 TS 工程 + `public/game.json`；`npm run build` 出 dist 再部署 | 交源码、对方要改代码/自己构建 |
| 🌸 **DokiWorld 部署产物 dist** | 工作台直接 `vite build` 好的**独立可运行 dist 卡带**（zip 根另带预览启动器·JS 内联 three/react/cannon·art 全打入·**零外部模块/CDN**） | 落地即用、只需部署或本地 review |

**打包出图（自动·owner 2026-07-22）**：打包时超 1080P 的 PNG 会**同比例缩进 1920×1080 框**（长边≤1920·短边≤1080·只缩不放·仅 PNG）。检测零依赖；确有超标图才需 `pip install Pillow`（无超标=不处理）。

## 3. 操作：怎么打包
1. 仓库根 `python3 apollo.py workshop` → 开 `http://localhost:4000/workshop/`（首次先 `npm install`，dist 要真构建）。
2. 进**发布屏** → 找到游戏（game-a / b / c）。
3. 选平台行 → 点 **「打包」**（状态 `⏳ 打包中…`；dist 走 `vite build` 慢十几~几十秒·**串行**一次一个）。
4. 变 `✓ 就绪` → 点 **「下载」** → 拿到 `<game>-dokiworld[-dist].zip`。CLI 等价：`node tools/export-game.mjs <game> --target dokiworld`（源码工程）。

## 4. 操作：本地预览（review dist）

dist zip 解压：
```
game-c/            ← 部署目录（丢进 DokiWorld /games/game-c/·不含下面脚本）
review.bat         ← Windows 双击预览
review.sh          ← mac/Linux（./review.sh）
review.py          ← 跨平台核心（python3 review.py）
README.txt
```
- **双击 `review.bat`** / `./review.sh` → 自动挂到正确 `/games/<slug>/` 路径、开浏览器。⛔ **禁双击 `<slug>/index.html`**（ES 模块不能 file:// 加载·游戏按绝对路径取美术·必须 HTTP 挂 `/games/<slug>/`·review 脚本已替你做）。

## 5. 操作：交付部署到 DokiWorld

- 把 dist 的 **`<slug>/` 目录** 放进 DokiWorld `frontend/public/games/<slug>/`（`game.json`+`index.html`+`assets/`+`art/` 直接在目录根）。
- 服务端给美术资源加头：`Access-Control-Allow-Origin: *` + `Cross-Origin-Resource-Policy: cross-origin`（opaque-origin iframe 必需·DokiWorld 侧提供）。
- 不要交付 review 脚本/审计/流水线文件到线上（部署只用 `<slug>/`）；**mock/快照目录自动不打**（导出+打包均排除 `mock`/`mocks`/`__mocks__`/`snapshots`·spec §1 非运行时资源）。

## 6. 插件自动做的（对应契约·验收对照）

1. **协议桥**（`tools/export-targets/dokiworld.mjs` 注入产物内 `dokiworldBridge`）：`protocolVersion=1`；ready/init/initialized/result/close/resize；init 全校验（source===parent·origin 钉定复检·grantedScopes 子集+去重·context schema·逐 scope 字段）；幂等 init；`initialized` Promise；standalone 惰性。
2. **`game.json`（schema v2）**（落 dist 根 = `/games/<id>/game.json`）：`schemaVersion:2`·id·`kind:game`·`capability`·entry·**launchRequirements.minPlayers**（a=4·b=4·c=2）·`context.{requiredScopes,optionalScopes}`·locales(en+zh-cn·含 `aliases`)·`runtime:{protocol:'dokiworld.game',protocolVersion:1}`。**供应方不设 `status`/`selection`**（移交 DokiWorld registration）。
3. **资源展平**：vite `base:'./'` + `closeBundle` 把 `dist/games/<id>/*→dist/*`（禁嵌套 `games/game-x/`）。
4. **计分注入**：各游戏**已有终局一次性闸**调 `host.complete(...)`，一局一次。映射（契约 §6.1）：a=胜100/负0（metrics 轮数·钱包）·b=四人名次线性0..100（第一名 win）·c=主角胜100/0（metrics 手数·筹码）。

## 7. 与卡片桥的关系 + 当前开口（红线）

- 🔴 **卡片接口（REQ-CHARCARD·SessionIn/onSessionOut/buildSessionOut）权威·不冲突**：`complete()` 挂卡片 SessionOut **同一终局闸并存·不替换**；卡片桥（见 `playbooks/character-card.md`）一律不动。
- 🟡 **角色接入留空**：init 的 `context.character` 已校验+传递，但 `mapCharacter()` 现返回 `{}`（游戏走默认卡）。填充受两个未定决策阻塞：**成年闸**（题材成年向·`normalizeCharacterCard` 强制 `requireAdult`·DokiWorld 角色无成年确认字段·禁擅自绕过）+ **单角色→多席映射规则**（owner「多角色没有就先空着」）。定了在 `mapCharacter` 一处接上。
- 🟡 **result 未在真实终局实测**：注入代码编译+桥单测（钳位/runId/幂等）全绿，但未玩到终局触发真实 `dokiworld-game-result`。

## 8. 常见问题
| 现象 | 原因 / 处置 |
|---|---|
| 双击 index.html 白屏/报错 | file:// 不能加载 ES 模块 → 用 `review.bat`/`review.sh` |
| 图片全 404 | 没挂在 `/games/<slug>/` 路径 → 用 review 脚本 |
| iframe 内模块 CORS 报错 | 服务端缺 §5 的两个 CORS 头 |
| 导出报「不支持」 | 该游戏无计分映射 → 走 requests.md 提缺口·补 `GAME_PATCHES`/`GAME_META`，绝不手改源码 |
| 打包报「需 pip install Pillow」 | 有超 1080P 的 PNG 要缩 → `pip install Pillow` 后重打（或先把大图换小） |

## 9. 验收清单（交付前逐项）
- [ ] `tsc` + `vite build` 通过；dist 有 `index.html`+`game.json`+`assets/`，无嵌套 `games/`。
- [ ] `game.json`（schema v2）：id=目录名·kind/capability 有·minPlayers 正确·locales(en+zh-cn+aliases)·context.requiredScopes 只用平台支持的·runtime=dokiworld.game/1·**无 status/selection**。
- [ ] review 脚本能起服务、握手（真 iframe 下 ready→init→initialized）。
- [ ] result 只一次·`normalizedScore` 为 0..100 整数（桥已保证钳位）。
- [ ] 部署目录 `<slug>/` 不含 review/审计脚本；服务端带 CORS 头。

要支持新游戏/改计分映射/接第二个外部引擎 → `docs/workflow/requests.md` 提缺口（Lead 评审），补 `GAME_PATCHES`/`GAME_META` 或加 `tools/export-targets/<engine>.mjs`。**绝不手改游戏源码。**

---

## 11. 备忘 · v2 通用协议迁移（🟡 待办·阻塞中·勿现在做）

DokiWorld 新版《外部 App 接入指南》定义了通用生命周期协议 **`dokiworld.app/2`**（App 化·非游戏专属）。**当前明确 registration `disabled`、需先与 DokiWorld 完成宿主接入 + registration 审核才启用**——所以现在**继续 v1（`dokiworld.game/1`），不迁 v2**（一个构建产物只能实现一个协议版本，禁运行时协商）。

**解阻塞条件**（等 DokiWorld 侧就绪）：① v2 registration 开放；② 分配/审核我们的 `runtime.input`、`runtime.outputs` 的 `doki.*`（或授权命名空间）contract 名。

**届时的工作量**（都在导出插件层·引擎主干仍不动）：
- 桥改 `dokiworld-app-*` 消息族：`ready`(带 `instanceId`)/`init`/`initialized`/`complete`+**`complete-ack`**（幂等 `resultId`·收到 `accepted` 才算结算·丢 ack 用同 resultId 重发）/`request-exit`+`prepare-exit`+`exit-state`+`exit-decision`（stay/discard/suspend）；身份四元组 `appId+instanceId+runId+messageId` 全匹配、旧 iframe 迟到消息丢弃。
- 可选扩展按需声明：`progress`(非权威)/`checkpoint`/`resume`(同 runId 新 instanceId)/`resize`。
- `game.json` 加 `runtime.input`(empty contract 亦可) + `runtime.outputs`(≥1)；游戏结果从「分数」改成 `output.contract` 数据（编码后 ≤64KiB·深度≤12·≤2000 节点）。
- 验收：`npm run generate:games` + `tests/gameCatalogBuild` + `tests/externalAppProtocol` + `npm run build`。

**触发**：DokiWorld 通知 v2 可接入时，把本节升级为 `requests.md` 正式条目（届时腾槽）派工。
