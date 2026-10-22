# Review 单 · `REQ-AIFLOW-STYLETOKENS`（U3）统一风格令牌：生图与 UI 同源

| | |
|---|---|
| 工单 | `docs/workflow/requests.md` · REQ-AIFLOW-STYLETOKENS（owner 2026-10-16 判 A；2026-10-22 当面解除暂缓并令开工） |
| 施工 | Claude（本会话）。复查人须另派，不得是本会话 |
| 改动面 | `scripts/art-ledger-guard.mjs`（+test·元数据豁免一项）· `scripts/ai-gen.tripo.test.mjs`（拷贝清单）· 新 `scripts/lib/style-tokens.mjs`（+test）· 新 `src/ui/components/style-tokens.ts`（index 导出）· `scripts/ai-gen.mjs`（+测试拷贝清单）· `scripts/art-replace.mjs` · 新 `public/games/game628/art/style-tokens.json`（草案）· 手册两行 · game628 设计定稿包与流程文档各一处 |
| 域说明 | `src/ui/**` 属 PUI 域；本单为 owner 当面令本会话施工，只新增一个文件 + index 导出一行，不改既有控件与主题 |

## 一、做了什么

1. **一份令牌文件**：放在美术根 `public/games/<slug>/art/style-tokens.json`（卡带为 `library/<slug>/art/`）。
   与 2026-10-16 设计稿写的 `docs/design/<slug>/` 不同——**刻意偏离**：游戏运行时要 fetch 它生成 UI 主题，而 depcruise 禁止游戏代码 import 仓外 docs；放在美术根正好落在既有 `/games/<slug>/art/**` URL 契约里。
2. **闭集字段**：`version / name / status(draft|final) / base(apolloOnyx|apolloBrocade|starter) / colors(13 个语义键·#RRGGBB) / fonts(ui|serif|mono) / prompt(zh,en,negativeZh?,negativeEn?)`；`background/text/accent` 必填；任一处非法整份拒收。
3. **UI 侧**：`themeFromStyleTokens` = 起手 house 主题（华丽起手铁律）+ 令牌按唯一映射表 `STYLE_TOKEN_THEME_MAP` 覆盖槽位，未给的令牌保留起手值；`loadStyleTokensTheme(slug)` 运行时读取，缺文件 / 非法 → 告警返回 null，调用方沿用自己的起手主题。
4. **生图侧**：`stylePromptSegment` = 风格描述 + 固定顺序主色板（同令牌同字符串，缓存键稳定）。
   - `ai-gen --game <g>`：图像适配器自动拼入；pending 的 `provenance.generation.styleTokens` 记令牌 sha256 与实际发出的提示词；非图像适配器 / 无令牌各打一行 skip。
   - 台账批量出图：有令牌时它是唯一风格来源，台账头 `artStyle.stylePrompt` 让位并告警；无令牌行为不变。
5. **防漂移**：mjs 与 TS 两侧的顶层键、颜色键、字体键、base、映射表键由测试逐项钉成一致。

**未做（YAGNI）**：从 Claude Design 稿自动提取令牌（U2 量稿回填）；令牌驱动 paletteSnap 后处理；`texture/panelTexture` 等 CSS 槽位（无闭集表达，等真需求）。

## 二、请逐条核

| # | 核什么 | 怎么验 |
|---|---|---|
| 1 | 闭集 + 两侧一致 | `npx vitest run scripts/lib/style-tokens.test.mjs -t "U3 令牌闭集"`（7 种非法两侧都拒 + 键表一致） |
| 2 | 生图段确定性 | `-t "生图风格段确定性"` |
| 3 | UI 主题映射 | `-t "UI 主题"`、`-t "运行时读取"` |
| 4 | 台账出图用令牌且优先 | `-t "art-replace batchGenerate"` |
| 5 | ai-gen CLI 真拼 + 记 sha256 | `-t "ai-gen CLI"`（真实子进程跑命令入口） |
| 6 | 旧行为不回归 | `npx vitest run scripts/ai-gen.test.mjs scripts/art-replace.test.mjs`（102 例） |

## 三、撤修验红（施工方已跑·请另选锚点）

| 撤法（锚点唯一命中） | 结果 |
|---|---|
| S1 ai-gen `const sentPrompt = styled ? … : prompt;` → 恒为原提示词 | 1 红（ai-gen CLI） |
| S2 art-replace `const gameStyle = styled ? stylePromptSegment` → 台账风格优先 | 1 红（batchGenerate 令牌优先）。首次写法有语法错导致「no tests」，不计，已重做 |
| S3 映射 `accent: ['gold']` → `['jade']` | 2 红（主题映射 · 运行时读取） |

| S4 守卫 `base === 'style-tokens.json'` 豁免 → 删除 | 2 红（新用例 + 真仓根 CLI 用例：game628 的令牌被报成黑户） |

施工中全量门禁抓到两处遗漏并已补：① `ai-gen.tripo.test.mjs` 也把脚本拷到临时目录，漏了新依赖；② 美术台账守卫把 `art/style-tokens.json` 当成未登记资产（黑户），已与 `index.json` / `pending.json` 同列为元数据豁免。

## 四、请重点判

- 文件位置偏离设计稿（见一、1）——是否接受。
- game628 的令牌是**草案**（`status: draft`），配色取自 `design-freeze.md` §2；正式定稿需 owner 过目后改 `final`。
