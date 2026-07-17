# game-c《六人德州》· 游戏级需求单（工单随游戏走 · 不占引擎池槽）

> 号段从 **REQ-C-101** 起编（旧作遗留 REQ-C-001~004 已归档，防撞号）。
> 引擎池（`docs/workflow/requests.md`）现 10/10 满；本表条目待 Lead/owner 认为值得升格时再进池。
> 备注：原拟 REQ-C-101（摊牌比较）/102（下注圈边池）/103（行为树）三条引擎下沉单，
> 依 owner 2026-07-17「本项目允许 TS」口径**撤单**——转为 game-c 内 TS 模块（`capability-plan.md` §4-a/b/c），
> 攒出第二消费方再议下沉。

## 待处理

### REQ-C-104 · 角色卡「玩家档案」通道：外部带入主角姓名+头像（立绘字段预留） · [2026-07-17] · 提出人 GD-C → 待 PST/Lead 裁决 · status: open · 优先级: P1（M4 前需要·不阻塞 M1 逻辑） · 类型: 创作台/卡带 meta 数据通道（跨域：PST 主责·引擎装配层读取）
> **想要的行为**：游戏外部（工坊/launcher 档案）配置一张「角色卡」：`{ name, avatar(资产 key), portrait?(立绘·预留) }`；
> game-c 启动时读到它，主角座位铭牌/结算屏以该身份呈现。
> **已探明现状（2026-07-17 全库探查）**：`LibraryMeta`（`src/studio/library-model.ts:22`）仅 name/subtitle/description/color/icon，
> **无任何玩家档案字段**；launcher/studio/manifest-game 均无现成通道——真缺口，非重组可解。
> **建议方案**：meta（或 launcher 全局档案）加可选 `player` 字段 → 蓝图装配层读取 → 填 `Text`（姓名）/`Sprite.textureKey`（头像）/`WorldUI3D`（桌边铭牌）。头像图走资产索引（PA 线）。
> **游戏侧不阻塞**：game-c 装配层先留 `PlayerCard` 注入点（默认档案兜底），通道落地即接。

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
