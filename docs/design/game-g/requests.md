# game-g 需求单（游戏域工单）

> 2026-07-15 立（owner 拍板「工单随游戏走·游戏可暂停」）：本游戏的 bug/玩法/演出/平衡工作票在此，
> 域主（程序/PE/design）自取自结，**不占主池 10 槽**（主池 `docs/workflow/requests.md` 只管引擎本身）。
> 标「控件缺口/引擎收编」的条目=引擎域候补——落地须走主池腾槽或 capgap 通道，游戏层不得自造。
> done 同提交删除条目（查 git 历史）；3D 线仍在 `docs/workflow/requests-3d.md`。

---
<!-- ⚖ owner 2026-08-22 令：核心战斗整体重设计——旧战斗/成长线需求**整批废除出池（25 单·含 2 条已 done 记录）**，
     全文查 git 历史（git log -p -- docs/design/game-g/requests.md）。含 Player-AI 终极版·战斗心流/满仪式演出·
     天罡原生重构（进行中态一并冻结）·地煞/英雄牌（转策划态）·改掷RollMod下沉·战功·关1过载/士气重构/掷骰两bug/
     兵线互穿等 playtest 批·对决3D骰/特写三栏/FAST_RANKS/FLIP/主将艺术字/调试菜单/复查尾巴/bug核对清单/即时法术/
     掷骰仪式缩放/演出迁时间线/碰撞才战斗与修正栈（done 记录随历史）。**新战斗设计出稿后按新单重立·不追溯旧单**。
     保留非战斗件 4 单（美术清单/PUI 控件缺口/掌机黑屏验证/测速）。 -->

### NOTE-PA→game-g/PE · emoji 图标清单（456 处·待转 Image 槽）· [2026-07-16] · PA 审计产出（owner「game-g 美术盘点·出遗漏 emoji 清单」）→ **待 game-g/PE 取用** · status: **open（清单已出·转槽是 game-g/PE 域·PA 不改蓝图）** · 类型: 美术盘点·遗漏面
> **背景**：owner 盘 game-g 美术，三层现状=① 53 真美术已上（牌面 portrait）② 57 占位 SVG（needs-art·**T2 台账已有 skinKey 槽·管线可换**）③ **456 处 emoji 当图标散在 29 个 UI 文件的 LayoutNode 文本里**——这层**没被任何美术槽捕获**（emoji 是文本字形·非 Sprite/Image）→ T2 derive 抓不到、生成管线够不着。这是 owner 说的"遗漏的 svg/emoji"。
> **清单**：`docs/design/game-g/emoji-icon-inventory.md`（`node scripts/emoji-audit.mjs game-g --md` 产·**可重跑**·随转槽进度递减）。含：按 emoji（种类×次数×代表上下文×位置）+ 按文件（哪屏最多→优先）+ 逐处 file:line 明细。Top：♠♥♦♣ 花色·★ 星级·⚔💎🎴🪙🎲🛡🀄🧩⚙📖…；热点文件 hero-codex(76)/turn-battle-screen(66)/overlays(50)/game-g.tsx(38)/collection-screen(35)。
> **给 game-g/PE**：要美术化的 emoji → 把「文本里的字形」改成「带 `skinKey` 的 `Image` 控件槽」（UI 铁律·`Image.src` 走资产 key）→ 台账 `art-requirements` 重跑即纳入生成管线，之后走占位→生成→人审→替换的既有闭环。**PA 立场**：只出清单（审计），转槽=game-g/PE 域（改蓝图/HUD），不越界代改。
> **注**：清单已滤掉纯注释行/花色逻辑记号（581→456），留的是玩家可见 UI 文本里的 emoji；行尾注释里的零星 emoji 可能有极少量残留，人读无碍。
> **更新（owner 2026-07-16 拍板·省掉手转槽）**：owner 决定**不逐个手转 Image 槽**——改由 **UI 库自动「文本 emoji→美术图」渲染**（`docs/workflow/requests.md` REQ-UI-emoji图渲·指派 PUI）。PA 已出映射底座：**game-g 456 处 emoji 100% 可映射到库里 Twemoji 美术图**（直中 415 + alias ⭐等 41），映射表 `docs/design/game-g/emoji-art-mapping.md`。**→ game-g/PE 这块基本无需动手**（等 PUI 渲染层落地即整体变美术图）；只有"非 emoji 的专属美术图标"才需走 Image 槽。

