# Google Playground 对标分析 · 阿波罗能否做成同类平台（Lead 2026-10-08）

> owner 问：「分析对比 Google Playground（playground.google/explore），我们能不能把平台做成一样？」
> 资料口径：容器内 playground.google / blog.google 解析不到（DNS 拒），以下产品事实来自 2026-10-07 发布当天的多家报道（Google 官方博客、9to5Google、Shacknews、VGC、The Decoder 等），**未亲手试玩**，细节以官网为准。

## 一、Google Playground 是什么（2026-10-07 Google Labs 发布）

| 维度 | 事实 |
|---|---|
| 定位 | 实验性浏览器游戏平台：**create · play · share** |
| 创作 | 一句话描述 → 生成可玩版 → **聊天迭代**（例：给平台跳跃游戏加二段跳）；可从空白起步或 remix 起手 prompt |
| 模型 | Gemini（推理 + **写代码**）+ Nano Banana（出图）+ Lyria（出音乐）+ 自研 harness |
| 分享 | 私有 / 链接分享好友 / 发布到 **Explore 画廊**（按评分 + 游玩活跃度排序） |
| Remix | 任何公开游戏可被 remix 成自己的版本 |
| 安全 | 公开发布走安全审核（社区准则） |
| 商业 | 免费；Google One 订阅给更高的周 token 额度 |
| 范围 | 仅美国 18+；创作权限分批放量 |
| 下一步 | Unity Spark 集成（封测）→ 补 3D 物理与复杂机制 |

本质：**「AI 生成代码的小游戏」+「UGC 社区闭环（画廊/排名/remix）」**。护城河在模型与分发，不在游戏技术。

## 二、对照阿波罗现状（实查仓库，非印象）

| Playground 环节 | 阿波罗已有 | 位置 | 差距 |
|---|---|---|---|
| 一句话生成 | ✅ prompt → manifest，服务端 parse + manifest-check 自动校验重试 ≤3 | `main_entry/generate_api.py`、`jobs.py`（后台任务） | 无 |
| 聊天迭代 | ✅ 向导 revise 态「修改指令 → 新版本」 | `src/studio/CreationWizard.tsx` | 无 |
| 即时试玩 | ✅ ManifestPreview 运行核 | `src/studio/DataCartridgeRunner.tsx` | 无 |
| 版本 / 回滚 | ✅ 每游戏 git 快照 + rollback | `main_entry/library.py`、`library_api.py` | Playground 未见报道此能力，**我们领先** |
| 出图 | 🟡 封面文生图（qwen 2D·无 key 走占位） | `main_entry/games_list.py` cover | 只有封面，未接进游戏内美术 |
| 出音乐 | 🟡 音频是合成 SfxSpec；有 media-job 端口 | `src/services/audio`、`media-job` | 无生成式 BGM |
| 玩家货架 | ✅ `?mode=player` 卡带架，数据源 = 用户游戏库 | `src/launcher.tsx` | 只是本机库 |
| 链接分享 | 🟡 有单文件构建 `build:cartridge:single` | cartridge 线 | 没有「一键得链接」 |
| 公开画廊 / 排名 | ❌ | — | 服务器只绑 `127.0.0.1`（`server.py:904`），没有多用户后端 |
| Remix | ❌（底子已经在：游戏 = 一份 JSON，复制即 fork） | — | 缺「fork + 血缘 meta」入口 |
| 账户 / 额度 | 🟡 有 profile 端口，无云账户、无配额 | `src/services/profile` | 缺 |
| 安全审核 | ❌ | — | 缺（但我们这条更容易做，见下） |
| 多人 | ✅ lockstep / state-sync / 世界 hash | `src/net/` | **Playground 没有，我们领先** |
| 发行出口 | ✅ Steam、掌机卡带、Electron | `steam-publisher/`、`cartridge-station/` | **我们领先** |

**结论：创作端已经有约 80%，缺的是「社区平台」那一半（云端托管 + 画廊 + remix + 审核 + 账户）。**
这一半全是**服务 / 产品层**的活，**引擎和 capability 一行都不用改**。

## 三、Lead 判词：做，但别照抄成「一样」

**接受**：抄 Playground 的**闭环**——创作 → 试玩 → 分享 → 画廊 → remix。这是它真正的产品价值，我们缺的正是这一段。

**回驳**：不抄它的**技术路线**（让 LLM 每个游戏写一份自由代码）。理由：

