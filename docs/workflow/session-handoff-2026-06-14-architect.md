# Session 交接 · 引擎主程/Lead → 新架构师（2026-06-14）

> 你接手 Apollo Engine 的 **引擎主程/Lead** 角色。先读最高纲领 `docs/design/data-driven-manifesto.md`
> 与 `CLAUDE.md`，再读本文。本文 = 上一任 Lead 本 session 的全部决策 + 现状 + 残留 TODO。
> 任务预期：全面代码 review + 残留问题改进。引擎代码外审包已打给 Gemini：
> `review-for-gemini-engine-2026-06-14.txt`（14 文件 + 7 个对抗 review 问题）。

---

## 0. 用户给 Lead 钉死的操作规则（必须继承）

1. **只动引擎架构级**：`src/{engine,skills,assembly,renderer,services,net,ui}`。**不碰游戏本身**（game-a..f 的数据/玩法/手写层）——那是游戏程序员（PF 等）的 lane。
2. **每条需求先评判，绝不"提什么做什么"**：能现有 capability 重组/已覆盖 → **回驳**（给等价数据写法）；确属数据驱动表达不了的真缺口 → 才**下沉成通用 capability**。
3. **防臃肿是头号红线**：不为单游戏私货 / 想象需求（未被真实数据拉动）提前拓宽引擎。**rule of three**。
4. **分支 `claude/mainbranch` 直推**；每次 `fetch → rebase → 重跑全套 → push`；**tsc + vitest + build 全绿才推**；署名 `Claude <noreply@anthropic.com>`，提交信息以 session URL 结尾。远端并行很活跃（多 session），push 常被拒→rebase 重试。

---

## 1. 本 session 9 个引擎提交（全绿已推）

| commit | 内容 |
|---|---|
| `4f65407` | **清 238 个 `as unknown as` + 修根因**：`World.addComponent` 非泛型→`<T extends Component>`（旧签名逼出全项目 cast）。去 cast 当场炸出并修了 8+ 潜伏类型错。 |
| `bf2c8fc` | **UI 壳迁出 src 根**：`src/game-f.tsx`→`src/games/game-f/`；AURORA/ONYX 皮肤外提到 `src/ui/themes/sanguo/theme.ts`（主题=数据）。 |
| `3d526b3` | **Level 2 · EntityBlueprint 装牙**：`src/assembly/component-map.ts`(新, 85 组件闭集 ComponentDataMap) + EntityBlueprint=`{[K in keyof ComponentDataMap]?: Record<string,unknown>}`（**组件名闭集**牙：拼错组件名→编译期报错；值暂松不误伤游戏）。 |
| `268aac1` | **REQ-F-061 · hitbox hp 门/处决**：`Hitbox.requireHpFracBelow?/requireHpFracAbove?/executeBelow?`（命中那刻只读目标 hp 比例做门；乘法比较保确定）。 |
| `8c49ef2` | **Stage 1 · GameShell 通用「布局即数据」解释器**：`src/ui/shell/{types,GameShell}.tsx`。事件=信号名、绑定=resourceId、主题=GameTheme token。 |
| `764d39b` | docs：game-f 去腐交办(LEAD→PF) + v1 合规审查范围勘误。 |
| `80100bf` | GameShell 加通用 `image` 节点 + Lead 裁决记录。 |
| `ef3640f` | GameShell `image` 资产 key 解析（`resolveAsset` DI；sim 持 key 保纯，URL 不进 hash）。 |
| `11f584a` | **card-pile.runsBefore 补 'keybind'**：破 card-pile↔keybind↔event-when 三元环（对称既有 clickable）+ 守护测。 |

---

## 2. 关键裁决（"为什么"——继承这些判断，别推翻重来）

- **「数据驱动 ≠ 零函数」**（本 session 最重要的澄清）：黄金范本 `game-b` = `data/game-b.manifest.json`(纯数据) + 85 行薄 loader 展开。判据是 **"内容扁平 + 展开器薄/固定/确定"**。据此：
  - `band/visSwap/chrome`（按调用现编实体接线的**编排生成器**）= 真腐烂 → PF 已展平（blueprint 生成器 56→18）。
  - `makeRoundFlow`(pacing 配置) / `templatesFor`(roster 数据→prefab + 阵营选择) = **薄确定性展开器** = game-b loader 同类 → **回驳字面化**（硬展会砸 36 处测试快进 + 多阵营）。