### REQ-UI-PlayingCard/Button 控件缺口（尺寸 + 透明底图） · [2026-07-06] · PG（game-g R21 布局重置 + owner 换背景撞见）→ **指派：PUI（src/ui/** 控件集域）** · status: **open（控件写死不透明·PG/PE 不擅改 render.ts）** · 类型: 基座控件扩能（加尺寸档 + 透明底图支持·additive）
> **① xl 尺寸档**：owner R21 要绝命对决特写忠实设计稿（`design/UI/Game G 绝命对决.dc.html`·牌 **118×142**）；现 `PlayingCard` 尺寸闭集 `PCARD_DIMS` 最大档 `lg=[82,116,18,46]` 偏小。**申请** `PCARD_DIMS` 加 `xl:[118,142,22,58]`（纯加档·零回归）。到货后 PG 把 `clash-card-m/f` `size:'lg'→'xl'` 切一行。
> **② 透明底图支持（owner 2026-07-06 换背景撞见·实图为证）**：owner 生成了**带透明色(alpha)的牌背图**放进 `PlayingCard.backArt`，但渲出来牌边不透明——根因：`renderPlayingCard` 给牌**恒画不透明底** `faceBg`（back=`linear-gradient(#b34a4a,#8c3535)`）+ `border:2px solid` 垫在图下，所以图里透明的地方**露出的是牌自己的不透明红底、不是牌后的绿呢**（非"图片格式不对"，PNG alpha 没问题）。**申请**：`PlayingCard` 加透明模式——`art`/`backArt` 为透明图时**不画 `faceBg`/`border`**（或加 `bareFace?:boolean`/`faceBg?:'transparent'` 口子），让图的 alpha 透出牌后底。同族：`hero` Button（`renderButton` 的写死投影/内高光/`cover` 裁掉透明边）也挡透明 skin——一并请 PUI 给 hero 透明 skin 干净透出。
> **为何不 PG 自己改**：`src/ui/**` = UI 基座控件集（**PUI 域**·owner 2026-07-16）；扩控件闭集走 requests（UI铁律「表达不了→requests.md 扩控件·绝不手写逃生」）。**现状已知规避**：game-g 大厅底图改走 Panel 自己的 cover 贴图（`home-felt`·已落 `fdffd8c4`）绕开 Screen 被盖；但牌面/按钮的透明只能等本单。

### BUG-G-掌机黑屏 · [2026-06-22] · owner→甲（cartridge/战斗屏域·owner 直派 bug 修） · status: **🟡 已修（zoom·`c5608bbc`）· 待真机烧版验证** · 类型: 弱 GPU 渲染回归

> owner 报新烧 cartridge 包「ZEROCRAFT OS 绿字开机条 + 黑屏」、同代码 Mac 正常。掌机 = `build:cartridge`（`dist-cartridge`·base `./`·直挂 game-g 无 launcher）·弱 GPU webview。
> **穷尽定位**：非 JS 崩溃——cartridge 真产物无头(happy-dom)挂 game-g 零报错·大厅/战斗 DOM 全渲(605KB)·tsc/vitest1664/build:cartridge 全绿 → 弱 GPU 合成失败。
> **根因**：闪烁修(`7634b027`)把战斗屏首帧烤成 transform:scale 单合成图层·弱 GPU 合成整屏图层失败→黑（旧两段绘制 CPU 先画可见帧＝"闪烁"）。
> **修(`c5608bbc`)**：战斗屏 1340×858 适配 transform:scale → **CSS zoom**（CPU 布局缩放·不合成图层·消闪烁·Mac 等价·zoom 不支持也只裁切不黑＝fail-safe）。
> **待 owner 真机验**。若仍黑次候选：① `cartridge-entry.ts` 整屏 `#game-root` opacity 渐变；② 战斗浮层 backdrop-filter。详见 `SESSION-HANDOFF.md §0`。

---

### REQ-G-测速 · clash-resolve/turn-combat 路径被 9+9 文件交叉覆盖·自愿合并重复路径 · [2026-08-03] · Lead 巡检发现（REQ-RETRO2 施工回执带出）→ **指派：PE-G** · status: open · 优先级: P3（出口游戏·不强制） · 类型: 测试性能优化（PE 域·非功能·自愿单）
> **背景**：`clash-resolve`/`turn-combat` 两条核心路径分别被 9+9 个测试文件交叉覆盖，同一逻辑在多处重复跑，拖慢快车道全套耗时。game-g 是**出口游戏**（CLAUDE.md 出口 D+G），此单**不强制**——若近期无暇顾及可留 open 待后续。
> **修法方向（自愿）**：盘一遍 9+9 文件里各自覆盖的场景，识别真正重复（同输入同断言、只是散在不同文件里）的路径，合并进更少的文件/共享 fixture；保留边界场景（P0 bug 回归如 REQ-G-兵线互穿、REQ-C 类 fuzz 等）不合并、不削弱。
> **红线**：这是**去重**不是**减覆盖**——合并后断言集合不缩水，只是组织更紧凑；有疑问的场景宁可留着不合并。
> **验收**：耗时下降 + 覆盖面零回归 + `node scripts/scoped-gate.mjs --run`（game-g 面）绿。
