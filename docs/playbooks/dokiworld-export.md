# 生产线手册 · DokiWorld 卡带导出（外部引擎交付）

> 做「把我们的游戏交给 DokiWorld 当 iframe 卡带」这件事前必读。
> 定位=接线图：**用哪个工具产出、契约要点、与卡片桥的关系、开口与红线**。
> 完整外部契约（DokiWorld 官方给的字段/消息细则）不在此手抄——以 DokiWorld《外部游戏交付与消息协议接入指南》为准；本手册只讲**在本引擎怎么产出合规产物**。

## 做 X → 用什么（一律走导出插件，绝不手改游戏源码）

- **产出方式**：工作台发布屏「🌸 DokiWorld 卡带」平台，或 `node tools/export-game.mjs <game> --target dokiworld`。
- **实现**：导出插件 `tools/export-targets/dokiworld.mjs`（core=`tools/export-game.mjs` 的 `--target` 插件架构）。
- **产物**：可构建源码工程（`npm run build` 出 `dist/`）+ `public/game.json`；含协议桥 + 计分注入 + 资源展平。
- **当前支持**：`game-a / game-b / game-c`（`supportedGames`）。别的游戏会报错指路，不伪造产物。

## 插件自动做的四件事（对应契约）

1. **协议桥**（导出插件在产物工程 `src/` 下生成 `dokiworldBridge.ts`）：`protocolVersion=1`（数字）；ready/init/initialized/result/close/resize；
   init 全校验（source===parent · origin 钉定 · grantedScopes 子集+去重 · context schema · 逐 scope 字段）；幂等 init；`window.parent===window` 惰性。
2. **`game.json`**（落 `dist/` 根 = 部署 `/games/<id>/game.json`）：`id/status/entry/protocolVersion/launchRequirements.minPlayers/contextScopes/locales(en+zh-cn)/selection`。
   **minPlayers**：game-a=4 · game-b=4 · game-c=2（去重 AI 角色 + 1 真人）。
3. **资源展平**：vite `base:'./'` + `closeBundle` 把 `dist/games/<id>/* → dist/*`（对上 `/games/<id>/` 挂载，禁止嵌套 `games/game-x/`）。
4. **计分注入**：在各游戏**已有终局一次性闸**处调 `host.complete(...)`，一局一次。映射（契约 §6.1）：
   a=胜 100/负 0（metrics 轮数·钱包）· b=四人名次线性 0..100（第一名 win）· c=主角胜 100/0（metrics 手数·筹码）。

## 与卡片桥的关系（红线：卡片接口权威·不冲突）

- 计分 `complete()` 挂在**卡片 SessionOut 同一个终局闸**上，**并存不替换**；`services/character-card` 桥（见 `playbooks/character-card.md`）一律不动。
- 角色读入：DokiWorld init 的 `context.character` 经 `mapCharacter()` → 席位卡。**当前留空**（见下开口）。

## 开口与红线（未定的别擅自做）

- 🔴 **成年闸**：三款成年向题材，`normalizeCharacterCard` 强制 `requireAdult`；DokiWorld 角色无成年确认字段。**禁擅自绕过**——`mapCharacter()` 现返回 `{}`，游戏走默认卡。规则由 Lead/产品定。
- 🟡 **单角色→多席**：owner「多角色没有就先空着」，席位注入先留空；`mapCharacter` 是唯一填充钩子。
- 🟡 **result 未终局实测**：注入代码照契约、编译通过，但未玩到终局触发真实 `dokiworld-game-result`；真环境或强制终局桩再验。
- 🔴 部署侧：iframe `sandbox="allow-scripts"`（opaque origin），模块脚本需服务端 `Access-Control-Allow-Origin:*` + `Cross-Origin-Resource-Policy:cross-origin`（DokiWorld 侧提供）。

## 查不到怎么办

- 要支持新游戏 / 改计分映射 / 接第二个外部引擎 → 在 `docs/workflow/requests.md` 提缺口（Lead 评审）；插件里补一条 `GAME_PATCHES`/`GAME_META` 或新增 `tools/export-targets/<engine>.mjs`，**绝不手改游戏源码逃生**。
