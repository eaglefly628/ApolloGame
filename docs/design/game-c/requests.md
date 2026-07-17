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
