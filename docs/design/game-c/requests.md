# game-c《六人德州》· 游戏级需求单（工单随游戏走 · 不占引擎池槽）

> 号段从 **REQ-C-101** 起编（旧作遗留 REQ-C-001~004 已归档，防撞号）。
> 引擎池（`docs/workflow/requests.md`）现 10/10 满；本表条目待 Lead/owner 认为值得升格时再进池。
> 备注：原拟 REQ-C-101（摊牌比较）/102（下注圈边池）/103（行为树）三条引擎下沉单，
> 依 owner 2026-07-17「本项目允许 TS」口径**撤单**——转为 game-c 内 TS 模块（`capability-plan.md` §4-a/b/c），
> 攒出第二消费方再议下沉。

## 待处理

### REQ-C-105 · [P0 复查打回] betting-engine 边池结算筹码蒸发（大盲短缴 all-in + 弃牌）· [2026-07-17] · 提出人 GD-C（S4 复查门对抗核证）→ 指派 PE-C 修 · status: open · 优先级: P0（阻塞 S4 放行·M2 前必修）· 类型: 游戏层 TS 正确性 bug（capability-plan §4-b）
> **S4 复查门裁定=FAIL 打回**（复查人 GD-C≠施工 PE-C）。50 测独立复跑绿，但均为**场景测、未覆盖守恒 property**——对抗性 fuzz 一跑即现。
> **根因**（`betting-engine.ts:287-295` potLayers refund）：未被跟注溢出的 `top` 仅从 **live（未弃）** 取。`startHand:149` 把 `currentBet` 强制设为 bigBlind，当大盲栈<大盲=短缴 all-in 时 currentBet **虚高于任何人实缴**；此时部分匹配该线后弃牌的玩家可成为**全场最高投入者却已弃牌**，其超出最高 live 投入的差额既不进池（caps 只来自 live total）也不退回（refund 只认 live top）→ 蒸发。
> **复现（GD-C 亲手 vitest 验证）**：heads-up·SB 栈1000 缴25 / BB 栈10 短 all-in 缴10 / SB 面对 toCall25 弃牌 → uncontested BB。引擎 refund=null·池20 给 BB·终栈 [975,20]=995，起始 1010 → **漏 15**（应退 SB 未被跟注的 15 → [990,20]）。fuzz(30000 手/2-6 人)：67 手漏 214 筹码。**现金局剥光玩法终局栈常低于盲注，此路径高频；M2 万手 AI sim 必撞、任何守恒断言必发散。**
> **修法（对抗子代理验证·0 泄漏/50 测不变/非 bug 路径 behavior-identical）**：refund 的 top 取**全体** players 非仅 live——
> ```ts
> const sortedAll = [...st.players].sort((a, b) => b.total - a.total);
> const top = sortedAll[0];
> const second = sortedAll[1]?.total ?? 0;
> if (top.total > second) { refund = { seat: top.seat, amount: top.total - second }; totals.set(top.seat, second); }
> ```
> （全场最高是 live 时 second=原 othersMax → 行为不变；仅弃牌者为最高时才纠偏。）
> **必带（防回归·测试方法论缺陷）**：加**守恒 property fuzz 测试**（随机合法动作序列 → 断言 Σstack 全程不变）——现套件只在固定场景断言 totalChips，正是漏网原因。
> **P1 建议（可同修）**：①settlement 防御纵深——任何 eligible 为空的池层退回贡献者（未来状态机改动无条件守恒）；②`legalActions.call` 可超栈（act→pay 已 clamp），加 `Math.min(toCall,stack)` 或文档锐化防 AI/UI 误读。
> **修完**：重跑复查门（另一双眼睛 + fuzz）再放行 S4；其余维度（rank5 kicker/wheel/行动闭合/短 all-in 不重开/死按钮/确定性/数据驱动）复查 **REFUTED=clean**，无需重审。

