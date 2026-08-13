# DokiWorld 出包线手册（ZeroCraft 产物 → DokiWorld iframe App）

> **owner 2026-08-12 立线：以后 ZeroCraft 做出来的东西都要能往 DokiWorld 打包**。
> 事实来源=官方规范快照 `docs/design/dokiworld/app-sdk-app-development.zh-CN.md`（对方接口一切以它为准·本册只讲我们怎么接）；
> 可跑样例 https://github.com/raptoravis/dokiworld-apps（`game-match3`=Game·`storyteller`=World·读法：`add_repo` 匿名克隆）。

## 一句话

App = **独立构建的自包含浏览器静态包**（`dist/` 里 manifest+html+js+全部资产·相对路径），经 `@dokiworld/app-sdk` 与宿主 iframe 通信。我们的游戏 = 引擎+游戏打成一个 bundle + 一层薄 SDK 接线（生命周期与结果上报），**不改玩法代码**。

## 做 X → 用什么

| 任务 | 用什么 | 要点 |
|---|---|---|
| 建 App 目录 | 本仓 `dokiworld/<app-id>/`（package.json+scripts+tests·照 match3 结构） | `id`=目录名=`createAppClient({appId})`·只准小写/数字/连字符 |
| 装 SDK | `npm i @dokiworld/app-sdk@^2.1.0`（registry.npmjs.org 直连白名单） | SDK 打进 bundle·部署端零依赖 |
| Game manifest | App 目录内的 generate-manifest 生成器（读 package.json version → 写 src → build 复制进 dist·**不手编 dist**） | `schemaVersion:2`·`status`/`capability`/双语 `selection.promptHint` 必填·`avoidHint` 防误拉起 |
| World manifest | 同上·`schemaVersion:1` | **禁 `selection` 字段**·`episodeRenderer` 按需·不内嵌角色副本 |
| 生命周期 | `createAppClient` → `connect({onInit,onPrepareExit,onExitDecision})` | `onInit` 拿 locale/context/input 再开局；不手写 postMessage |
| 结果上报 | `app.complete(createGameResult({normalizedScore,outcome,metrics}))` | `normalizedScore`=0..100 整数·outcome=`win\|loss\|draw\|completed`；中途退出走 `onPrepareExit` 报 `exited`+当时分 |
| 引擎游戏独立打包 | 借 `vite.config.cartridge.ts` 先例（`build:cartridge:single` 单文件形态）或 esbuild 自包含 | `base:'./'`·字体/图/音全进 dist·不漏动态分包 |
| 结果映射 | **从世界机读态取**（终局 Flag/StringVar/Resource——与验收剧本同一套判读·不另造口径） | 每游戏一个纯函数 `toGameResult(world)` + 点名测试 |
| cover 真图 | 假宿主装 dist 截**真对局屏** → 页内 canvas 转 WebP → 存进 app 源资产目录（先例 `dokiworld/game108/scripts/capture-cover.mjs`·产物 `dokiworld/game108/src/assets/cover.webp`） | manifest `cover` §5 点名校验（生成器查真图在包内·**禁灰块占位**）；build 显式复制进 dist（vite 不带未引用资产） |
| 挂起/恢复（§6 checkpoint） | `@dokiworld/app-sdk/storage` + 引擎 `world.snapshot()/snapshotOrder()/restore()`；游戏侧开一条 `setWorldRestore` 纯接线缝（`setWorldObserver` 孪生·先例 game108） | ⚠ capability payload 三上限 64KB/2000 节点/深 12——整快照裸传必被拒，走 deflate-raw+base64 传输编码（先例 `checkpoint-codec.mjs`·game108 快照 125KB→7KB）；`canSuspend:true` 只在**存成之后**报；正常 complete 后清档 |
| 对手=平台角色 | `@dokiworld/app-sdk/character` 读授权资料 → 引擎卡桥；降级链 授权资料→init.input 卡→内置兜底（先例 `foe-card.mjs`） | 查 `grantedScopes` 才发请求；capability 请求带短超时（宿主没实现=消息静默丢弃，只有超时兜得住）；缺哪级都不空白 |
| extension 五步一致（§7） | manifest `runtime.extensions` ⇔ `createAppClient({extensions})` ⇔ 真建的 Client extension ⇔ 宿主 host extension ⇔ 退出时 `dispose()` | 声明名=wire 前缀（storage 模块→`storage`，不是示例里的 `checkpoint`）；**只声明真用到的**（match3 多声明 progress/checkpoint 是反例）；生成器+测试双锚 |
| 三形态降级目击（§12） | SDK 真 `createAppHost` 假宿主起三形态（零授权/只 input 卡/带 character 资料）+ 挂起/恢复 + resize 实测（先例 `dokiworld/game108/scripts/host-witness.mjs`·同源静态服务直接 serve SDK 源） | 断言落 DOM 机读量（对手名/蓄力读数/血量）·不采信自陈；挂起腿断 checkpoint 真落宿主 |
| 完整性清单 | build 收尾产 `SHA256SUMS.txt` 进 dist（match3 同款：大写 SHA256 + 两空格 + 包内相对路径·覆盖除自身全部文件） | 冒烟核到哈希与实物一致（清单不是装饰） |
| 本地验证 | 静态起 dist + headless chromium 载入（无宿主时 `connect` 挂起属预期·页面不得白屏/报错） | 交付前照规范 §12 验收清单逐项 |
| 出包（不敲命令） | 工坊发布屏「DokiWorld App 包 .zip」（owner 2026-08-13 令·job=缺 node_modules 才 `npm ci`→`npm run build`→zip dist·`main_entry/packaging.py` dokiworld 平台） | 可用性=`dokiworld/<slug>/` 存在，未接入的格显示指引不隐藏；产物 `release/<slug>/<slug>-dokiworld.zip`（zip 根=dist 内容）；冒烟 `scripts/dokiworld-pack-smoke.py` |

