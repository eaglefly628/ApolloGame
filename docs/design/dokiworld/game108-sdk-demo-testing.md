# game108 v0.4.0 · 在真 DokiWorld 网页里把九个 SDK 能力测一遍

> owner 2026-08-17：「我想实践一下所有 SDK 的功能……做一个 demonstration，然后去测试它所有的功能。」
> 手册：`docs/playbooks/dokiworld-pack.md` · 规范快照：`app-sdk-app-development.zh-CN.md`

## 一句话

包里带了一块 **「DokiWorld 能力自检」面板**：设置齿轮 → 菜单第六行 → 九行、每行一枚「试一下」。
**按下去就是真往宿主发协议消息**，答没答上当场写在那一行。这就是测试入口，不需要开控制台。

## 上传

`release/game108/game108-dokiworld.zip`（zip 根 = dist 内容，直接传）。
manifest：`id=game108` · `version=0.4.0` · `runtime.extensions = [apps, character, storage, speech, persona, dialogue, media, episode]`。

拉起它的关键字（`locales.*.aliases`）：**拳律 / 石头剪刀布 / 猜拳 / 蓄力猜拳 / 剪刀石头布**；
英文 **Rule of Three / Rock Paper Scissors / RPS / charge-up RPS / RPS duel**。
情景拉起走 `selection.promptHint`（`activationPolicy: explicit-or-contextual`，两条路都开着）。

## 怎么进那块面板

1. 拉起游戏 → 加载条 → **按任意键** → 玩法说明（**跳过 · 开始**）→ 对局屏
2. 右上角**齿轮** → 设置菜单 → 第六行 **「SDK 能力自检」**
3. 九行，逐行点右边那枚金色的「试一下」

颜色是判据不是装饰：**金 = 宿主真答了** · **红 = 试过但降级了**（原因就写在那一行）·
**灰 = 没声明 / 还没试**。灰**不等于坏**——这九个能力对本作一律是可选增强，
宿主不给就自己降级照常打，这正是要演示给你看的东西。

## 九行分别在测什么·期望看到什么

| 行 | 按下去真的发生了什么 | 宿主实现了 → 你会看到 | 宿主没实现 → 你会看到 |
|---|---|---|---|
| `character` | `character.getCurrent()` | 「当前角色：雪莉（char:sherry）」 | 「宿主没给角色（未授权 character.identity？）」 |
| `storage` | **存 → 读 → 清** 三步（用探针串，不碰你的真存档） | 「存 → 读 → 清 三步都通了」 | 那一行转红，写明哪一步失败 |
| `apps` | `apps.list()` | 「宿主能拉起 N 个 App：…」 | 「宿主没给出可拉起的 App」 |
| `speech` | `speech.synthesize()` 拿 audioUrl **并当场播** | 「合成好了，正在放：「…」」+ 真出声 | 「宿主没合成（游戏退回本地 TTS → 字幕，照常打）」 |
| `persona` | `persona.getSelected()`，取不到再 `list()` | 「当前身份：阿岚 · 24 · 喜欢吃辣」 | 「宿主没给身份（没授权或没实现）」 |
| `dialogue` | `dialogue.generateOpening()` | 「它说：「就你也配跟我猜拳？」」 | 「宿主没生成（游戏退回本地台词表）」 |
| `media` | `generateImage()` → **轮询 `getJob`** 到终态 | 「出图了：https://…」 | 「宿主没接文生图」/ 「作业 … 还是 processing」 |
| `episode` | 发一条 `episode.gameCompleted`，并当场算 routes 落到哪个 beat | 「已发 episode.gameCompleted → 剧情会走 beat-…」 | 「未声明 episode，一个字节都没发」 |
| `game-result` | **只报「现在发出去会是什么」**，不真 complete | 「score=… · win/loss/exited · 第 N 回合（终局才真发）」 | —（它不是 capability，是 output 契约） |

⚠ `game-result` 那一行**故意不真发** `complete`——发了这一局就结束了，演示台不该替玩家交卷。
它真正发出去的时机是**血量归零那一帧**（见下）。

## 结算数据往外走的两条路

1. **交给宿主记分**：`app.complete(createGameResult({normalizedScore, outcome, metrics}))`，
   契约 `doki.game.result/1`。`normalizedScore` 是 0..100 的血量差线性投影
   （50=均势 · 满血完胜=100）；`metrics = {round, playerHp, opponentHp}`。
   中途退出走 `onPrepareExit`，带 `outcome:'exited'` + 当时分。
2. **交给剧情**：同一帧再发一条 `episode.gameCompleted`，Episode World 拿它去
   `resolveEpisodeGameResult(output, routes)` 决定下一拍演什么（赢得漂亮 → 吹牛那一拍，输了 → 被调侃那一拍）。
   未声明 episode / 非剧情宿主 ⇒ 桥是 no-op，一个字节都不发。

**每回合的结算不往外走**——只有整局终局那一次。要逐回合上报的话是另一条需求（现在没有）。

## 完整跑一遍的建议路径（约 3 分钟）

1. 拉起 → 跳过说明 → 进对局
2. 齿轮 → SDK 能力自检 → **从上到下按九次**，记下哪几行是红的
3. 关掉面板 → 正常打完一局（读复读机的规律：布 → 剪 → 石 → 布 → 剪，五回合能赢）
4. 终局屏看有没有出现**「换个游戏玩」**推荐位（那是 `apps.list` 的产品级消费点）
5. 打完之后回宿主看战果有没有落账（`doki.game.result`）；剧情宿主再看有没有按 route 走下一拍
6. 中途退出一次（宿主的关闭按钮）→ 再进来，应当**续局**（挂起/恢复走 `storage` checkpoint）

## 已在假宿主里跑绿的部分（本地证据）

`npm run witness` **41/41**，其中第 ⑦ 腿就是「把九行逐个按一遍」，判据**读宿主侧收到的请求**
而不是页面上那行绿字。截图：`docs/design/dokiworld/game108-fullspec/hosted-sdk-panel.png`。

所以在真宿主里如果某一行是红的，**那是宿主侧没实现或没授权**，不是包坏了——
那一行写的原因（`timeout` / `unsupported-operation` / `not-declared` …）就是给你拿去对宿主的。