### REQ-C-104 · 角色卡「玩家档案」通道：外部带入主角姓名+头像（立绘字段预留） · [2026-07-17] · 提出人 GD-C → **⚖ Lead 接单出图（2026-07-17·owner「有需求就做掉」）→ 指派：Opus（PST 域施工）** · status: **✅ done·Lead 对抗性验收 PASS（2026-07-17）** · 优先级: P1（M4 前需要·不阻塞 M1 逻辑） · 类型: 创作台/卡带 meta 数据通道（跨域：PST 主责·引擎装配层读取）
> **想要的行为**：游戏外部（工坊/launcher 档案）配置一张「角色卡」：`{ name, avatar(资产 key), portrait?(立绘·预留) }`；
> **⚖ Lead 对抗性验收（2026-07-17·判 PASS）**：独立复跑全绿（tsc·vitest 368 文件/2928·build）；域界零越线（games/skills/engine/apollo.py 全 0 触碰）；12 新测含坏档/headless/往返/空名禁用。偏差四条全 INTENTIONAL 准许：avatar↔avatarUrl 归一（调和图纸与 §0 字段差·一个 ?? 两头吃）；档案卡独立文件=launcher 子件既有架构（「不新立组件」正解为 LayoutNode 闭集不扩·launcher React 壳同 SettingsPanel 先例）；游戏侧 adapter 接线随各 PE 走（正确守域）；清除按钮 additive。**三游戏 M4 前的外部依赖清零。**
> **⚖ Lead 图纸（2026-07-17·三游戏共享通道·格式 v1=game-b B-001 拍板「仅 name+avatar」）**：①`src/services/profile/` 引擎侧只读 API：`getPlayerProfile(): {name:string, avatarUrl?:string} | null`——浏览器读 `localStorage["apollo.playerProfile"]`（JSON·坏档返回 null 不抛）·headless/无 window 返回 null；`portrait` 字段预留进类型不实装。②launcher 档案入口（PST 域·`src/launcher.tsx` 既有设置区加最小档案卡）：名字输入 + 头像选择（内置预设 emoji/头像框数枚·不做上传——上传走资产线属后期）；存 localStorage 同键。③三游戏消费=各自 adapter 读 API（a/b/c 已按最小集设计·零返工）；无档案时游戏用内置默认（「主角」+占位头像）。④测试：service 坏档/无档/往返各一 + launcher 档案卡渲染断言。红线：不碰游戏目录；不新立组件；档案不进 sim/hash（装配期读一次成蓝图数据）。
> game-c 启动时读到它，主角座位铭牌/结算屏以该身份呈现。
> **已探明现状（2026-07-17 全库探查）**：`LibraryMeta`（`src/studio/library-model.ts:22`）仅 name/subtitle/description/color/icon，
> **无任何玩家档案字段**；launcher/studio/manifest-game 均无现成通道——真缺口，非重组可解。
> **建议方案**：meta（或 launcher 全局档案）加可选 `player` 字段 → 蓝图装配层读取 → 填 `Text`（姓名）/`Sprite.textureKey`（头像）/`WorldUI3D`（桌边铭牌）。头像图走资产索引（PA 线）。
> **游戏侧不阻塞**：game-c 装配层先留 `PlayerCard` 注入点（默认档案兜底），通道落地即接。
> **✅ 回执（Opus·PST 域施工·2026-07-17·待 Lead 对抗性验收）**：① 只读 API `src/services/profile/{profile-port,index}.ts`——`getPlayerProfile()` 读 `localStorage["apollo.playerProfile"]`，坏档/无档/headless 一律 null 不抛；`portrait` 仅进类型不读；兼容共享卡 `avatar` 字段归一到 `avatarUrl`；**无 setter=只读**，档案不进 sim/hash。② launcher 档案卡 `src/launcher/profile-card.tsx` + 顶栏 👤 入口（名字 + 10 枚预设 emoji 头像·存同键·无新增资产文件）。③ 消费口径=游戏 adapter 调 API（游戏目录未碰，属各 PE/GD）。④ 测试 12 例（service 7·launcher 5·含往返/坏档/无档/headless/入口接线）。门禁：tsc 0 · vitest 368 文件 2928 例全绿 · build 绿 · docs-ref/context-budget/component-manifest guard PASS。**未碰** games/skills/engine/apollo.py。