## 我们的约定（规范之外的本仓口径）

- **打包住 `dokiworld/<app-id>/`**；`dist/` 是构建产物**不入本仓 git**（.gitignore 挡）——出包交付=构建后把整个 app 目录（或 dist）复制/PR 到 dokiworld-apps 仓（owner 侧动作·本仓 session 无那边推送权）。
- **薄接线零规则**：SDK 层只做「启动参数→config、终局态→GameResult」两个投影，禁在接线层写玩法逻辑（同 acceptance-adapter 纯接线铁律）。
- **双语文案**：name/description/promptHint/avoidHint/aliases 中英齐备（规范硬性）；游戏内文案沿用游戏自己的。
- **版本四维不联动**：App version（package.json）/manifest schema/runtime protocol/业务 contract 各自独立升。
- 打包脚本/manifest 生成器带点名测试（`node --test`）；出包改动照常走本仓门禁。

## 红线

- **dist 绝不装**：源码引用、token/.env/API key、测试凭据、绝对本机路径、私有 DokiWorld 模块（规范 §9 原文）。
- App **不碰宿主 token/Cookie/内部 HTTP**——只用 init 给的 `grantedScopes` 与 SDK capability。
- manifest 里声明的 `extensions` 必须与代码实际创建的一致（多声明会被拒·少声明消息被拒）。
- Game 的 `launchRequirements.minPlayers` = 总参与方数（人+AI 座位口径读规范 §3——拿不准写 1 并在 PR 里注明）。
- 别把 mock/占位美术打进对外 dist（M2.5 人审门口径同美术线）。

## 查不到怎么办

对方协议问题以规范快照为准、快照答不了去样例仓实查；我们侧缺件（如引擎单游戏 standalone 入口不够用）→ `docs/workflow/requests.md` 提缺口等裁决，**绝不为出包在游戏层开逃生门**。