1. **宪法冲突**：自由代码正是 `data-driven-manifesto.md` 禁的 L4 档。
2. **路线不同反而是我们的差异点**——我们的游戏是**数据**，这带来 Google 那条路给不了的五样东西：
   - **remix 是一等能力**：fork = 复制一份 JSON；能比对 diff、合并、追溯血缘。代码游戏的 remix 只能整体再生成。
   - **审核便宜且可靠**：游戏里没有任意代码，审核只扫文本和美术资产，不用沙箱跑未知 JS。
   - **质量下限**：manifest-check + bench 五轴 + 确定性双跑，「能存就能跑」。
   - **多人联机**：lockstep 对数据游戏天然成立；代码生成的游戏基本做不了。
   - **出口**：同一份卡带能发 Steam、上掌机。
3. **正面硬拼拼不过的**：免费模型额度、Google 分发流量、Nano Banana / Lyria 的出图出音乐质量。所以定位是「**能联机、能出货、能 remix 到底的 AI 游戏工坊**」，不是「另一个 Playground」。
4. **要说清的代价**：数据路线的表现力受 capability 词汇表限制，品类宽度比不上「Gemini 什么都能写」。补救是已有的 L2 capgap 通道 + L3 TS 卡带，**不是放开自由代码**。

## 四、两条路（按缺口裁决协议摆出，owner 判）

> 这不是引擎缺口，属于**产品 / 平台战略**，同样按「摆两条路·Lead 推荐·owner 判」处理。

**A · 本地优先的轻平台（推荐先做）**
- 内容：① **Remix**：库里一键 fork（复制 manifest，meta 记 `remixOf` + 版本号）；② **分享**：一键导出单文件 HTML / 卡带包，可直接发人；③ **本地画廊**：玩家模式货架加「游玩次数·评分·remix 数」排序（先用本机 localStore）；④ 封面文生图在生成链里默认开。
- 代价：服务层 + 工坊壳小改，**引擎零改动**，周级工作量，可回退。
- 影响面：`main_entry/library*`、`src/launcher`、`src/studio`。
- 选错的代价：低，A 的组件都能直接被 B 复用。

**B · 全托管云平台（Playground 同构）**
- 内容：A 全部 + 云账户、托管游玩链接（CDN 静态托管卡带）、公共 Explore 画廊与排名、审核队列、生成额度 / 付费档、remix 树、联机房间。
- 代价：新增后端服务 + 运维 + 合规（未成年人、内容审核、版权、模型成本），月级工作量，需要专人长期运营。
- 影响面：新服务面（不碰引擎）；`server.py` 要从单机 dev 服务拆出生产服务。
- 选错的代价：高。没有内容供给和用户量，画廊是空的，运营成本白付。

**Lead 推荐**：**先 A，用数据决定要不要上 B**。门槛：A 上线后本地生成 → remix 的链路有人真在用（比如每周有 N 个新卡带被 fork），再立 B。B 立项时先做「托管链接 + 画廊」两件，账户和额度可以用第三方登录 / 按 key 计费起步。

## 五、需要 owner 拍板

1. **A / B / A→B**（Lead 推荐 A→B）。
2. 对外定位是否接受「能联机、能出货、能 remix 的 AI 游戏工坊」，**不做 Playground 的翻版**。
3. 如果走 B：目标地区与年龄政策（Google 只开放美国 18+，正是因为合规成本）。

## 资料来源

- [Introducing Playground: Create and play custom games（Google 官方博客）](https://blog.google/innovation-and-ai/technology/ai/playground-experimental-gaming-platform/)
- [9to5Google · Google Labs announces Playground](https://9to5google.com/2026/10/07/google-labs-playground/)
- [Shacknews · Google announces Playground](https://www.shacknews.com/article/150932/google-playground-ai-game-development)
- [VGC · Google officially reveals Playground](https://www.videogameschronicle.com/news/google-officially-reveals-ai-game-creation-platform-playground/)
- [The Decoder · Google bets Gemini can turn casual players into game developers](https://the-decoder.com/google-bets-gemini-can-turn-casual-players-into-game-developers-with-new-playground-feature/)
- [Inven Global · Expanding to 3D via Unity Spark](https://www.invenglobal.com/articles/26909/google-unveils-playground-to-create-games-from-text-prompts-expanding-to-3d-via-unity-spark)
- [Gizmodo · vibe code a game in your browser](https://gizmodo.com/googles-new-playground-aims-to-make-it-easy-to-vibe-code-a-game-right-in-your-browser-2000822955)
