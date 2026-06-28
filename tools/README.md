# tools · 开发自检工具

配套 `docs/design/ui-playbook.md`（UI 实操手册）。给 LLM/人在交 UI 前**直接跑、用证据验**，不靠肉眼、不等用户挑错。

## ui-audit.mjs · UI 审计（重叠 + 对比度）

把一棵 LayoutNode 树 mount 到真浏览器，量真实包围盒 + computed 颜色，程序化检查两件 `validate.ts` 挡不住的事：
- **重叠**：带 id 的绝对定位元素两两相交（装饰层无 id→排除；祖孙嵌套→排除）。真意图叠层（如血条叠连击点）会被标出→人工确认即可，或让其一不带 id。（工具留了 `data-allow-overlap` 豁免钩子，但 LayoutNode 闭集暂无法从数据输出该属性，需主程加 passthrough 才生效·当前用「无 id」豁免。）
- **对比度**：每个含直接文字的元素 computed 前景 vs 逐层向上第一个不透明背景的 WCAG 比。两档：**硬失败 `<3.0`**（真读不清·阻断）/ **警告 `3.0–4.5`**（多为 dim 次级文字·复核非阻断）。

### 用法

```bash
node tools/ui-audit.mjs <entry.ts> [--mount root] [--w 1060] [--h 760] [--min-contrast 4.5] [--hard-floor 3.0]
# entry.ts 须把树 mount 到 #<mount>（缺省 'root'）。现成示例：
node tools/ui-audit.mjs tools/audits/mmo-hud.audit.ts
```

退出码：`0`=通过（重叠 0 + 无硬性低对比）；`1`=不合格（可进 pre-push / CI 卡口）。

### 写一个审计入口

照 `tools/audits/mmo-hud.audit.ts`：import 你的 `buildXxx()`，`mountUI(document.getElementById('root'), tree, {}, THEMES['onyx'])`。换主题就换最后一个参数——**建议至少跑深主题 + 亮主题（daylight）两遍**，亮主题最容易暴露糊字。

### 依赖与环境

vite（项目内）+ playwright + chromium。本环境 chromium 预装在 `/opt/pw-browsers/chromium`（工具默认走它，可用 `UI_AUDIT_CHROMIUM` 覆盖）；playwright 项目内没装时回落 `/opt` 预装。

### 已知失败溯源（重要）

当前对 `mmo-hud.audit.ts` 会报 **3 处硬失败**：聊天页签「综合/战斗/交易」黑字 ratio≈1.09。**这不是数据错，是引擎序列化 bug**（`docs/workflow/requests.md · REQ-UI-BUG-style属性引号截断`）——`renderTabs` 的 `color` 排在 `font-family` 之后被引号截断、回退成黑色，**所有用 Tabs 的界面都中招**。这恰好是审计工具的价值演示：肉眼以为只是「页签偏暗」，工具量出是「纯黑不可读」。主程修序列化后即转绿。其余警告均为 dim 次级文字（非阻断）。
