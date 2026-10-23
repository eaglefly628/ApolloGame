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


## 独立复查判词（Codex · 2026-10-23）

**FAIL，退 Claude / PUI 修 UI 校验，生图侧无须为此回退。** 固定审查 `8a94300f6c2cecd14c7c067e7734c74c2054d111`；复查未参与施工，固定 / 撤修副本隔离，最终 clean。当前主干对应两侧实现未变。

### 阻断 ST1（P2）：UI 与生成侧接受不同的完整令牌

位置 `src/ui/components/style-tokens.ts:57–59`（以及 `parseStyleTokens` 整体）。以已合法的完整令牌为底，分别仅改 `fonts:null`、`fonts:[]`、`fonts.ui='x'.repeat(201)`：生成侧 `validateStyleTokens` 均拒收，UI `parseStyleTokens` 均返回 ok，`loadStyleTokensTheme` 采用主题，WARN 为空。字体就是 UI 消费字段，不能用“只管 UI 子集”解释漏验。

再分别删除 name、把 status 改 approved、删除 prompt、增加 prompt.extra，也有同样分歧。独立同源负例测试 10 例 **7 个真实断言红 / 3 绿**，exit 1；404、fetch 异常、JSON parse 异常回落原主题的3例正常。真实 `ai-gen` CLI 对缺 prompt / null-fonts / array-fonts 均 exit 1、不产 pending；同一文件在 UI 却默默生效。这违背非法令牌整份拒收 / 生图与 UI 同源口径，闭集键表一致性测试没有覆盖这些负例。

最小复现：复制合法 `style-tokens.json`，只置 `fonts:null`；生成侧 `validateStyleTokens(raw).ok === false`，用同对象调用 UI `parseStyleTokens(raw)` 和 stub fetch 的 `loadStyleTokensTheme`，实得 `true` / 非 null / 无 warning。独立复现程序在 `/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/review-trio-split3d-20261023/style-tokens/`，见 `boundary-observations.json`、`08-boundary-real.log`、`13-real-cli-invalid/assertions.json`。

修复归属：本单 UI 校验。补与生成侧相同的完整闭集校验（至少对象 / 数组 / null / 长度 / 必填），并用同一组有效和无效完整对象测试钉住两侧拒收结果；不靠仅比常量键表。复查不代修。

### 其余验收的独立结果

- 定向 **141/141**：新主验收14、旧行为102、art-ledger-guard25，均 exit 0。现有两侧颜色 / 字体 / 顶层键表、主题映射被测试点名锁住；但不等于完整校验等价。
- 真实 CLI 显式 `--mock`：7 断言通过；实际生成字节等于将完整 styledPrompt 送入 mockImage 的结果，pending provenance 原文件 SHA256 `65a3b615c246873c4899a920b63b1b520027f8f3e32d7d90ab5872254982abbe`。prompt 确实追加游戏英文风格及 palette；missing-token / 非图像供应商的 skip 日志已核。
- 真实台账批量 mock CLI：5 断言通过；请求 `body.prompt` 含完整风格段，ledger provenance 保留同一实发 prompt。批量路径未存令牌 SHA，施工 Review 只对 ai-gen pending 声称 SHA，故本项不另判失败。**真实付费生图链路未验**。
- **接受美术根的刻意偏离**：`public/games/<slug>/art/style-tokens.json`（卡带为 `library/<slug>/art/`）可沿既有 `/games/<slug>/art/` URL 同源读取，符合 artRoot、Vite 卡带→public 回落与 main_entry JSON 伺服；常规构建复制后 dist 文件和源 SHA 相同。相对导入 docs 会撞 games-no-relative-escape 且不适合运行时服务。需求池正文仍写 docs 路径，是待施工方同步的文档漂移，不是本次 FAIL 理由。game628 status=draft，未伪造最终签字。

### 独立撤修验红（避开施工方已有锚点）

| 锚点（均原串唯一命中1） | 测试 / 红灯 | 退出码与恢复 |
|---|---|---|
| `const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');` → 64个0 | 独立真实 CLI `CLI exact source-byte token SHA` AssertionError，实际0串与文件 SHA 不等 | 0→1→0；恢复 lib SHA `5a06351a2c60d33316174e9ef1d3daf068b78a9125f96a03ad32c7b9131e92a9` |
| `if (value) for (const slot of STYLE_TOKEN_THEME_MAP[key]) out[slot] = value;` → 仅跳过 background | `npx vitest run scripts/lib/style-tokens.test.mjs -t 'UI 主题'` 真实背景色差断言红 | 0→1→0；恢复 UI SHA `af3c15c1e3085418c8c1ff4c2c0b238953eedee447072f5cafbd2df62a375c02` |

锚点命中先断言；恢复后工作树 clean。初次 macOS `/var`→`/private/var` 临时目录别名使旧 CLI 入口相等判断跳过执行，ENOENT 首轮日志保留；使用 canonical `TMPDIR=/private/tmp` 后通过。没有把别名 NoSuite / 入口未执行当撤修红灯。

### 全量门禁、告警与证据

宿主真实 Chrome、canonical TMPDIR 下实际 `node scripts/scoped-gate.mjs --base 8a94300f^ --run`：总 **0**，672 文件 / 7247 测试通过，末行 `✅ 门禁全绿（scope=full）`。eslint、depcruise、美术冒烟47例、备份冒烟27例、tsc、vitest:full、build、docs-ref、context-budget 各 **0**；art-ledger **2**（允许的既有黑户5 / 死账2 / 缺来源0，game628为0）。全绿不覆盖上述新补负例的失败。

WARN 已读并比父版：唯一 `[L,P]` topological-sort fixture 原文相同；历史 happy-dom AbortError / localhost 拒连重现11行，无 Unhandled 汇总；仍3个大chunk警告。规范临时路径后唯一新增测试消息为预期的令牌优先决策日志，无新增生产警告。17个改动源 SHA 未变。

完整证据 `/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/review-trio-split3d-20261023/style-tokens/review-result.json`、`withdrawal-summary.json`、`14-scoped-gate-full.log`、`14-step-exits.json`、`15-warning-audit.json`、`16-deployment.json`。证据根见本节末。

证据根（本机持久目录）：`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/review-trio-split3d-20261023`。
