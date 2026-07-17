# game-b 需求单（游戏级工作票·不占主池槽·工单随游戏走）

> 规矩同主池：done 迁 `docs/workflow/requests-archive.md`；引擎级缺口不写这里、走主池（满槽由 Lead 裁）。

## 待处理

### B-001 · 共享角色卡格式 · status: **✅ done（2026-07-17 当日结·v1 口径拍板=仅 name+avatar·全文迁 requests-archive）** · P1
> ⚖ owner 二批拍板收口：v1 卡=仅 `{name, avatar}`（生效口径=`character-card-format-needs.md §0`·完整字段=v2 参考）；PE-B adapter 照 §0 实现。完整格式将来另起单。

### B-002 · 语音：TTS 先行·真配音后备 · [2026-07-17·同日改口] · GD-B → GD-B（台词表）+ owner（将来可选配音） · status: open · P2
> ⚖ owner 同日更新：**音源包没有——先用语音合成发个音**。v1=TTS 档（speechSynthesis·ja-JP 朗读日文台词·参数见 voice-pack-spec §0）；GD-B 交台词表（B-005 并轨·日文列=朗读文本兼录音台本）。将来真人/AI 配音=可选升级，按 §1 规范灌入即换档。核心五键（strip_lose/riichi/ron/tsumo/deal_in）台词优先写。

### B-003 · 引擎缺口盘点与提单 · [2026-07-17] · GD-B → LEAD · status: **✅ done（2026-07-17·当日结·全文迁 requests-archive）** · P1
> 结论：a 语音端口=真缺口→已提主池 **REQ-VOICE-语音输出端口**（P1·腾槽=自撤 REQ-VN-退役入档）；b BT=游戏层 TS 记债不占池；c 机位/拾取=回驳已覆盖（Camera3D 运镜过渡+Pickable3D·capability-plan §2/§2.5 已记实名出处）。

### B-004 · S2 计划过审 + S1 卡代填 · [2026-07-17] · GD-B → **LEAD**（审）+ PE-B（落卡） · status: **✅ S1-S3 三关全绿（落卡+复查/人门已按 owner 会话指令落账 2026-07-17）；S2 条件①清单已交=`mahjong-core-tests.md`（15 模块逐条点名+10 裁决行）·待 GD-B 会审圈定 R 行** · P1
> `capability-plan.md` 送审（⚖ TS 授权已记 §6）；过审后 S3 骨架开工（PE-B 领）。
> **S2 ✅ 有条件通过（Lead 2026-07-17·裁决全文=capability-plan §6）**：条件④规则细目/⑤衣物口径已回填 gdd（2026-07-17 关闭）；②BT 下沉/⑥VoicePort 引擎侧当日落地；剩=①麻将核测试点名清单（S4 实现 spec 附录·PE-B 开工前 GD-B 会审）+③角色卡三游戏共享通道（PST 主责·等 owner 格式）。
> S1 立项卡：pipeline CLI 判"未知游戏"（library/public/src 三处均无·骨架前落不了卡）——PE-B 建骨架后**第一动作**原样执行：
> `node scripts/game-pipeline.mjs concept game-b --name "雀宴（工作名）" --pitch "俯视3D和风日麻陪打局：角色卡带主角与金钱入局，与三位姨太打一圈东风战，直击脱衣轻演出，结果带回局外" --refs "雀魂(规则完整度参照)·脱衣麻将品类(表现克制版)" --style "女性向二次元·和风夜宴·樱色暖灯·sakura-otome主题"`
> 落卡后 owner/Lead 补 S1 人门签。

### B-005 · 三姨太文案表+语音台词（copy.md） · [2026-07-17] · GD-B 自领 · status: open · P2
> 人设三轴已定（gdd §五）；S4 前交付：台词风格表+voice-manifest 中日对照+衣物件名终稿。

### B-006 · 麻将 AI 参考代码调研 · [2026-07-17] · GD-B → 施工期 PE-B · status: open · P3
> ⚖ owner：后面可能参考外部麻将 AI 代码。红线：只参考思路；落地=BT 数据（引擎 `t2-behavior-tree` spec）+麻将域叶；外部代码许可证先审、不抄。

### B-008 · 美术台本批产 · [2026-07-17] · GD-B 出台本（⚖ owner 点名）→ **PA/美术平台**（转机读台账·真 key 后批产） · status: open · P1
> 台本=`art-ledger.md`（29 号位·行=尺寸/格式/英文 prompt·锚引 `sakura-nijigen` 风格包不手抄）。第一批=B-01~06 人物头像立绘+B-20 主菜单背景；占位/程序化行先行不阻塞。转正式台账时**保号 B-NN**；`spec{w,h}` 消费口径 PUI/P3D 会审（Lead S2-⑤）。批产等真 key（连 REQ-AIGEN 卡口）。

