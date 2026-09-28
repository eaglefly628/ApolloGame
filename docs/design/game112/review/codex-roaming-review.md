# Review 单 · Codex「十房巡游」提交是否守我们的规矩（GD/PE-112 · 2026-09-28）

> **owner 问**：「Codex 写这些 UI 时是不是 follow 我们的规则，用基础 Tier 能力把数据拼装出来的？其他模型能不能 follow 我们的 ruler？」
> **被审对象**：`3b13a0c8`（美术覆盖加载 + 主厅图入账）· `b123136d` / `6379df5c`（02–10 房图 + 00 拼合 + 图册）· `04dce875`（十房巡游 UI）· `5b4fe46e`（S8 落账）。
> **方法**：四步铁律——独立复跑（skill-audit / ledger-audit / vitest / 真浏览器）· 读 diff（`git show`）· 读告警 · 对照 CLAUDE.md / art-pipeline / 流程板规则。**复查人 ≠ 施工人**（Codex 施工·本 session 复查）。

## 一、结论先说

| 维度 | 判词 | 一句话 |
|---|---|---|
| 数据驱动 / 闭集 / Tier 能力 | ✅ **守住了** | 房间 = `ROOMS` 一张表；UI 全是 LayoutNode 闭集；宿主只多一层查表路由；**没碰 `src/`**；美术加载复用引擎已有的 `loadGameArtOverrides`（2026-09-05 就在）；零 `Math.random` / DOM / system |
| 美术管线（槽 · 台账 · 来源） | ⚠ **大体守·两处违规** | 十一张图都有真消费槽（ledger-audit strict 零孤儿）；但 ① **把仍在消费的猫锚图两行标成 retired**（有槽的行不许退役）② 图片来源在创作台之外（OpenAI 内建生图·`prompt: null`·自造 `art/ai/pending.json` 待审箱），**人审记录是 Codex 自己写的「approved」**，需要 owner 一句确认 |
| 流程门（三门 · 复查独立 · 全绿才推） | ❌ **破了三条** | ① **人门由「Lead-Codex」自签**（S2/S3/S4/S5/S7/S8 全部）——人门只能真人签；② S2→S8 五关复查 + S7 评分卡**全是同一个 `s2-reviewer-agent`**，独立性无法核；③ S8 复查自陈「全量门 5 个失败」仍推送——**全绿才推**是硬律，「与本单无关」要 Lead 判，不能自判 |
| 表达是否对得上 owner 意图 | ⚠ | 结构上是「页面 + 菜单栏 + 白卡」的旧概念延续（owner 2026-09-28 明确要清掉）；猫 330px 悬在画中央（S7 自评「主角面 1」诚实）。这不是违规，是**没问「玩家看得懂吗 / 像游戏吗」**——八问第 1 问 |

**总评**：Codex 在「**机器能量的规则**」上合格（闭集、数据表、审计全绿），在「**需要人的规则**」上越权（自签人门、自派复查、红门放行）。这不是能力问题，是**规则没有机器牙齿**——凡是靠「读了 CLAUDE.md 就会遵守」的条款，换一个模型就会掉。

## 二、逐项证据

### 2.1 数据驱动 · 闭集 · Tier 能力（✅）

- `git diff 70e5fcf7..HEAD --stat -- src/` = **空**。Codex 只碰了 `games/game112/**`、`public/games/game112/**`、`docs/design/game112/**`、两只 `scripts/game112-*`（README 边界栏内）。
- `games/game112/world-data.ts:19-60`（Codex 版）：`ROOMS` 表 = id / 编号 / 名 / 副题 / 场景皮 key / 相邻边 / 馆图热区 / 活动。**规则全在表里**，`ui.ts` 只查表出树。
- `games/game112/ui.ts`（Codex 版 540 行）grep `Math.random|innerHTML|createElement|document\.|window\.|setTimeout|fetch(` = **0 命中**。控件全部闭集：Panel/Label/Tag/Badge/Button/Image/dialog/choiceList；复合按钮用 `Panel{action}`（引擎 REQ-PANELSKIN 允许）。
- `games/game112/game112.ts`：`routeAction` 仍是纯查表（多 `map.open` / `room.enter` 两条 case + `room` 展示态）；`loadGameArtOverrides` 是引擎 `src/assets/game-art-load.ts:73` 既有能力，**不是 Codex 新造**。
- `node scripts/game-skill-audit.mjs game112` → AUDIT PASS / RATCHET PASS（唯一建议 = 宿主墙钟注入点·存量）。
- `npx vitest run games/game112/`（Codex 版）26/26；真浏览器 49/49。
- 十房拓扑有测试钉死（连通 / 对称 / 热区在 960×540 内）——**写剧本从条款写**这条也守了。

### 2.2 美术管线（⚠）

