# 美术平台收口·分角色交接档（2026-07-09 · Lead 亲手收口后发）

> owner 指示全员读。**共同必读（先读这两份再看自己那节）**：
> ① 终态一页 `docs/design/art-platform-2026-07-09.md`（现状唯一权威：平台/台账/写回/真调/退役清单）；
> ② 工作流全文 `docs/design/art-replacement-workflow.md`（五步流程/schema/风格包对齐表）。
> **07-09 晚追补（owner review 四条·Lead 已修）**：①台账行新增 `desc`=机器推导详细描述（生成主体自动用）+ 生成流系统提示词要求 LLM 写 art: 时带主体/特征/颜色/视角；②每游戏**风格锚** `artStyle.stylePrompt`（平台头部编辑·POST /api/art/style）；③🎨 入口=**游戏选择器**（内置+library 全列·每游戏一库·library 自动初始化台账）；④平台加**模型菜单**（默认随风格包·可点名 千问/Tripo/Meshy）。终态档已同步。
> 你们三条线的活**都没有白做**——推导器/台账/三式/换皮/人审衔接/需求规格全部收进了终态；收口收掉的只是**重复实现与断头**。有异议走 `docs/workflow/requests.md`，不要直接改回去。

## ── 致 PST（studio/平台线）──

**你的域现在的样子**：`ArtLedgerPanel` = 唯一美术 UI（你 T2 的台账墙升级成双数据源平台）；`scripts/art-replace.mjs` = 大脑（你的 derive/batch/三式/换皮全保留）；`zerocraft.py` art/assets 端点归你维护。

Lead 在你域里改了什么（diff 都在 `5401c68e`）：
1. `/api/assets/generate` 与三式/换皮**去掉了全部硬编码 mock**——mock 只在请求显式带 `mock:true`；前端加了「mock 试跑」勾选框。**别再写死 mock**，这是 demo 死穴。
2. `_gen_env()`：设置面板的生成 key（config.genKeys·千问聊天 key 复用为 DASHSCOPE）注入生成子进程；SettingsPanel 加了「美术生成 API Key」区。key 绝不落日志的纪律不变。
3. `/api/art/regenerate`、`/api/art/upload` 加了**编译期游戏分支**（无 manifest → fill CLI / 别名登记）；upload 全线 magic-bytes 嗅探。
4. `mergeLedger`（编号 append-only·墓碑保号）——derive 重跑不再挪号；`batchGenerate` 加 `only`（单槽）与 retired 跳过；**skinKey 别名双登记**=编译期游戏的写回。
5. 风格包迁 `scripts/style-packs.json` 纯数据；`style-packs.mjs` 只是加载器。**扩包改 JSON，不改代码。**
6. `art-replace.mjs` 的 NUL 字节已转义（git 恢复文本 diff）——以后别用字面控制字符拼 key。

**你接下来管**：平台/端点/大脑的一切迭代；真 key 到位后的首跑护航（探针输出、成本记录）；批处理「美术 n/m」进度灯（与心跳余项并批·你队列里的下一件）。

## ── 致 透视器/cockpit 程序员 ──

你的 cockpit 已按 owner「择一方法」裁决**退役**（组件+测试删除）——但你的三样核心想法全部活在主干里：
- 「编译期游戏也要有台账面板」→ 平台双数据源的 game 线（你验证的 art-ledger 读取约定原样沿用）；
- 「生成→人审→填回 ID」→ 单行生成=预览→人点确认（人审语义保留）；填回升级成 skinKey 别名登记（比填台账 ID 更进一步：直接上画面）；
- 「活场景看需求」→ 未收（平台现无活渲染窗）。**若要复活，走 requests.md 提案**把它做成平台的可选预览面板，别另起面板——一个平台是 owner 拍的板。
你捎话问的三件事的终局答案：schema=deriveRequirements 行结构为 canonical（终态档 §四）；双 UI 归一=完成；写回=已由 Lead 落地（skinKey 别名·你不用再推 blueprint 那步）。`/api/art/needs-fill` 与 `game-q-art-ledger.json` 已删——**别再引用**。

## ── 致 game-q 程序员 ──

1. **你的游戏已带皮肤槽**：`theme.ts`（TowerDef/EnemyDef.skin + SKIN 常量）→ `blueprint.ts` 七处 `Sprite:{textureKey:'q/…'}` 与 Shape 并存 → `game-q.ts` mount 拉本地 index 注册 AssetManager。**没资产时观感一字不变**（chooseRenderMode 回退 Shape）——这是硬承诺，改蓝图时别破坏「Sprite 必与 Shape 并存」。
2. **你手拼的 art-list 提示词没丢**：7 段已回填台账行 `prompt` 字段，生成时优先于 query。以后改提示词：**改台账（或平台上按编号改）**，不改 md——`art-list.md`/`asset-requirements.md` 已降级只读视图（头注已标）。q-spr-NN 私有编号废弃，一律 art-NN。
3. **重新生成美术需求文档（owner 会让重跑）的标准操作**：
   ```
   npx vite-node scripts/game-q-art-requirements.mjs
   ```
   放心重跑：编号 append-only（旧号不动/新槽顺延/删槽墓碑保号），已填的 prompt/生成状态/provenance 全保留。跑完检查两件事：`git diff public/games/game-q/art/art-ledger.json` 里旧行编号零变化；新增视觉实体是否该配皮肤槽（该配就在 blueprint 加 Sprite 行，重跑后新行自动带 skinKey）。
4. 加新可换皮实体的姿势 = 三行：theme 里定 skin key → blueprint 实体加 Sprite（anchorX/Y 0.5·zOrder 0）→ 重跑上面的脚本。别的全免。

## ── 致 PA（资产契约会审·此档即会审入口）──

请对以下四处做契约会审（发现问题开 requests 单，勿直改）：
1. **台账 canonical 行 schema**（终态档 §四）：`no/kind/slot/query/prompt?/skinKey?/placeholder/spec/context/status/gen/provenance/history?`；status 枚举含 `retired` 墓碑。
2. **style-packs.json schema**（工作流档 §四表）：中英双方言/palette/negative/post/params 钉死组/refImage 预留。
3. **本地 index 别名条目**：skinKey 别名与 gen/art-NN 指同一产物、tags 含 `skin`、provenance 硬字段（model/prompt/date/license）同 M2.5 口径——`registerAssetIndex` 消费端已验。
4. **上传条目**：magic-bytes 嗅探后入 index，`source:'upload'`、license『用户上传』。

## ── 验收基线（谁改动这条线，交付前照这组数字自查）──

tsc 0 · vitest 全绿（art-replace.test.mjs 20 测含编号三测/皮肤槽三测）· `python3 scripts/art-replace-smoke.py` 33/33 ·
`python3 scripts/art-review-smoke.py` 17/17 · `node scripts/game-skill-audit.mjs <game>` RATCHET PASS。
真 key 流程：设置面板填 key → 平台不勾 mock → 一键全量；无 key 必须见探针输出（空口 skip 不采信）。
