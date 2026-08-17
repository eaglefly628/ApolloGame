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
| **一个 App 能拿到哪些 capability，取决于 `kind`** | Game 抄 `game-match3`（声明 `["resize","progress","checkpoint"]`·**一个 capability 模块都没有**）；World 才抄 `storyteller`（media/speech/storage/character/persona/apps 全套） | ⚠ **2026-08-17 血的教训**：样例仓 README 那张「SDK 2.1 capabilities」表的标题是「**Storyteller** 中的用途」，Storyteller 是 `kind:world`。把它当通用表 ⇒ game108 声明八个、真宿主上**五个全超时**（宿主根本没为 Game 挂那些 host extension）。四条接线的第 4 条「Host 为该运行创建对应的 host extension」**不是我方能满足的**——声明 ≠ 拿得到 |
| **假宿主必须模拟真宿主的能力边界** | `host-witness` 挂 host extension 时**按 kind 挂**，不许"SDK 支持什么就挂什么" | 同一天实证：本地把八个全挂上 ⇒ 48/48 全绿，真宿主里五个全红。**尺子比被测环境宽 = 尺子没用** |
| `result.metrics`（Game·输出 `doki.game.result/1` 时） | manifest 里逐条声明运行时会返回的指标名 | 给 **Episode 编辑器**列 `{{app.metrics.*}}` 变量用（README §5）。**不声明 = 剧情选不到你的指标**，加再多 metrics 也白加；与 `toGameResult` 真发的字段要有守卫对齐（两处真相） |
| capability 要的 scope | 用到 persona 就声明 `player_persona`；用到角色卡就 `character.card`（照 storyteller 的 `contextScopes.optional`） | 「角色与角色卡等数据仍受 `grantedScopes` 控制」——扩展挂了但 scope 没授权，一样拿不到 |
| extension 五步一致（§7） | manifest `runtime.extensions` ⇔ `createAppClient({extensions})` ⇔ 真建的 Client extension ⇔ 宿主 host extension ⇔ 退出时 `dispose()` | 声明名=wire 前缀；**只声明真用到的**。⚠ 旧版这里写着「storage 模块→`storage`，不是示例里的 `checkpoint`；match3 多声明是反例」——**那句话把唯一的 Game 参考实现定性成反例，于是我们不照 Game 抄、自己发明了一套**，这是 2026-08-17 真宿主全红的直接源头。正解见上面「一个 App 能拿到哪些 capability，取决于 `kind`」那行；生成器+测试双锚 |
| 三形态降级目击（§12） | SDK 真 `createAppHost` 假宿主起三形态（零授权/只 input 卡/带 character 资料）+ 挂起/恢复 + resize 实测（先例 `dokiworld/game108/scripts/host-witness.mjs`·同源静态服务直接 serve SDK 源） | 断言落 DOM 机读量（对手名/蓄力读数/血量）·不采信自陈；挂起腿断 checkpoint 真落宿主 |
| 「获取卡带」（列出/拉起别的 App） | `dokiworld/shared/src/apps-gateway.mjs`（`createAppsGateway`·SDK `./apps` 的薄适配） | **未声明就不发**（未声明的消息被拒的形态是"静默等到超时"）·`list` 恒返回数组 / `launch` 三态 `completed\|cancelled\|unavailable`·`launch` 超时是**一小时**不是 30 秒（玩家正在玩那个 App）·封装 ≠ 声明：消费方仍要自己在 manifest 写 `apps` |
| 完整性清单 | build 收尾产 `SHA256SUMS.txt` 进 dist（match3 同款：大写 SHA256 + 两空格 + 包内相对路径·覆盖除自身全部文件） | 冒烟核到哈希与实物一致（清单不是装饰） |
| 本地验证 | 静态起 dist + headless chromium 载入（无宿主时 `connect` 挂起属预期·页面不得白屏/报错） | 交付前照规范 §12 验收清单逐项 |
| 出包（不敲命令） | 工坊发布屏「DokiWorld App 包 .zip」——**发布屏唯一 DokiWorld 出口**（旧 doki 卡带/doki-dist 两行 2026-08-13 退役·服务端墓碑拒绝）（owner 2026-08-13 令·job=缺 node_modules 才 `npm ci`→`npm run build`→zip dist·`main_entry/packaging.py` dokiworld 平台） | 可用性=`dokiworld/<slug>/` 存在，未接入的格显示指引不隐藏；产物 `release/<slug>/<slug>-dokiworld.zip`（zip 根=dist 内容）；冒烟 `scripts/dokiworld-pack-smoke.py` |

## 我们的约定（规范之外的本仓口径）

- **打包住 `dokiworld/<app-id>/`**；`dist/` 是构建产物**不入本仓 git**（.gitignore 挡）——出包交付=构建后把整个 app 目录（或 dist）复制/PR 到 dokiworld-apps 仓（owner 侧动作·本仓 session 无那边推送权）。
- **薄接线零规则**：SDK 层只做「启动参数→config、终局态→GameResult」两个投影，禁在接线层写玩法逻辑（同 acceptance-adapter 纯接线铁律）。
- **双语文案**：name/description/promptHint/avoidHint/aliases 中英齐备（规范硬性）；游戏内文案沿用游戏自己的。
- **版本四维不联动**：App version（package.json）/manifest schema/runtime protocol/业务 contract 各自独立升。
- **跨 app 共享件住 `dokiworld/shared/`**（判据：「第二个 app 出包会不会把它抄一遍」）——首件=`apps-gateway`。
  单个 app 专属的接线（结果映射 / 卡片降级 / checkpoint 编解码）仍留在 `dokiworld/<app-id>/` 自己目录。
- 打包脚本/manifest 生成器带点名测试（`node --test`）。⚠ **`dokiworld/**` 的测试目前不在仓库门禁里**
  （`scoped-gate` 不跑它，出包 job 也只 `npm run build` 不 `npm test`）——改这些目录**必须手跑该目录的 `npm test`**；
  已作为 `REQ-DOKI-APPS`「后续①」在案（主程面·不另占槽）。

## 红线

- **dist 绝不装**：源码引用、token/.env/API key、测试凭据、绝对本机路径、私有 DokiWorld 模块（规范 §9 原文）。
- App **不碰宿主 token/Cookie/内部 HTTP**——只用 init 给的 `grantedScopes` 与 SDK capability。
- manifest 里声明的 `extensions` 必须与代码实际创建的一致（多声明会被拒·少声明消息被拒）。
- Game 的 `launchRequirements.minPlayers` = 总参与方数（人+AI 座位口径读规范 §3——拿不准写 1 并在 PR 里注明）。
- 别把 mock/占位美术打进对外 dist（M2.5 人审门口径同美术线）。

## 查不到怎么办

对方协议问题以规范快照为准、快照答不了去样例仓实查；我们侧缺件（如引擎单游戏 standalone 入口不够用）→ `docs/workflow/requests.md` 提缺口等裁决，**绝不为出包在游戏层开逃生门**。