### REQ-C-ART-美术拍板包 · owner 2026-07-17 三拍板 Lead 落档（台账自此可开建） · 指派：GD-C（回填 gdd §7/§11-l）+ PA（风格包条目） · status: open · 优先级: P1
> ① **风格锚=拉斯维加斯奢华 × 维多利亚**：风格包 id `vegas-victoriana`（PA 落 `scripts/style-packs.json`·锚 v1 Lead 草拟·owner 可配参考图精修）：
> `opulent Las Vegas casino meets Victorian elegance: gilded gold ornament, deep green felt, burgundy velvet, crystal chandelier glow, ornate baroque frames, warm dramatic lighting, high readability, game asset, no text, no watermark`。调色板基准 8 色：鎏金 #D4AF37 / 呢绿 #35654D / 酒红 #7B2D3B / 檀黑 #2A1F1E / 象牙 #F2E8D5 / 紫罗兰 #6B4E71 / 古铜 #B87333 / 烛光 #FFD9A0（PA 定稿微调）。
> ② **五姨太人设定稿（性格↔策略模板↔头像一体·Lead 提对位·GD-C 可微调命名）**：大姨太=淑女（端庄礼致）↔紧凶 · 二姨太=富饶雍贵（珠光宝气）↔松凶 · 三姨太=冷静（静水深流）↔岩石 · 四姨太=清纯可爱（天真烂漫）↔跟注站 · 五姨太=狡猾狡诈（笑里藏刀）↔诈唬狂。
> **头像=4 态/人**（常态 + 懊恼 + 胜利 + 犹豫思考——owner 口径「三种表情」·若要犹豫/思考拆分则 5 态·owner 目检首批后定）→ 头像 20 行。**头像行 prompt 硬约束：成年角色明示 + 着装完整**（分级合规锁在生成源头·台账行级规范）。
> ③ **衣物图标=个性化 30 件**（5 人×6 件·图标级 128×128 透明·样式随各人设·**只画物件不画人身**）。
> ④ **Lead 已裁三件**：52 牌面=vendored PD 定案（行直接 replaced·provenance=vendored·不进生成预算）；凳/墙/地程序化免槽例外=准；台账脚本参照 **game-d 样板**（3D inventory 先例·扫 Material3D/Decal3D 贴图槽·非 game-q 2D 样板）。
> ⑤ 机械件：`scripts/game-c-art-ledger.mjs`·mergeLedger 保号·行行引 `vegas-victoriana` 锚（不手抄）；spec{w,h} 建行前向 P3D 要俯视角消费分辨率口径。**首版行数估算（快照）**：头像 20 + 衣物 30 + 牌面 53（replaced）+ 筹码 5 + 桌呢/按钮/头像框/房间件 ≈8 ≈ **116 行（needs-art ≈63）**。

### REQ-C-立绘换装（典当脱衣表现） · TODO（owner 2026-07-17「先记需求·外面再做」） · status: 挂起待 owner 拉起 · 类型: 后期美术立项
> 方向：典当后人设立绘随之换装——分层立绘美术（每角色×每衣物层·量大）单独立项。**届时前置硬条件**：①内容分级口径定案（Steam 成人内容申报/区域合规·gdd §11-j）②所有角色成年设定在人设档明示 ③分层立绘规格 spec（层对齐/锚点/规格）④生成 prompt 合规约束随行写死。本期口径不变：头像不随典当变化（清单置灰+件数徽章）。不阻塞 M1-M5。

### REQ-C-ART-拍板包修订① · owner 2026-07-17：人物线风格与 game-b 统一 · Lead 落档
> **双锚制定稿**：**人物线**（五姨太头像 4 态×5、衣物图标、将来立绘）改用与 game-b 共享的女性向二次元锚（风格包 `sakura-nijigen`·PA 落一次两游戏引用）；**场景线**（牌房/桌呢/筹码/庄家按钮/头像框等）保留 `vegas-victoriana`。台账建行时人物行引 sakura-nijigen、场景行引 vegas-victoriana，行行不手抄。
> **会审项（GD-B×GD-C → 提案报 owner）**：b 三姨太与 c 五姨太是否同一家族人设（局外系统金钱/衣着互通暗示同宇宙）——若是则人设库共享（大/二/三共用立绘头像·c 增四/五两位·美术省近半），性格对位冲突处（如"三姨太"两案不一致）统一后报 owner 终定。

> **⚖ owner 终字（2026-07-17·并 REQ-C-ART 修订①会审项销案）**：三套人设各自独立——五姨太由 GD-C 按 `sakura-nijigen` 人物锚自设五案（人设不与 a/b 共用·风格锚共用），按拍板包 ②的性格对位出图。