- **REQ-F-061**（hp 门/处决）= **ACCEPT**：真缺口（hitbox 命中那刻读不到目标 hp 比例）、通用战斗原语、数据扁平。已落地 + PF 已接进 combat.ts。
- **REQ-F-062**（aggro 索敌策略）= **打回提出人**：① 嘲讽不属本能力（目标侧机制）② highestStat 欠 stat 来源 ③ 未被真实数据拉动（仅设计稿 HTML）。等真单位拉动再落 nearest/farthest/lowestHp。
- **REQ-023**（group-effect fan-out）= 倾向回驳（YAGNI，可 group-count→全局 buff 重组）。
- **REQ-F-057**（战斗跨端确定性探针）= **ACCEPT、待建**：纯测试/零引擎表面；**用户 6-14 说 game-e/f 就要联机=真拉动**。⚠️ 同进程双实例只证"泄漏/迭代序"确定性 + hash 无浮点；**真跨平台浮点一致需真跨平台 CI 或定点化**，探针替代不了。
- **GameShell 通用节点**：加了 `image`（rule-of-three 达标）；**故意不加 `list`/`grid`/`modal`**（模板化 DSL 是腐烂高风险区，YAGNI，等真干净跨游戏拉动）。商店=固定 3 槽 → 3×(image+stat+button)，不需 list。棋盘拖拽留 canvas（drag-place），不归 GameShell。
- **gap1 action→signal**（PF 当新缺口提）= **回驳**：已被 `keybind`(`t2-keybind`) 覆盖（它自陈是 clickable 的非空间孪生）。recipe：`KeyBinding{key,signal}` + keybindCapability。

---

## 3. 现状：game-f 腐烂度（本 session 末重测，同口径）

| 指标 | 首轮 | 现在 | |
|---|---|---|---|
| blueprint.ts 生成器构造 | 56 | **18** | ✅ 编排层已收敛（去腐赢了这块） |
| 生产 `as unknown as` | 0 | **0** | ✅ 守住（16 个在**测试**文件，懒 addComponent cast，低危待清） |
| **手写 React（game-f.tsx+lobby.tsx）** | 697 | **869** | ❌ **没动**——GameShell **0 采用**，还新增 lobby.tsx |
| 商店两段脉冲 | 114 | **103** | ❌ 没动——GameShell 商店迁移没落地 |

**一句话现状**：引擎工具全齐（GameShell/image/resolveAsset/keybind/hp 门/EntityBlueprint 牙/manifest loader）；**game-f 腐烂主体 = "GameShell 建好却 0 采用" + 869 行手写 UI + 103 脉冲**。这不是再加引擎能力能解的，是**游戏侧采用**（PF 在做，用户已催）。

---

## 4. 残留 TODO（给你，按优先级）

1. **🔴 review PF 的 GameShell 采用**（进行中，用户已催）。验收清单：GameShell 真被引用(现 0)、`game-f.tsx`→~30 行薄 mount+`GAME_F_UI` 数据、手写 React 869→大降、商店脉冲(shop_marks 17/gate 5)→0、假点击桥(x=2000)退役→走 keybind、image 走 resolveAsset(sim 持 key)、UILayout 过"最弱 LLM 可填"尺子、**引擎零新增**、全绿 + 确定性 hash 不变、片0 快照守按"UI 搬出 canvas=实体数降"重基线。
2. **🔴 建 REQ-F-057 战斗跨端确定性探针**（联机真拉动了）：扩 `src/net/lockstep` 双实例跑 game-f 战斗蓝图 N=3000 拍逐拍比 `e.hash()`；红=报首个发散拍 + 组件 diff。范式见 `src/net/coop-cards.test.ts`。注：`hashSnapshot` 已排除 `Camera`/`ScoreTrace`（`src/net/determinism.ts` NON_DETERMINISTIC 集）——**核 Transform(浮点) 在不在 hash 里**，这是跨端命门。
3. **🟡 EntityBlueprint Level-2 收紧**（phase 2）：值 `Record<string,unknown>`→`Partial<ComponentDataMap[K]>`（字段级牙），**前提=游戏侧把无类型 helper 类型化**。落地后可**批量删机械 shape 测试**（用户关切的"测试太多"，正解是用类型替代而非乱砍）。
4. **🟡 game-f blueprint 实体 → JSON manifest**（照 game-b；makeRoundFlow/templatesFor 留薄 loader）。游戏侧。
5. **🟢 清 16 个测试 cast**（game-f decks/combat/taikou 测试的懒 addComponent；addComponent 泛型化后已无必要）。
6. **测试体检**：本 session 裁定**暂不砍**（1165 测多是确定性/能力契约审计=承重墙，18s 不慢）；待 #3 字段级牙落地后再批量删可被类型替代的机械测试。

---

## 5. 注意事项 / 坑
- 远端 mainbranch 并行极活跃（多游戏 session）；每次推前 fetch→rebase→**重跑全套**（陈旧基线的绿不算绿）。
- 片0 快照守 `src/games/game-f/blueprint-snapshot.test.ts`（entityCount 479 / digest）：纯平移片保 byte 等价；UI 搬 canvas→DOM 是**真迁移**会变，需重基线 + commit 注明 delta。
- 拓扑成环是本项目高危区（已 5 例：REQ-F-025/028/031/036 + 本 session card-pile↔keybind）。改任何 system 的 reads/writes/runsAfter/runsBefore 前，先想清 Signal/RMW 边。显式具名边覆盖反向推断边（F-028 裁定：采具名不采泛化）。
- combat.ts(game-f) 已被 PF 接 `executeBelow`（F-061 被真实消费=非空头能力）。

> 复诵：我是会架构评审、敢带理由回驳的 Lead。整个游戏是数据；代码只属于引擎这台固定的确定性解释器。**防臃肿 = 不为一个游戏的私货往共享引擎堆能力。**
