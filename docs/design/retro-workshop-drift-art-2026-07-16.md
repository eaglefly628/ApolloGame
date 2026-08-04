# 历史回顾 · 创作台生产线：手册防漂移 + 美术台账 + 文生图就绪（2026-07-16·Lead 亲笔）

> owner 命题：「用创作台开发时，手册怎么不漂移（我总有点怀疑）；过程中的美术账本要非常清楚；我要去申请文生图方案换一遍美术图。」
> 本文=证据回答。所有数字带日期快照；机读真相以指针为准（`docs/llm-onboarding.md` §0 铁律）。

## 一、防漂移机制时间线（我们先后装的牙）

| 时间 | 机制 | 管什么 |
|---|---|---|
| 2026-06-22 | 交接档薄指针化（`docs/workflow/SESSION-HANDOFF.md:4`） | 不再手抄现状——第一次口径漂移教训 |
| 2026-07-02 | llm-onboarding §0 机读口径铁律 | 文档不抄数字，一律指机读单一真相（capability/原子/控件/游戏清单全部指代码） |
| 2026-07-03 | 手册体系 `docs/playbooks/`（15+ 线·每本 ≤80 行） | 先查后做；查不到提缺口绝不自造；**手册对产出游戏负全责** |
| 2026-07-03 | 问责定性律（CLAUDE.md） | 凡绕基座=手册缺陷，修游戏必同步修手册/提缺口 |
| 2026-07-04 | `scripts/docs-ref-guard.mjs`（进 vitest） | 手册/角色卡里反引号路径/脚本名/agent 名的**存在性**，断链点名到行 |
| 2026-07-03 起 | 回填铁律：能力下沉**同一提交**回填手册一行（`docs/playbooks/index.md:51`） | 手册与代码同步演进 |
| 2026-07-16 | `scripts/context-budget-guard.mjs`（`7b944929`→`4e4a351a` 扩面） | 需求池 10 槽/字符预算/T0 文件数/手册行数——新 session 读得完 |

## 二、真实漂移事故账（7 起·怎么漂→怎么发现→怎么补）

1. **「26 原子」在 11 处漂移**（原型教训）：注释写 26、实为 29/30。补=§0 机读铁律。（`docs/llm-onboarding.md:4`）
2. **game-d Title/HUD 绕基座**：手写牌型判定与引擎 `poker-hand.ts` 同构重写、全裸 Math.random。发现=07-02 引擎评审；补=催生手册体系+计划门。（`docs/design/engine-llm-readiness-review-2026-07-02.md`）
3. **game-e 1163 行 React 屏**：CLAUDE.md 曾给不实豁免。发现=同评审 §3.3；补=标"反面教材勿模仿"。
4. **game-k 手写 canvas 绕美术管线**：当时无门禁抓，owner 07-10 点名才现形。补=game-skill-audit 加「无美术台账」黄旗 + 计划门补美术必填项（`docs/design/capability-plan-template.md:40`）。
5. **生成 prompt 手抄组件词汇表**：漏 Hierarchy/StringVariable/全部 3D 原子。补=改自动 catalog 导出（07-02·防漂移收口）。
6. **PA 库存数字自漂**（4761 vs 4892）：补=数字带快照日期+指机读 index（docs-ref-guard 管不了数字，只核路径——工具边界要认）。
7. **本周活案例·REQ-UI 锚定 entity 路**（2026-07-16）：手册行写「游戏战场用这个」，实为零生产者死路——**机器门全绿也拦不住**，靠 Lead 对抗性验收抓获（requests.md 该条判词·偏差 B 已打回 PUI 修注）。

## 三、判定：owner 的怀疑，哪部分成立

- **路径类漂移：基本拦住了。** docs-ref-guard 断链点名到行；最近 30 提交（快照 2026-07-16）能力下沉的手册同提交回填**零反例**（20/30 提交同步动了 playbooks，未动的 10 条均非能力下沉）。
- **数字/状态类漂移：半拦住。** §0 铁律管住了手册，但**工单状态行仍会过时**——活案例：REQ-AIGEN 写「运行时/设置 UI 未做」，实际已随 Workshop/T1/T2 建成（本次核账纠偏，见 §五）。守卫核不了语义。
- **语义类漂移（手册说的≠运行时真相）：只有人审兜底。** 事故 7 证明机器门（tsc/vitest/build/守卫全绿）对"写了但走不通的路"无感。现有兜底=对抗性验收（真浏览器必查）+ 手册行指活范例（game-i 段）。**残余风险就在这一类——owner 的直觉是对的。**
- 补牙建议（候选·owner 拍板）：docs-ref-guard 扩面③——手册行引用的 game-i 样例段 id（`t-anchor` 这类）核对 `games/game-i/gallery.ts` 中真实存在；让"手册行必须指向可跑活范例"从惯例变机器门。小活、确定性、PUI/Lead 皆可落。

