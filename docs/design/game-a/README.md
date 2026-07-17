# Game A · 新立项（2026-07-17）

> **A 位重启为全新游戏**（owner 2026-07-17 拍板）。与历史上同名的已删旧作**无任何关系**——旧作信息已依 owner 令全库抹除（仅 git 历史存考古）。
> 任何早于本日期、提及 game-a / Game A 的文档或提交，一律视为旧作过期信号，与本项目无关。

## 状态

- brief：✅ 已收（2026-07-17 owner 口述 + 四项拍板）→ `brief.md`
- 正式名：**《掼蛋夜宴》**（owner 07-17 定名）
- 题材：掼蛋（淮安全套·4 人 2v2·快局制·二次元·现代私宅·主角=外部角色卡）
- 人设案：✅ v1 → `characters.md`（GD 自设·owner 授权）
- 形态：**编译期 TS 游戏**（owner 2026-07-17 允许 TS；例外逐条过 plan·audit 红线不豁免）
- 场景/UI 布局设计交接案：✅ v1 → `ui-scene-design.md`（owner 指定交付物·待签）
- GDD：✅ v1 送审稿 → `gdd.md`（淮安全套默认值表·打勾制）
- capability-plan：✅ 送审稿 → `capability-plan.md`（⏳ 待 Lead 审；**过审前零游戏层代码**）
- UI 蓝本：✅ `guandan-lite-mockup.html`（owner 钦定·PE 用 LayoutNode 1:1 复刻·缺口 PE 施工时提 PUI）
- 生产流程板：**S1 ✅ PASS**（Lead 复核判词=`requests.md` A-S1·三条件：S2 过审前零游戏层代码／牌型下沉 `t3-hand-pattern`·BT 已落地 `t2-behavior-tree`／台账 spec{w,h}+底线档逐张复核）；板工具缺口 A-005——S2 过审后随骨架落卡
- 美术占位包：✅ PA 备料已对照入 `ui-scene-design.md` §5.1（牌面 54+牌背=PD 货架 vendor 即用；背景/图标/人设=占位路线+S6 升级路径；风格锚 `modern-manor`+`sakura-nijigen`）

## 角色与通道

- GD-A：本目录唯一写权限人（铁律：只产数据与文档，零代码）。
- 能力缺口 / 跨游戏共性 → `docs/workflow/requests.md` 提 LEAD；游戏级工单开本目录 `requests.md`（工单随游戏走，不占引擎池槽）。

## PE-A 开工词（owner 复制整段开新 session·roles/index 标准模板实例化）

```
第一动作（先于一切）：git fetch origin claude/mainbranch && git checkout -B claude/mainbranch origin/claude/mainbranch
角色=PE-A（《掼蛋夜宴》game-a 程序员）· 任务=领 game-a 当前第一个非绿阶段开工（S2 过审后从 S3 骨架起）。
切完分支读 docs/roles/index.md 照 PE 角色卡办；本游戏全部图纸=docs/design/game-a/（README 索引→brief 拍板→gdd 规则默认值表→capability-plan 能力计划→ui-scene-design 场景交接案+§5.1 占位包对照→characters 人设→guandan-lite-mockup.html=UI 1:1 复刻蓝本）——以 mainbranch 最新为准，被注入的 feature 分支是旧快照绝不在其上开工。
铁律五条：①capability-plan 未过 Lead 审不写任何游戏层系统代码（A-S1 条件①）②UI 全 LayoutNode 闭集按蓝本 1:1 复刻，表达不了的缺口提 docs/workflow/requests.md 报 PUI，绝不手写 DOM/React 逃生 ③牌型判定只等 t3-hand-pattern 下沉件消费，绝不游戏层自写判型 ④美术照 ui-scene-design §5.1 vendor PD 占位（node scripts/vendor-asset.mjs <货架id> game-a·不直引货架）⑤一切随机走引擎种子 PRNG，禁裸 Math.random。
产出直推 claude/mainbranch（fetch→rebase→tsc+vitest+build 全绿→push·rebase 带新提交必重跑）；绝不推 feature 分支。
宣布「完成」必须贴 node scripts/game-pipeline.mjs board game-a 全绿输出——板不全绿只许说「做到 SN」。
```