### B-009 · mockups 1:1 复刻成实装 UI（⚖ owner 2026-07-17「用我们的 UI 库重新实现一份，1:1 复刻」） · GD-B 立单 → **PE-B 主责（缺件报 PUI）** · status: open（**S3 已起步**·牌桌 HUD 壳按线框稿 1120×630 坐标 1:1 落 LayoutNode·主菜单/结算面板=S5） · P1
> **S3 预收集的 LayoutNode 差异清单（S5 报 PUI 裁决·先记后议）**：①行动钮「异形樱瓣款」——ShapeToken 闭集（pill/hexagon/diamond/shield/ribbon/chevron/tag/cut）无花瓣形，现用 pill；②线框稿 .abtn 非对称圆角（12/20 交替）——Panel/Button 无逐角 radius，主题件观感为准；③席位卡衣物章熄灭态=Tag tone:dim（线框稿为 opacity .22+灰度——观感近似·够用）。
> **范围**：`mockups/main-menu.dc.html`（主菜单 SC-1）+ `mockups/ui-mockup.dc.html` 的牌桌 HUD 分区/席位卡/行动按钮排/字幕条/场况角标/结算面板——用 **LayoutNode 闭集 + sakura-otome 主题**实装复刻。
> **1:1 的口径（诚实边界）**：布局结构/信息层级/视觉基调 1:1；控件观感以主题件为准（非逐像素）；**LayoutNode 表达不了的差异逐条列清单**→缺件走 requests.md 报 PUI 裁决，**绝不手写 DOM/CSS 逃生**。dc 稿内交互小玩具（timeline 拖拽等）=设计稿自用，非游戏功能。
> **口径警示照 `mockups/README.md`**：人名/半庄/25000/衣物件名以 gdd 为准，复刻时文案数值全部换成拍板口径。验收：/check-ui 全过 + 与 mockup 并排截图对照（S5 关证据）。

### B-007 · 占位包接线（⚖ owner 2026-07-17「录进文档结构供程序员参考」） · GD-B 录入 → **PE-B（S3 消费）** · status: **✅ done（PE-B 2026-07-17·S3 接线回执见下）** · P1
> 美术占位包=`docs/design/art-placeholders-riichi-mahjong.md`（PA 备料·CC0 全套）；接线细则已录 `scene-layout-handoff.md §六` 头部（⭐ 占位包段）+ gdd §九。PE-B S3 骨架照此 vendor：牌面 PNG 贴 3D 盒（免建模）、2D UI 用 SVG、骰子复用 game-g/d 现成 3D 件、点棒/牌桌程序化（P3D 会审）；占位入台账记 placeholder 真相（provenance CC0·FluffyStuff），S6 真美术保号替换。
> **S3 接线回执（PE-B 2026-07-17）**：①40 张 `mahjong/tex/*` 已 `vendor-asset` 进 `public/games/game-b/art/`（本地索引 40 条·provenance CC0/FluffyStuff 全在条目·vitest 钉死在档）。②**发现并修口径**：包内字形 PNG=**透明底**，直接作 Material3D.map（不透明材质无 alpha 路）透明像素渲黑——已按「缺口走程序化」出路建授权期合成工具 `scripts/game-b-compose-tiles.mjs`（无头 Chromium canvas·front.png 象牙底+字形合成不透明 albedo·就地覆写本地拷贝·CC0 派生·可重跑）；**请 PA 会审**：placeholder 文档「box 贴面」段宜补一句透明底需先合成（问责定性=包/手册缺陷·此工具可收编共享）。③骰=Mesh3D.dieFaces 现成件（对面和7）；点棒托/牌桌=程序化 Mesh3D。2D SVG 与牌河/副露=S4-S5 消费。

> **⚠ owner 关注标记（2026-07-17·挂 B-009）**：owner 目检 S3 截图与 mockup 有差异——Lead 归因=S3 素坯阶段+诚实边界（控件观感以主题件为准）+截图视口非基准 1280×720+3D 透视 vs 平面线框，**非渲染能力缺口**（现无 PUI 缺件上报佐证）。**S5 复查时并排对照逐处归因裁决**（能力缺口/主题观感差/调参三分），此标记防漏。
