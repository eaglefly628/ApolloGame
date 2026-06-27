# Game G 数据驱动 UI 交接（PG · 2026-06-27）

> 给接手 session（尤其要做**战斗中 UI**那位）。大厅已完成并全绿推送；战斗 UI 未开始，方案见 §5。

## 一、已完成：大厅全数据驱动（mainbranch · 最新 `8632fdfb` · tsc+vitest+build 全绿）

game-g 大厅从 bespoke 手写 DOM 整体迁到数据驱动 `LayoutNode`（`ui/components` + `mountUI`，零手写 DOM）。
9 页/浮层逐项对齐**原版管线 + Claude Designer 设计稿**（owner 逐页人肉验收过）：
大厅主页 / 战役 / 牌组 / 收藏 / 改造坊 / 天梯 / 商城浮层 / 设置·帮助浮层 / 新手指导 coachmark。

## 二、关键文件（数据驱动大厅）

- `src/games/game-g/lobby-dd.ts` — 集成器 `mountLobby`：顶栏(Avatar 章 + Tag 货币 pill + 流派行 + header 下边线) +
  导航(Tabs 只做**金色下划线条**·空页) + 内容(`lobby-content` Panel `flex:1` 撑满·否则 Tabs 页容器 block 不撑满→底部留空) +
  浮层 overlayHost + **coachmark**(coachWorld + `mountOnboardingOverlay` + `updateCoach`/`advanceGuide`)。
  `TABS` 6 个(含天梯)·home/decks 带 `anchor`。
- 各页 builder：`home-screen.ts`(绿呢 felt: 标题左上+花色标右上 / 今日卦象 pill + 漂浮对决卡(fluid 116宽·外float内rotate)+圆金币掷(CoinFlip) / 出征 CTA hero / 底部天罡条) ·
  `campaign-screen.ts` · `deck-screen.ts`(13×4 扑克墙 cols:13+fluid·deck-tabs `action:'deckTab'`·天罡页签带 `anchor:'tab-gang'`) ·
  `collection-screen.ts`(6 列 fluid 翻面卡 flipOnHover+backFace · **`ladderPage` 天梯**: 我的段位章/进度/3统计盒 + 全服榜) ·
  `craft-screen.ts`(竖排·附魔台 13×4 cols+fluid + 全宽天罡货架)。
- `overlays.ts` — 浮层：商城(**居中 Modal**·抽卡4段[2卡池+天罡/地支碎片定向兑换]+皮肤卡+钱包卡片网格 cols:4)·设置·帮助(Tabs)·卦象·故事 +
  `GUIDE_COACH` 7 步 coachmark 接线(锚点 help①/decks②/autobuild-poker③/tab-gang④/autobuild-gang⑤/home⑥/play⑦)。

## 三、用到的引擎能力（主程已下沉·均可用）

`cols`(固定列数 grid) · `PlayingCard.fluid`(填满格·5:7) · `PlayingCard.backPattern`(牌底纹 checker/stripe) ·
`flipOnHover`+`backFace`(悬停翻面) · `Label.size xxl/xxxl` + `font:'display'`(大号装饰字) · `LayoutConstraints.sheen`(流光) ·
`Panel.pattern`(stripe/checker 纹理) · `Tabs.tab.anchor`(页签锚点) · `layout.anchor` + `OnboardingOverlay`(coachmark) ·
循环动效 `anim:'float'|'glow'|'pulse'` · `chamfer`(倒角) · `bgScroll`/`bgTexture`(滚动 UV/贴图)。

## 四、自验方法（在 scratchpad·临时·新 session 需重建脚本）

- `preview-shot.mts`：`renderNode(tree)` 包进 `.ggl-root`(LOBBY_CSS + FONTS) → Playwright 截图。
  用法 `vite-node preview-shot.mts lobby <home|campaign|decks|coll|craft|ladder> 1440 900`；浮层 `... shop|settings|help`；原版基准 `... original <tab>`。
  Playwright 用 `playwright-core` + `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` `--no-sandbox`。
- `shot-dc-react.mts`：渲染 `.dc.html` 设计稿（注入 `node_modules/react/umd` + `react-dom/umd` 给 dc-runtime）。
- 门禁：`npx tsc --noEmit` + `npx vitest run` + `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm run build`（vitest+build 一起可能超时·分开跑）。
- 提交规范：`fetch → rebase → 全绿 → push`（多 session 并行·rebase 带进新提交必重跑全套）。署名 `Claude <noreply@anthropic.com>`，结尾 session URL。

## 五、下一个 epic：战斗中 UI（task #10 · 未开始）

现状：战斗屏 = bespoke `src/games/game-g/turn-battle-screen.ts`（731 行手写 HTML：`buildTurnFrameHTML`/`buildTurnBattleHTML`/`mountTurnBattle`/`renderTurnBattleDoc`）。
设计稿：`src/games/game-g/design/UI/Game G 回合制战场.dc.html`（1340×858「棋枰对弈」）。

按 **UI 铁律** 拆两条路：
- **① HUD / chrome / 菜单 / 手牌 → LayoutNode**（同大厅套路·我熟）：
  顶栏(我方回合·第N回合 / 结束回合 / 皮肤段) · 源泉(SUMMON FONT)横条(本回合+1) · 四选一动作菜单(抽牌/放牌/打天罡/弃牌·互斥) ·
  手牌区(兵牌=PlayingCard·天罡=Card·hover 富 tooltip=`Tooltip.bubble`) · 掷命对决特写=已有 `Versus` 控件。
- **② 棋枰 play-field → render 组件 + 引擎渲染器**（**非 LayoutNode**·铁律规定 play-field 走渲染器）：
  三路×9 格 slot 轨 + 两端大本营(♠/♥ 章 + 3 血灯 + 敌方挂 3 地煞牌) + 路间梯子/流动箭头/门钮 + 格内兵牌(点数+花色+战力+地支角标)。
  **接手需先学引擎 `src/renderer` render-component 系统**（大厅没碰过这条）。撞到表达不了的（棋盘格轨/血灯/斜梯）→ 写 `requests.md` 同步主程。

建议顺序：先 ① HUD（LayoutNode·快）→ 再 ② 棋枰（渲染器·重）→ 掷命对决特写 → 接 `mountTurnBattle` 信号到真战斗逻辑（保 `game-g.tsx` 接入不变）。

## 六、未决小项

- 全服榜每行小章：`Table` 文本格不能嵌 `Avatar` → 若要逐行头像，提主程加 Table icon 列（小缺口·非布局错）。
- 帮助长文彩字(`Label.spans`)：按需把关键词上色（flourish·非必须）。
- 已闭环 REQ：REQ-UI-G收藏卡 / Tabs每页签锚点 / Label大号字 / G流光底纹（主程均实现·PG 已接）。
