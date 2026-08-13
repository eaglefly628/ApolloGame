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
| 本地验证 | 静态起 dist + headless chromium 载入（无宿主时 `connect` 挂起属预期·页面不得白屏/报错） | 交付前照规范 §12 验收清单逐项 |

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
