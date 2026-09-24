---
name: module-fx
description: ZeroCraft 2D 渲染与特效模块线（play-field）。做战场/棋盘/角色贴图/血条/受击闪白/飘字/粒子这类「非 UI 的画面」之前调它。走 render 组件 + EffectKind 闭集，不走 LayoutNode（那是 /module-ui），也不手写 canvas 绘制。
when_to_use: 做 play-field 表现层——精灵、动画帧、血条、特效、屏震、飘字——之前。
---

# 2D 渲染与特效（module-fx）

**权威手册**：`docs/playbooks/rendering-fx.md`。

## 分工（最容易搞混的一件事）
- **UI / HUD / 菜单 / 面板** → `LayoutNode` 闭集 → **`/module-ui`**
- **play-field**（战场 / 棋盘 / 角色 / 场景物） → **render 组件** → 本线
两者都是数据，但词表不同。别拿 LayoutNode 画战场，也别拿 render 组件搭菜单。

## 基座件（实名·以 `capability-registry` 的 describe/examples 为准）
`Sprite`（贴图 key）· `Color` · `Frame`（动画帧）· `Gauge`（血条/进度）· **`EffectKind` 闭集**（特效种类）· 主题令牌。

## AI 生成视频当角色画面（REQ-112-ENG-11）
游戏**只给片段目录数据**，不写播放器。纯核 `src/engine/host/video-clips.ts`：
`selectClip`（按 `State{fsmId}` 选片）· `resolveChain`（**个性片→通用片→声明 fallback→基础活照片→静态图**·
**静态图永远算就绪 = 断网必达**）· `canCutClean`（尾姿势==首姿势才可直切）· `preloadCandidates` · `validateCatalog`。
UI 面 = `Video` 控件的 `bind`（同 `Image.bind`）/ `onEnded` / `fit`。
**播放进度与结束不进 sim**；`review` 缺省 pending，没审过的生成片不上画面。

## 本线红线
- **render-only**：表现层组件**不进 sim / 不进 hash**（须在 `src/net/determinism.ts` 的 `NON_DETERMINISTIC` 名单里）。
- **sim 只持 key**：贴图/动画在数据里只写**字符串 key**，真实字节在资产层（`/module-assets`）。**绝不塞 URL / 二进制**。
- **禁**手写 canvas 绘制 / 自由 DOM —— 表现走组件，渲染器负责画。
- 特效随机（散射/抖动）走种子 PRNG（`/module-random`），**禁裸 `Math.random`**。
- **反捷径**：别给素坯糊 Glow 冒充质感。视觉验收走 `docs/playbooks/visual-scorecard.md` 八维。

## 查不到怎么办
`EffectKind` 里没有你要的特效 → **绝不自己画**，走 **`/ask-owner`** 申请扩**一个**枚举。

## 交付前
`node scripts/game-skill-audit.mjs <slug>` 零红旗；宣称做完前跑 **`/align-check`**。
