# 美术管线手册（给游戏配美术 · 接线图）

> 深文：终态档 `docs/design/art-platform-2026-07-09.md`（唯一权威）+ 工作流 `docs/design/art-replacement-workflow.md`。
> 本册只回答「做 X 用哪个件、按什么顺序」。资产登记/vendor 见 `docs/playbooks/assets.md`；视觉验收见 `docs/playbooks/visual-scorecard.md`。

## 卡带游戏线（创作台产出·demo 主线）· 八步

| 步 | 做什么 | 用哪个件 |
|---|---|---|
| 1 | 生成游戏：LLM 出 manifest，**视觉实体必带 `art:` 皮肤槽**，引用写成详细图像小样（主体+特征+颜色+视角·4-10 词·禁裸名词） | 创作台 /api/generate（系统提示词已强制） |
| 2 | 秒可玩：art: 确定性解析到免费 CC0 库（同查询同图·placeholder=真图） | `resolveArtRefs`（引擎·自动） |
| 3 | 出需求台账：机器扫 art: 槽位→每行 编号 art-NN/类型/规格/详细描述 | 美术平台进卡带自动初始化（或 POST /api/art/derive） |
| 4 | 配风格：选**风格包**（闭集·中英双方言+palette+钉死供应商）+ 填**本游戏风格锚**；模型菜单默认随包 | 平台头部（风格包/🎯风格锚/模型下拉） |
| 5 | 一键全量：逐行拼 prompt（`prompt`>`query+desc`>`query` + 类型词 + 包方言 + 游戏锚）→ 调 API → palette-snap+按规格缩放 → 落游戏资产目录+provenance；断点续跑·缓存不重扣费·无 key=探针+mock | 平台「⚡ 一键全量」（大脑=`scripts/art-replace.mjs`） |
| 6 | 写回：按编号重钉 manifest art: 引用→**parseManifest 零 error 才落盘**（玩法零改） | 平台自动（library 线 batch 后 replace） |
| 7 | 优化：缩略图墙按编号三式——重生成(可改 prompt)/库选换/上传（magic-bytes 嗅探）——只动那一行 | 平台详情面板 |
| 8 | 换皮量产：同玩法 × 换风格包整批重跑 → 新卡带（记 reskinOf 谱系） | 平台「🎭 一键换皮」 |

## 编译期游戏线（src/games·如 game-q）· 差异只在两处

- **接入**（一次性·三行）：theme 定 skin key → 蓝图视觉实体加 `Sprite:{textureKey,anchorX:0.5,anchorY:0.5,zOrder:0}`（**必与 Shape 并存**·未就绪回退 Shape=观感零变）→ 照 game-q 样板写 requirements 推导脚本。mount 拉本地 index 注册 AssetManager（`game-q.ts` skinAssets 样板）。
- **写回**：不钉 manifest——生成/上传按 `skinKey` **别名登记**进 `public/games/<g>/art/index.json`，资产就绪自动换装。其余步骤与卡带线相同（换库/换皮动作在平台自动隐藏）。

## 红线

- **禁纯色块游戏**：主体视觉实体必须有皮肤槽（art: 或 Sprite+skinKey）——没槽=不可换皮=生成线白搭（game-q 初版=反面教材）。
- **编号 append-only**：台账编号永不挪号（重跑合并·墓碑保号）；改提示词改台账行，**勿手改 md 当真相**。
- **mock 只许显式**：不勾=真调尝试；无 key 必须见探针输出——静默顶替=假绿（testing.md 红线）。
- **写回必过校验门**：library 线 parseManifest 零 error；编译期线只走别名登记，**绝不改蓝图代码来换皮**。
- key 只进设置面板/.env（打码回显·不落日志）；进**共享货架**仍必须 M2.5 人审门。

## 查不到怎么办

- 新资产类型/新供应商/参考图模式等本册没有 → `docs/workflow/requests.md` 提缺口等裁决，**绝不自造旁路**。
