# 父锚点六项返工 · 第三方独立复核（Claude · 2026-10-22）

> 复核对象：原实现 `7c3523f8` → 首轮复查 FAIL `224ecb24`（F1–F6）→ 返工 `5960cfb6` → 复查关闭 `ce807e7f`。
> 复核人未参与施工与前两轮复查；不采信回执与复查自陈，全部在隔离 worktree 自行复跑。本机浏览器：Playwright Chromium 1194（Linux），非施工方的系统 Chrome。

## 结论：**PASS**，六项关闭成立

| 项 | 复核方做了什么 | 结果 |
|---|---|---|
| 独立浏览器复现 | `tools/audits/parent-anchor-regressions.browser.mjs` 对返工前 `5960cfb6^`（脚本与夹具拷入）与 `ce807e7f` 各跑一次 | 返工前 10 过 / 34 败，exit 1；当前 44/44，exit 0（DPR 1/2）——与回执数字一致 |
| 单元回归 | `anchor-debug.test.ts` + `parent-anchor-regressions.test.ts` | 24/24 |
| 撤修验红（自选，不同于前任复查的 F1/F4） | F2：`(parent.clientLeft - parent.scrollLeft) * sx` → 去掉滚动项 | 3 例红（滚动参考线 × 三档缩放） |
| | F3：`if (!needsHostPosition) releaseHostPosition();` → 不释放 | 1 例红（F3 最后一个根锚点移除即释放 host 定位所有权） |
| | F5：`if (deferred(parent)) continue;` → 零尺寸也延迟 | 1 例红（F5 可见且已连接的显式零尺寸画布必须拒收） |
| | 每处锚点均唯一命中；恢复后 24/24，工作树干净 | — |
| 全量门禁（`ce807e7f` 原样） | eslint · depcruise · tsc · vitest · build · docs-ref · context-budget | 全部 exit 0；vitest 671 文件 / 7226 例全过（多于回执的 7176，因其后合入 NativeCharacter 提交）；depcruise 已无 game113 历史红 |
| UI 审计 | `ui-audit.mjs` 深色 / 亮色两份 parent-anchor 审计 | 均 exit 0，阻断项 0 |

## 非阻断观察

1. **`layout-solver.ts` `arrange()` 入口的 `rect = { ...rect, ...constrain(node, rect) }` 为冗余防御**：撤掉后单测 24/24、浏览器 44/44 仍全过。逐路径核对——父锚点 `solveParentAnchor` 内部已按 min/max 夹取；绝对定位用 `intrinsic()`（已 `constrain`）；flex / grid / 根节点在调用前都已 `constrain`——故不是测试缺口，是幂等的冗余行。保留无害。
2. 沿用前任复查记录：Debug 小数宽度横向约 0.5px 取整偏差、自然内容测量约 0.1016px 差异；本次未复现出更大偏差，也不宣称所有 CSS / 字体 / 后端等价。
3. 本次通过只覆盖父锚点与 Debug 检查器，**不代表 REQ-112-UI-12 NativeCharacter 控件通过**（该单另有施工锁）。