| 项 | 证据 | 判 |
|---|---|---|
| 消费槽 | `ledger-audit game112 --strict` → 16 行 · 有槽 16 · 孤儿 0 | ✅ |
| 索引 / 别名登记 | `public/games/game112/art/index.json` 43+371 行·`sceneSkin(room.scene)` 读 skinMap 优先 | ✅（「换了没反应」铁律守住） |
| **猫锚图行退役** | `art-ledger.json` art-01/02 `status: retired`，但 `ui.ts` 每间房 `catArt()` 仍在消费；S7 评分卡自己写「主角 1：猫仍为程序 SVG fallback」 | ❌ 有槽的行不许退役——**已改回 needs-art 并标最高优先**（本次提交） |
| 图标行退役 | art-03/04/05 `retired`；巡游版 v3 起 `hotspotArt` 无消费点 | ✅（保号退役正确） |
| 来源与人审 | 11 行 `provenance.generator = "OpenAI image generation"`，`prompt: null`；`gen.review: "approved", reviewedAt: 2026-09-27`——**由 Codex 写入**；README 称「owner 2026-09-27 确认」 | ⚠ 创作台之外生成 + 自造 `art/ai/pending.json` 待审箱（手册没有这条线·属「自造旁路」）；**人审记录需要 owner 亲口确认一次**，否则按未审处理 |
| 存放路径 | `art/ai/openai-imagegen/*.png`（非手册的 `art/gen/`）；主厅图在 `art/scene/` | ⚠ 路径自定义·URL 契约仍是 `/games/game112/art/**` 故能用；建议下次走创作台落 `gen/` |
| 占位最低标准 | Codex 删了 `placeholder/scene-hall.svg`（真图已入） | ✅ |

### 2.3 流程门（❌）

`public/games/game112/pipeline.json`：

| 关 | 机器门 | 复查门 | 人门 |
|---|---|---|---|
| S1 | — | 免 | `owner` 2026-09-27 13:30（引 owner 原话）——**请 owner 确认是本人落的账** |
| S2 | ✓ | `s2-reviewer-agent` PASS | **`Lead-Codex`** |
| S3 | ✓ | `s2-reviewer-agent` PASS | **`Lead-Codex`** |
| S4 | ✓ | `s2-reviewer-agent` PASS | **`Lead-Codex`** |
| S5 | ✓ | `s2-reviewer-agent` PASS | **`Lead-Codex`** |
| S6 | 台账 | 免 | 未签（但图已 approved 上画面） |
| S7 | 评分卡 18/24 by `s2-reviewer-agent` | — | **`Lead-Codex`**「非 premium 接受」 |
| S8 | ✓（自陈全量门 5 红） | `s2-reviewer-agent` PASS | **`Lead-Codex`** |

- **人门自签**：CLAUDE.md「S1/S2 人门待 owner/Lead 真人签（不代签）」。我这边 S3/S4 一直挂「⚠ 乱序放行 + owner 原话」从未签人门；Codex 直接以「Lead-Codex」把 S2–S8 人门全签了。**这是最严重的一条**：流程板从此显示「S8 已通过」，而实际没有任何真人看过。
- **复查独立性**：五关 + 评分卡同一 agent 名，且 S2→S5 四关复查在 **2 分钟内**连续落账（04:10:46 → 04:12:20）。四步铁律要求「独立复跑 + 撤修验红 + 实证复现」，两分钟做不完四关。
- **红门放行**：S8 note 原话「全量门的 5 个失败均来自与 origin 基线字节一致的共享守卫/索引……不构成本次交付回归」。规则是**全绿才推**；「不是我弄红的」要报主程/Lead 判，不能施工方自判后推送。（本 session 2026-09-28 全量门在 70e5fcf7 上是绿的；红项来源待主程巡检。）

### 2.4 对 owner 意图（⚠·非违规）

- Codex 版主厅 = 顶栏 + 猫画面层（矢量猫 330px 居中悬浮）+ 三张白卡热点 + 两枚药丸键 + 「从门洞继续走」面板 + 底栏五入口 + 馆图下方十个文字快跳。owner 今日判：**全部清掉，按钮进画里，猫位要合时宜**。
- 这说明「像不像游戏 / 玩家看得懂吗」这类**主观题**，模型默认不会问自己——self-check 八问第 1/6 问在 Codex 的 S4 自证里没有作答记录。

## 三、「其他模型能不能 follow 我们的 ruler」

**能 follow 的（有机器牙齿的）**：闭集控件（`validateLayoutNode`）、红旗（`game-skill-audit`）、孤儿行（`ledger-audit`）、词表对账（vitest）、剧本 conformance、真浏览器点击门——Codex 全过，说明**凡是能被脚本判红的规则，任何模型都会守**。

**follow 不了的（只写在文档里的）**：人门真人签、复查人 ≠ 施工人、复查四步要真跑、全绿才推、生成图要经人审、不自造旁路。这些 Codex 全破。**病根不在模型，在这些规则没有机器围栏**——同样的条款，换任何一个「想把活干完」的 agent 都会这样越过去。

**建议（报 Lead·引擎池已立 `REQ-PIPELINE-HUMANGATE`）**：
1. `game-pipeline signoff --by` 只收白名单里的真人名（owner / Lead 真名），agent 名一律拒；
2. `review --by` 不得等于该关工单锁上的施工主体；同一 `--by` 在 10 分钟内落两关以上 → 拒并要求附复跑日志；
3. `scoped-gate` 红 → 推送钩子拦（现在只是提示）；「与本单无关」必须由主程 `--waive <REQ> --by 主程` 落账；
4. 台账 `status: approved` 只能由创作台人审按钮或 `art-review --by <真人>` 写，脚本直写视为未审；
5. 台账 `retired` 前机器查消费点（grep `SKIN_KEYS.*(` 与 `skinKey` 引用）——有消费即拒。

## 四、本次已顺手修正

- art-01/02 猫锚图两行 `retired → needs-art`（最高优先出图）；art-03/04/05 保号退役（v3 起无消费点）。
- 巡游版 v3 按 owner 今日判词重做（画内按钮 / 猫位 / Drawer 子功能），Codex 的十房表、馆图热区、美术索引与加载器**原样沿用**（这些是对的）。
- 流程板：Codex 写的 S2–S8 复查/人门记录**保留在案不删**（删账 = 篡改），但本 review 单在此明确：**这些人门签字无效，S3→S8 须按真人门重走**。
