# 美术管线手册（给游戏配美术 · 接线图）

> 深文：终态档 `docs/design/art-platform-2026-07-09.md`（唯一权威）+ 工作流 `docs/design/art-replacement-workflow.md`。
> 本册只回答「做 X 用哪个件、按什么顺序」。资产登记/vendor 见 `docs/playbooks/assets.md`；视觉验收见 `docs/playbooks/visual-scorecard.md`。

## 卡带游戏线（创作台产出·demo 主线）· 八步

| 步 | 做什么 | 用哪个件 |
|---|---|---|
| 1 | 生成游戏：LLM 出 manifest，**视觉实体必带 `art:` 皮肤槽**，引用写成详细图像小样（主体+特征+颜色+视角·4-10 词·禁裸名词） | 创作台 /api/generate（系统提示词已强制） |
| 2 | 秒可玩：art: 确定性解析到免费 CC0 库（同查询同图·placeholder=真图） | `resolveArtRefs`（引擎·自动） |
| 3 | 出需求台账：机器扫 art: 槽位→**按素材去重**（owner 07-12：一行=一种素材·同 query 多实体共用一行·slots[] 记全部槽位·生成一张扇出写回全部·旧重复行自动吸收） | 美术平台/工坊素材屏自动（或 POST /api/art/derive） |
| 4 | 配风格：选**风格包**（闭集·中英双方言+palette+钉死供应商）+ 填**本游戏风格锚**；模型菜单默认随包 | 平台头部（风格包/🎯风格锚/模型下拉） |
| 5 | 一键全量：逐行拼 prompt（`prompt`>`query+desc`>`query` + 类型词 + 包方言 + 游戏锚）→ 调 API → palette-snap+按规格缩放 → 落游戏资产目录+provenance；断点续跑·缓存不重扣费·无 key=探针+mock | 平台「⚡ 一键全量」（大脑=`scripts/art-replace.mjs`） |
| 6 | 写回：按编号重钉 manifest art: 引用→**parseManifest 零 error 才落盘**（玩法零改） | 平台自动（library 线 batch 后 replace） |
| 7 | 优化：缩略图墙按编号三式——重生成(可改 prompt)/库选换/上传（magic-bytes 嗅探）——只动那一行 | 平台详情面板 |
| 7.5 | **人审复核（double verify 人门）**：逐行/全部「☑ 复核通过」→ approved——五步流程条全绿才算这条线走完 | 平台流程条+复核按钮 |
| 8 | 换皮量产：同玩法 × 换风格包整批重跑 → 新卡带（记 reskinOf 谱系） | 平台「🎭 一键换皮」 |

## Workshop 工坊一站式（owner 07-12「占位/提示词/模型/替换全在工坊」）

- 工坊素材屏：点任意台账卡=详情卡（提示词全文/改词输入/风格包 chips/文生图模型 chips）+
  「⚡ 重新生成这张 / ▶ 生成全部占位 / ⤵ 替换写回」——四步 4-7 不必再去旧工作台。
- 美术对话 agent 可产 ```art-ops 操作提议（regen/batch/replace 三式），壳出确认卡「✔ 执行全部」
  ——agent 开方子、人点头、工坊执行；**agent 永不代执行**，也不许再叫用户去旧平台手动 retire。

## 编译期游戏线（src/games·如 game-q）· 差异只在两处

- **接入**（一次性·三行）：theme 定 skin key → 蓝图视觉实体加 `Sprite:{textureKey,anchorX:0.5,anchorY:0.5,zOrder:0}`（**必与 Shape 并存**·未就绪回退 Shape=观感零变）→ 照 game-q 样板写 requirements 推导脚本。mount 拉本地 index 注册 AssetManager（`game-q.ts` skinAssets 样板）。
- **写回**：不钉 manifest——生成/上传按 `skinKey` **别名登记**进 `public/games/<g>/art/index.json`，资产就绪自动换装。其余步骤与卡带线相同（换库/换皮动作在平台自动隐藏）。

## 红线

- **禁纯色块游戏**：主体视觉实体必须有皮肤槽（art: 或 Sprite+skinKey）——没槽=不可换皮=生成线白搭（game-q 初版=反面教材）。
- **编号 append-only**：台账编号永不挪号（重跑合并·墓碑保号）；改提示词改台账行，**勿手改 md 当真相**。
- **mock 只许显式，且永不上画面（owner 07-10）**：不勾=真调尝试；无 key 必须见探针输出——静默顶替=假绿（testing.md 红线）。mock 产物只落独立命名空间 `gen/mock/`（gitignored）供平台墙预览（⚙MOCK 标）：**不写回 manifest、不登记 skinKey 别名、不可 approve**——真图到位前游戏保持原始 placeholder 观感。把 mock 钉进游戏=事故（game-j/m 2026-07-10 反面教材）。
- **写回必过校验门**：library 线 parseManifest 零 error；编译期线只走别名登记，**绝不改蓝图代码来换皮**。
- key 只进设置面板/.env（打码回显·不落日志）；进**共享货架**仍必须 M2.5 人审门。

## 查不到怎么办

- 新资产类型/新供应商/参考图模式等本册没有 → `docs/workflow/requests.md` 提缺口等裁决，**绝不自造旁路**。
