# 雀宴 · 视觉规格差异清单（对照 Claude Design 真稿 · Lead 三步第二步交付）

> PE-B 2026-07-17 · 渲染目击真稿（`mockups/*.offline.html`·React 离线展开·CDN 版跑不了）后逐条对照。
> 三分：**主题令牌可表达**→做 game-b 专属 UITheme（NIGHT/SAKURA）／**缺件**→报 PUI／**新能力**→主池。
> 两层 1:1 律：结构照稿=S4；视觉换正装=S5 零返工。本清单=S5 复查并排对照的逐条依据（缺清单不收）。

## A. 主菜单（main-menu·**已做 · 1:1 接近**）

| # | 项 | 真稿 | 现状（NIGHT 主题） | 三分 | 阶段 |
|---|---|---|---|---|---|
| A1 | 背景 | 深紫径向渐变 | ✅ `NIGHT.pageBg` | 令牌 | done |
| A2 | 凤翎暗纹 | 孔雀翎径向扇 SVG | ✅ `NIGHT.texture`（从稿提取·程序化 data-uri） | 令牌 | done |
| A3 | 星点 | 16 暖金点 | ✅ texture 内 | 令牌 | done |
| A4 | 主按钮 | 粉红渐变 #f6a8c4→#d94a6a | ✅ `NIGHT.buttonSkins.hero`（粉红渐变皮） | 令牌 | done |
| A5 | 次按钮 | 暗底粉边 | ✅ `buttonSkins.ghost`（暗底粉边皮） | 令牌 | done |
| A6 | 立绘框 | 虚线粉框+斜纹+台账签 | ✅ Panel dashed+edge（斜纹未做） | 令牌（斜纹 △） | done/微调 |
| A7 | 头像+名+点数 | 圆头像+明朝名+金渐变 badge | ✅ Avatar+Label+Tag（金渐变 badge △=Tag accent 近似） | 令牌（金 badge 皮 △） | done/S5 |
| A8 | 标题「雀宴」 | 明朝 98px·粉白→粉渐变·宴红·立体阴影 | △ Label serif+glow+spans（宴 danger）·**字体待 webfonts·逐字渐变/多层阴影未做** | **缺件候选**（Label 逐字渐变 + 多层立体文字阴影） | S5 报 PUI |
| A9 | 版本号 | 右下小字 | ✅ Label dim | 令牌 | done |

**A 剩项**：A8 明朝字体（`NIGHT.fontSerif` 已配 Shippori Mincho·真环境加载·须补 `webfonts` url 或确认 CDN；离线截图 fallback 系统衬线）；A8 逐字渐变+立体阴影 = Label 缺件→S5 报 PUI（现 glow 近似）。

## B. 牌桌 HUD（ui-mockup §四·**结构待补齐 = S4 · 视觉 = S5**）

| # | 项 | 真稿 | 现状 | 三分 | 阶段 |
|---|---|---|---|---|---|
| B1 | 桌呢 | **樱粉色** felt | ✗ 绿呢（`TINT.feltTop`=0x3f7d5a） | 3D 材质色（改 1 值） | **S4 改** |
| B2 | 席位卡 | **暗底虚线框** + 头像小图 + 名+风位+点数 + **上方立绘位浮层** | ✗ 纸面 Panel（sakura 亮）·无立绘位 | 结构（hud.ts 重构席位卡）+ 皮 | **S4 结构 + S5 皮** |
| B3 | 摸牌牌堆 HUD | 右侧·余70·已摸0/34·摸牌/复位钮 | ✗ 缺 | 结构（hud.ts 加件） | **S4 加** |
| B4 | 场况角标 | 左上虚线框·局/本场/供托/余牌/宝牌 | ✅ 有（`info`）·皮待对 | 令牌 | done/S5 皮 |
| B5 | 字幕条 | 底·胶囊·说话人+台词 | ✅ 有（`subtitle`） | 令牌 | done/S5 皮 |
| B6 | 行动按钮排 | 吃碰杠立直和跳过 | ✅ 有·S3 disabled | 令牌·S4 接合法性 | done/S4 |
| B7 | 结算面板 | 全屏 Modal·役/符/点移/脱衣汇总 | ✗ 未做 | 结构（Modal LayoutNode） | **S4/S5** |
| B8 | 脱衣演出条 | timeline·镜头+立绘+粒子 | ✗ 未做（gdd §七·timeline 数据） | 结构（timeline capability） | **S4** |

**B 口径注**（mockups/README 警示·**有意区别真稿·非缺陷**）：名字真稿雪乃/椿/紅葉 → 现 gdd 工作名绫/莉世/小夜（人名待 owner·角色卡给）；点数真稿 25,000 → 现 gdd 50,000（起点=金钱 1:1）。

## C. 缺件汇总（S5 报 PUI 候选·量够开 requests-ui）

1. **Label 逐字/多段渐变字**（标题「雀宴」粉白→粉渐变·现 spans 单色分段近似）。
2. **Label 多层立体文字阴影**（标题 `0 3px 0 #7a1a2e, 0 6px 22px` 硬阴影+柔影·现 glow 磷光近似）。
3. **金渐变 badge 皮**（点数 badge·现 Tag accent 近似·可 buttonSkins 式 Tag 皮或主题令牌）。

> 主体已证「主题令牌可表达」占绝大多数（NIGHT 专属主题一批落地 A1-A7/A9）；缺件仅 3 项精修级、非阻断。B 段结构补齐随 S4 牌桌 HUD 重构走。