## 四、美术台账核账（快照 2026-07-16）

- **本体**：g=110 行（53 replaced / 57 needs-art·`public/games/game-g/art/art-ledger.json`）；d=83 行全 replaced（真手绘已交付·Cloud Design）。行行带：稳定编号 no（保号主键）、skinKey、确定尺寸 spec{w,h,transparent}、英文 query（尾部统一风格锚）、人工 prompt 位、status、gen 产物指针、provenance 硬字段。
- **保号机制成立**（代码级核实）：`scripts/art-replace.mjs mergeLedger()`——改 spec 重跑，旧行保 no/status/gen/provenance/history/人工 prompt，新槽 maxNo 顺延，消失槽打墓碑不删账。g 入口 `npx vite-node scripts/game-g-art-requirements.mjs`（append-only）；d=纯扫盘全量重建（已交付态，无保号需求）。
- **写回链**：工坊素材屏逐行 ⤵ 替换/⬆ 上传/⚡ 重生成 + ↩ 一键还原（`7c384a41`·orig 快照精确复位·原图保留）。**诚实记账：这条链 07-15 才第一次端到端真跑通**（`8e1523d8` 修两根因：vite dev 不伺服新建文件致大叉；art-replace fill 分支 TDZ 崩致 regenerate 从未成功过）。
- **诚实边界（未台账化）**：战斗屏 bespoke 兵牌面（接立绘需 owner 点头设计）、正文行内 emoji 长尾（约 20 枚）、天罡 38 张逐张牌面（现按 kind 图标覆盖）、art-68 between-backdrop。出处：查 git 历史 REQ-G-ART-v2 回执。
- **缺口（账本"非常清楚"还差的一块）**：**无「台账行↔资产文件↔游戏引用」三方自动核验**——asset-reconcile（`06dbe847`）只对 index.json↔磁盘↔spec key，明确跳过 art-ledger；台账 servedPath 是否在盘、replaced 是否真接消费点，目前靠 owner 报错人工定位（row-54 大厅背景板、天罡 art-87 无消费点都是这么漏的）。建议（候选）：asset-reconcile 加 `--ledger` 面（读台账 rows 对 servedPath/消费点），PA 域小活。

## 五、文生图就绪度（owner 申请方案前该知道的硬信息）

- **全链已建成且 mock 全绿**（比 REQ-AIGEN 工单描述先进——该条状态行已随本文纠偏）：台账推导→`dialectPrompt`（行主体+风格包+每游戏风格锚）→批量生成→本地 index 登记（provenance 硬字段缺一拒登）→写回 manifest/skinKey→人审门→断点续跑（cacheKey 防重扣费）→一键还原。工坊 UI（台账墙⚡一键全量+单槽三式）与设置页 key 管理（打码回显·不落日志）都在。
- **真卡口只有两个**：① **目标服务 adapter**——真实装的 2D adapter 只有千问万相（DashScope·`DASHSCOPE_API_KEY`）；Seedance/Nano-Banana/PixVerse 只有 key 槽位没有 adapter（owner 07-11 曾注 Seedance=2D 主力）。**申请方案时请连带确认服务商 API 形态**，回来照 qwen 形状（submit→poll→download）新写 adapter 即可。② **真 key 端到端从未跑过**（本环境网络封闭）——需放宽网络的 session 做首次真调冒烟。
- **全量铺开前的鲁棒性补件**（非阻塞开跑·影响质量/成本）：真图恒 1024×1024 **忽略台账行 w/h**（需生成后缩放/校验到槽位规格）；失败无重试（只标 failed）；批量逐游戏跑（无跨游戏总驱动）；**零花费统计**（P2 未做·真 key 后盲跑有超支风险）；refImage 参考图未接线（保风格一致的关键入参·连着风格库方案）。
- 配套方案见姊妹篇：`docs/design/styleset-artlib-plan-2026-07-16.md`（统一风格共享美术库·结构图纸）。
