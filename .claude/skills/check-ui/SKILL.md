---
name: check-ui
description: ZeroCraft 2D UI 自检仪式。做完/改完任何 LayoutNode UI（HUD/菜单/面板/VN chrome）后、交付前跑它——过防重叠/对比度/透明度/布局卫生四关 + validateLayoutNode 零 issue + ui-audit 归零。凡碰 src/ui/components 的 LayoutNode、game UI 屏、HUD → 交付前用它自检。
when_to_use: 建或改任何 2D 数据驱动 UI 之后、宣布完成之前。防「重叠 / 糊字 / 透穿」这类 schema 挡不住但仍是坏 UI 的问题——靠工具量，不等 owner 挑错。
---

# ZeroCraft 2D UI 自检仪式

**完整手册（权威·先读对应段落，别复述记忆）**：`docs/design/ui-playbook.md`。本 skill = 它的可执行摘要 + 收尾门禁。最高纲领 `docs/design/data-driven-manifesto.md`：UI 也是数据；控件是闭集词汇；写世界靠 `action` 信号，handler 里绝不塞自由逻辑/CSS/DOM。

## 建 UI 时按序（摘要）
1. **选控件**：只从闭集 `ComponentType` 选 → 读 `src/ui/components/catalog.ts`（whenToUse + schema + sample）。别凭记忆猜 prop。
2. **抄范例**：`games/game-i/`（`gallery.ts` 全控件 / `mmo-hud.ts` 最复杂 HUD）是活模板。
3. **组合不逃生**：能重组就重组；表达不了 → 写 `docs/workflow/requests.md` 让主程扩**一个**闭集 kind/控件。**永不手写 React / 自由 CSS·DOM**（UI 铁律）。

## 四关自检（交付前必过·核心）
1. **★防重叠（最高优先）**：绝对定位 `x/y` 最易撞。优先流式（`direction:row/column/grid` 天然不叠）；`bare` 分组别叠框；坐标按**实测包围盒**排——padding 撑宽（声明 256 实测 274）、内容撑高（多一行数字/label），**先渲一次量真实尺寸，别脑补**。`fx` 别直接挂 `x/y` 节点（sheen 的 ::after 会夺定位）→ 用「定位壳裹特效内卡」。
2. **对比度**：文字只用语义档 `color`（text/sub/dim/jade/gold/ok/warn/danger），**不塞 raw hex**；正文/底 ≥4.5:1、大字 ≥3:1；深底配亮语义色、亮底配深字（别亮底放 `dim`）；**过 daylight 亮主题**再看一遍（照妖镜）。
3. **透明度**：浮层/弹窗/气泡内容区必须**不透明实底**兜底（`linear-gradient(bg,bg),bg0`）+ 深 scrim（≥0.85）；别用半透明骗对比（对比按解析到的实底算）。
4. **布局卫生**：每节点唯一 `id`；写世界只经 `action` 信号（handler 不塞业务逻辑）；别千层框（分组 `bare:true`）；多码点 emoji 传 `Avatar.name` 会截断成「?」（用单字或 `src`）；整页 chrome 用 `maxWidth`。

## 机械门禁（两个都跑·零 issue / 归零才算过·别靠肉眼）
```bash
# 1) 校验器：LayoutNode 树必须零 issue
#    validateLayoutNode(tree)  ← src/ui/components/validate.ts（在你的 *.test.ts 里断言零 issue）
npx vitest run src/ui/components

# 2) overlap + 对比度审计：退出码 0=过 / 1=有重叠或硬性低对比
#    写法照 tools/audits/mmo-hud.audit.ts（import 你的 buildXxx() → mount → 审计）
node tools/ui-audit.mjs tools/audits/<你的页面>.audit.ts
```
**容差外相交 / 对比 <3.0 = 不合格 → 回去改坐标/配色到归零。** 参照标尺：`games/game-i`（MMO HUD 已从初版 9 处重叠修到 0）。

## 反面清单（出现即回炉）
脑补尺寸摆坐标 · 非意图叠层 · raw hex 文字色 · 亮底放 dim 灰字 · 弹窗半透穿 · 「看着还行」当对比合格 · `fx` 挂 `x/y` · 漏 `id` · handler 写业务逻辑 · 千层嵌套框。

> **一句话**：做完 UI 跑 `validate` + `tools/ui-audit.mjs`；**重叠和糊字是你自己的责任，靠工具量、不等 owner 来挑。**
