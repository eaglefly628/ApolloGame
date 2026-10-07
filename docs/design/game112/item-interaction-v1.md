# Game112 · 物件互动增量（2026-10-06）

## 2026-10-07 追加：星砂铺玳瑁掌柜与动态边界

S1：商店已经有画内货架和购买交互，但缺少一个真正「在卖货」的角色；owner 指定偏狡黠的玳瑁猫，并要求考虑动态表现。掌柜是馆内原生猫，不是穿人类服装的店员，也不新增收养/关系/经营数值。

S2：沿用本地 AssetIndex → `shopkeeperArt` → `Image` 的纯表现链；`Image.meshMotion` 已支持局部闭合循环和静态回退，不需新增引擎接口。Spritegen 是后续制作序列帧的离线工具，不能替代逐帧美术与循环质量验收。

S3–S6：生成透明玳瑁坐姿立绘，放在星砂铺柜台左侧；姓名牌暂称「玳瑁掌柜」，不抢商品价签、购买按钮和账页。账页短句随是否买过商品切换，维持画内对话口吻。当前待机只允许胸前约 1 像素呼吸、尾尖约 2 像素摆动；头脸、耳朵、眼睛和脚掌固定。不做整图摇晃、镜像转身或伪造走路。图源与生成提示词登记在本地 art/index.json，可替换。

后续高质量动作应以同一身份母图分别制作「眨眼 / 看货 / 伸爪指货 / 成交收爪」的透明姿态，固定机位、脚掌接地点、身体体积、脸部花纹与灯光。每个动作单独在 Spritegen 中切帧、预览，人工检查首尾连续、无残影/变脸/拉伸；通过后才导出 AssetIndex 与 `Image.sprite`，再由画内交互信号选择表现态。**不能把当前微动宣称为完整 Live2D，也不能靠插值自动填出转身。**

S7：Game112 相关测试和 build 通过；1058×752 / 1280×960 的独立本地 file 夹具 UI 审计各 322 个绝对定位节点，0 重叠、0 硬低对比。Chrome 开启本地文件 WebGL 许可后，掌柜画布可见且相隔 0.9 秒的截图帧不同；不代表已验证正式游戏页的动效观感。合成预览：[玳瑁掌柜在货架左前方](verification/menus-2026-10-07/shopkeeper-v1.png)。S8：尚无独立复查签字或推送；同工作区 Game113 在途改动仍阻断全仓门禁，不代替 owner 决定怎样合并那些改动。

## 2026-10-07 追加：菜单也是馆里的东西

S1：owner 拒绝外置应用式商店，要求菜单与猫馆场景融合。S2：实查 Panel.skin、Panel.scroll、Image 和既有 LayoutNode 坐标系，可直接组合，无引擎缺口。

S3–S6：所有房内子功能移入 `hall-stage`，不再生成 viewport Drawer / Modal；近景时卸下房间按钮，避免背后热区抢点击。商店改为四格旧木货架，已有商品贴图、价签和购买/摆放/使用状态直接落在货格上；名册、Gallery、回忆、设置、星牌和收纳用画内旧册页，合册按钮固定、长内容在纸面内滚动。主题沿用 house 基座，按 owner 明确美术方向改为奶油纸、苔绿和木色。新增货架和册页两张生成图，登记游戏本地索引，原始生成图保留。

S7 自证：Game112 + UI 组件 535 测试通过，TypeScript / Vite build / scoped ESLint 通过；1058×752 与 1280×960 的独立 Chrome file 夹具审计 320 个绝对定位节点，0 重叠、0 低对比警告、0 border-image 错误。最终 23 张截图中的图片全部加载、无 pageerror。购买到摆放的真实 mount 测试保留通过。图片缺失时仍有不透明浅色底，不把深底深字当作图片一定加载成功。

截图：[画内货架](verification/menus-2026-10-07/shop.png) · [收纳册页](verification/menus-2026-10-07/toys.png) · [Gallery 册页](verification/menus-2026-10-07/catalog.png)。

S8 尚未完成：没有独立复查签字，也没有 push。完整门禁仍被同工作区 Game113 的 DOM / React / 手写能力审计阻断；未修改那些文件，也没有绕过 gate。截图来自独立 file 夹具，不冒充实际 launcher E2E。

相关工具追加：用户确认接入 usexless/Spritegen。技能保存在 `.claude/skills/spritegen`，本机 `.agents/skills/spritegen` 可发现；`tools/spritegen-export.mjs` 仅导出既有 AssetIndex / Image.sprite 格式。未用新工具替换猫动画，几何测试不是新的猫美术；许可证声明和待补全文记录在 THIRD-PARTY-NOTICES。

## S1 范围

依用户本轮要求，将现有四件商品的购买、摆放、猫的陪伴互动接通；修正十房热点与猫位的重叠。采用固定位置和轻量两步互动，不扩成自由走动宠物模拟。月相牌仅做共同翻牌小互动，不代表正式牌局已完成。

## S2 能力与数据

沿用 KeyBinding → Effect 写请求 State → EventWhen 判条件 → Effect 写 Flag / Resource / State；Timer + reset-timer 管邀请与收尾时序，购买仍用 CraftRecipe。世界规则不放进点击 handler。独立物件透明图进入本游戏本地索引；视图用 LayoutNode Image / Panel / PlayingCard 组合。零新增引擎能力。

实查了 registry、events-logic 手册与 flow/dialogue/event-when/effect-apply 实现。最初装配 GameFlow + Dialogue 时，严格拓扑检查复现二者的 RMW 定序环。本增量能由既有 EventWhen + Effect + Timer 等价表达，因此采用重组，不修改共享引擎定序，也不在游戏层增加解释器。邀请 150 tick（30 秒）自动结束；回应后停留 24 tick（4.8 秒）。请求每拍先清旧、再收新，无效点击不延迟排队。

物件使用必须同时满足拥有、已摆放、当前在主厅；互动可取消，切房即结束。一次互动分邀请、玩家回应、收尾三段，回应只结算一次，不产星砂；再次邀请要等收尾完成。收回后可重新摆放，物件不会消耗。存档保存物件使用次数，旧档缺失时为零。

## S3–S5 实现与验收目标

- 商店与收纳篮显示商品图、安放地点、购买/摆放/使用/收回状态；已有商品不再引导重复购买。
- 羽毛杆轻摆、纸袋轻颤、软垫在猫身下、月相牌在桌面；交互文字与关系变化对应。
- 只让胸毛和尾尖响应，猫不做整图翻转、摇头或伪造步态。
- 取消全场热点 allowOverlap 豁免；猫压住软垫为唯一有注释的物件意图叠层。
- 猫台词移到固定底部纸条，避免随猫位挤到房门或物件。
- 购买不足、未拥有放置、未放置使用、重复回应、取消、换房和旧档均有行为验证。

## S6 美术

使用内建 imagegen 生成四件独立透明物件。最终提示词和来源随本地 art/index.json 保存，原始输出保留。美术仍可迭代。

## S7–S8 交付记录

本增量自证（2026-10-07）：

- `npx vitest run games/game112 src/ui/components`：71 文件、535 测试通过。包含真实 mount 宿主的购买→摆放→回应→定拍结算入档→重新打开→收回闭环，不仅是蓝图单测。
- `npm run build`：TypeScript 与 Vite 构建通过；仍有既有的大 chunk 体积提示，不影响构建退出码。
- `npx eslint games/game112 --max-warnings 0`：通过。
- `node scripts/game-skill-audit.mjs game112`：PASS；墙钟建议项为已有宿主注入的 seed / savedAt，不在 sim。`npx vite-node scripts/inert-component-guard.mjs game112`：16 种组件零惰性。
- `UI_AUDIT_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tools/ui-audit.mjs games/game112/items.audit.ts --w 1058 --h 752`：287 个绝对定位节点，0 重叠、0 低对比、0 border-image 缺前提。覆盖十房、馆图、四物件邀请/完成状态及离线纸条；1280×960 同样通过。
- Chrome 独立 `file://` 夹具加载本地图片并点击羽毛杆邀请/回应、月相牌翻面；15 张截图检查了十房、两种视口和商店。测试没有访问玩家存档，也不等于已在 launcher 上做完整端到端验收。头部固定与尾部/胸毛形变由网格测试覆盖；file 夹具的猫图片 URL 与运行时标定 URL 不同，截图中的猫为静态。

主要画面归档：

- [四物件摆放](verification/items-2026-10-07/hall-all-placed.png)
- [羽毛杆邀请](verification/items-2026-10-07/feather-invite.png)
- [月相翻面](verification/items-2026-10-07/moon-revealed.png)
- [商店货架](verification/items-2026-10-07/shop.png)
- [馆图热点](verification/items-2026-10-07/map.png)

完整推送门禁 `node scripts/scoped-gate.mjs --base origin/codex/mainbranch --run` **未通过**：工作区另有 Game113 和 vite.config.ts 等在途改动，触发 full 范围，阻断于 Game113 的 DOM / React / 手写同形能力审计。本轮未修改或清理那些工作，也未提交或推送。没有沿用旧 pipeline.json 的签字冒充本增量通过；独立复查与 S8 上传仍未完成。

表现边界：本轮是固定猫位的物件微动、胸毛/尾尖反馈、两步陪伴与存档痕迹；没有伪造自由走动、扑抓、钻袋或新的全身 Live2D 动作。月相牌仍是小互动，不是正式卡牌玩法；纸袋暂未加专用音效。场景底图与拓扑未重绘，图上不可见的通路以方向标记表达。
