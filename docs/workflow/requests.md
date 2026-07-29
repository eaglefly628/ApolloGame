# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中



### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **M0 ✅ PASS + M0.5 ✅ PASS（Lead 对抗性验收 2026-07-16）；M1 试产 open·等真 key（连 REQ-AIGEN 卡口）** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0 ✅ done（PA·2026-07-16·待 Lead 对抗性验收）**：`scripts/styleset-ledger.mjs`（静态枚举 §六 清单→art-replace `mergeLedger` 保号·mode:library）+ 库台账 `assets/styleset/apollo-toon/style-ledger.json`（**72 行**·ui 40/fx 12/3d 20）+ 风格包 `apollo-toon` 条目（`scripts/style-packs.json`·stylePrompt 锚 v2 原文·8 色·refImage:null·无厂牌词）+ mock 全链跑通（60 texture 程序化 PNG + 12 mesh cube.glb 占位·落 gen/mock 分域·登记共享 index provenance 硬字段 generator:mock+styleset）+ `asset-reconcile --shared` PASS + 测试 `scripts/styleset-ledger.test.mjs`（5 例·保号/顺延/风格包/reconcile）+ 手册 `docs/playbooks/assets.md ⑨` 回填。**偏差**：`scripts/asset-reconcile.mjs` NON_ASSET 加跳 `style-ledger.json`（库台账元数据非资产·同 art-ledger.json 口径·未碰 art-replace 本体）。真 key 批量生成=M1（PA+PST 会审 styleset 目标扩展）。
> **M0.5 ✅ done（PUI·2026-07-16·待 Lead 对抗性验收）**：新 UITheme `apollo-toon`「水墨玩趣」（`src/ui/apollo-toon-theme.ts`·全 token 覆盖·亮宣纸皮）——8 色板入 palette（文字色令牌取可读深变体·鲜色进皮/背景）+ 程序化 data-URI 皮 4 kind 糖果厚底唇钮（64×64·9-slice slice=12·顶高光+厚唇+墨笔触边）+ 程序化水墨远山背景（`texture`·cover）+ 柔光晕染（`wash`）+ 纸纹面（`panelTexture`）。**闭集扩展 1 处**：UITheme 加 `panelTexture?` 令牌（面板级底纹·`render.ts renderPanel` 消费·guard `!bare`·缺省字节不变）+ 回填 `ui.md`。game-i 换皮下拉接入并置顶 + 选单收敛 3 个（水墨玩趣/青瓷·墨蓝/紫·霓晶·余 5 隐藏不删码）。门禁全绿（tsc+2642 vitest+build）；check-ui：validate 零 issue + ui-audit 3 显式 tab（layout/3dui/shop）0 阻断；真浏览器截图 5 张（厚唇钮/纸纹面/水墨背景成立）。**记账**：程序化皮=占位真相（provenance:procedural·真 key 后 M2 逐行替换）。**已知缺口（提 Lead）**：①ui-audit 对 `border-image` 皮盲区——白字糖果皮在亮父面被判 1.21 假阳（真渲白字压深糖体可读）·仅「无 activeTab 全 tabpage 同显」非真状态触发·逐 tab 显式审全过；②默认 tab-layout 在**任何**亮主题（含既有 daylight）皆因 `dim` 段标题/皮 demo 白字判低对比——非本主题引入。
> **⚖ Lead 对抗性验收（2026-07-16·双线判 PASS）**：门禁独立复跑六项全绿（tsc·vitest 349 文件/2642·build·双守卫·reconcile 三方一致）；域界核对 M0=80 文件全 PA 域、M0.5=12 文件全 PUI 域（引擎域零触碰）；真浏览器亲验（swiftshader）——选单恰 3 项且水墨玩趣置顶、切主题后三签名成立（厚底唇糖果钮/纸纹面/水墨远山）。**偏差裁决**：M0 四条（reconcile 跳台账·风格包全字段·行数落点 72·kind 词表 texture/mesh）全 INTENTIONAL 准许——kind 词表在 M1 接链时须与 art-replace 词表映射对齐；M0.5 `panelTexture` 闭集扩展 INTENTIONAL 准许（沿 texture/wash 先例·guard+点名测试+手册回填齐）。**遗留**：①ui-audit border-image 盲区 + 亮主题 dim 假阳 = PUI 工具债（非阻断·随后续批修）；②换皮**置顶未改默认**（默认仍青瓷·墨蓝）——是否连默认切 apollo-toon 留 owner 拍板（M3 对齐时顺手做）。
> **+ 三游戏风格锚条目 ✅ done（PA·2026-07-17·待 Lead 验收）**：`scripts/style-packs.json` 加 3 条（照 apollo-toon 样板全字段·无厂牌词·refImage:null·negative/post/params 同样板·seed 1776-78·各 8 色 palette）——`sakura-nijigen`（三游戏共用·女性向二次元人物锚·出处 game-b gdd §九+REQ-C-ART 修订①）·`vegas-victoriana`（game-c 场景锚·REQ-C-ART ① 原文锚+鎏金/呢绿/酒红等 8 色）·`modern-manor`（game-a 场景锚·brief §2.2 现代私宅夜局+暖木/夜蓝/灯金等 8 色）。门禁全绿（tsc+vitest 全量+build+双守卫）；art-replace pack 迭代校验绿。


<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结迁归档（requests-archive.md）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


### REQ-SHELL-公共壳三件 · host-runloop + game-art-load + local-store（101/102/103 沉淀盘点·owner 拍板沉淀） · [2026-07-29] · Lead 裁决（盘点=4~7 家重复实证·全是壳层非 sim） → **指派：Opus** · status: **✅ done（Opus 2026-07-29·待 Lead 对抗性验收）** · 优先级: P1 · 类型: 引擎 host/assets/services 公共设施（非 skills tier）
> **⚖ Lead 图纸（三件一单·只建引擎件+落迁移单·不动任何游戏代码）**：
> ① **host-runloop**（`src/engine/host/`·mount-host 姊妹件）：startSim/stopSim/restart + `lastSig` 差分重绘 + 局终冻结 sim + overlay 挂/摘——公倍数取自四家现状（game-103.ts:157-186,199-236 / game-q.ts:87-110,131-152 / game-t.ts:130-250 / game101.ts:360-388），API=宿主传回调（读态/建UI/终局钩）·~90-120 行+测。
> ② **game-art-load**（`src/assets/`）：fetch `/games/<slug>/art/index.json` → 两形态返回（AssetManager 注册 / skinKey→URL 表）·失败静默回退（既有共识）·消解 game-a/c 两份近逐字 art-overrides（57 vs 95 行）·~60-80 行+测。
> ③ **local-store**（`src/services/persist/`）：**提升 game-f `account.ts:19-30` 现成 KV 抽象**（game-f 冻结·只抄不动原文件）——typed KV：get/set/remove + JSON + 形状校验 + 无 storage 优雅降级·~50 行+测；附薄函数 local-leaderboard（插入排序+名次+截断·盘点候选 7 并入）。
> ④ **迁移不在本单**：在 game-q/t/101/103/a/c 各自 `docs/design/<g>/requests.md` 落迁移工单（指派各 PE·引用本单件名）；**game-103 的单里额外记账**：achievements.ts+leaderboard.ts 94 行未报备且与 AchievementSync/PlatformPort 重叠——补 capability-plan §4 条目 + 随迁移消解。手册回填 assets.md/save-platform.md 各一行 + index.md。
> ⑤ 红线：纯壳层·不进 sim/hash·不碰 src/games、src/ui、three-*；测试照 services 先例。
> **✅ 完工回执（Opus 2026-07-29·只建件不迁游戏）**：三件 + 32 测全绿；`scripts/scoped-gate.mjs --run` 判 FULL（碰引擎面）→ tsc + 全量 vitest + build + 双守卫（docs-ref/context-budget）**退出码 0**。
> - **①`src/engine/host/run-loop.ts`**（191 行·净码 109）+ `run-loop.test.ts`（11 例）：`createRunLoop({create,engineOf,read,sig,paint,over?,onOver?,overlay?,freezeOnOver?,dispose?,reset?,defer?}) → {start,stop,restart,refresh,invalidate,session}`。宿主传回调（`create` 建本局运行体·形状由宿主定 → `engineOf` 取 subscribe/start/stop 面），件只管四件事的时序：开/停/重开 · `lastSig` 差分重绘 · 局终**首见一次**（`onOver` 幂等·入参即本帧 state·宿主可就地补结算字段）+ 冻结 · overlay 挂/摘。测试点：首帧即投影/start 幂等/同签名不重绘/invalidate/局终幂等+延迟冻结/局终首帧强制重绘/回局内重新武装/freezeOnOver:false/stop 全释放/restart 后旧冻结不误停新局/无 over 永不冻结。
> - **②`src/assets/game-art-load.ts`**（104 行·净码 60·出 `@assets/index.js`）+ 测（7 例）：`loadGameArtInto(manager,slug)`（注册进 AssetManager·按 key）· `loadGameArtOverrides(slug)`（`{skinKey:url}` 表·按 URL）· 纯函数 `pickArtOverrides(raw,slug)` · `createArtAssets()` · `gameArtIndexUrl(slug)`。失败静默回退四路（非 200 / 坏 JSON / schema 不合法 / headless 无 fetch）逐条有测；筛选判据（`<slug>/` 前缀 + `gen:`/`vendored`/`tags:skin`）与 game-a/c 两份逐字一致。
> - **③`src/services/persist/`**（`local-store.ts` 145 行·净码 88 + `leaderboard.ts` 24 + `index.ts`）+ 测（14 例）：`localStore(key, fallback|工厂, codec?, kv?) → {get,set,remove,key}` + KV（`memoryKV`/`defaultKV` 优雅降级）+ **codec 闭集 4 款**（`jsonCodec` 形状校验 / `textCodec` 原文枚举 / `intCodec` 整数+钳 / `flagCodec` `'1'`\|`'0'`）+ `insertRanked(entry,prev,cmp,max)→{board,rank}`。坏档/隐私模式/配额满/无 localStorage 全测到（**绝不抛**）。
> - **迁移单已落**（不动任何游戏代码）：`game-q`/`game-t`（冻结中·标明等停摆终字）/`game101`/`game-103`/`game-a`/`game-c` 各 1 条 + **据实追加 `game102` 1 条**（图纸点名的六处 art 装载有两处在 game-102：`game102.ts:72-80`+`voxel-proto.ts:276`，不落单则重复留存）；每条写清件名 + 替换点 file:line + 验收 + 红线。**game-103 另落 94 行未报备账**（`achievements.ts` 54 + `leaderboard.ts` 40·与 `AchievementSync`/`PlatformPort` 重叠）：补 capability-plan §4 例外行 + 随迁移消解，标明「不许借机加成就/改阈值」。
> - **手册回填**：`assets.md ①` 加装载行 · `save-platform.md ①` 加局外小态行（并划清与 StoragePort/SavePort 的界）· `playbooks/index.md` 加「宿主壳层公共件」一行。
> - **据实偏差（5 条）**：(a) ③ 净码 88 > 图纸 ~50——多在 codec 闭集，**4 款各对应 ≥2 处存量真实写法**（JSON 档 5 家 / 静音位 3 家 / 语言枚举 2 家 / 整数钳 2 家），迁移后**字节级同格式**老档不丢，非投机加宽；(b) 薄 leaderboard 只落纯函数 `insertRanked`，**未做 load/record/save 包装件**——现仅 game-103 一处真实用例，与 `localStore` 三行配对即可（用法写在注释），避免为单站点造抽象；(c) 追加 game102 迁移单（见上·+1 家）；(d) 为腾回填空间做了 5 处**无损压缩**（assets.md 合并两行头注；index.md 删「S4/S5 门证一部分」「每本 ≤80 行」「指向 registry+catalog 取字段」三处**同文件内已重复**的话 + dokiworld `--target` 旗标 + 红旗列表空格）——**`docs/playbooks/index.md` 现 4199/4200 字符，只余 1**：下一位要往它加字的人须先腾字或请 Lead 批改 `context-budget-baseline.json`；(e) 三件的 API 形态全部从四家/六家/七家现状抽取（file:line 已逐条核读），未臆造未用到的参数。
> - **⚠ 顺带发现的真 bug（本单未修·超红线·请 Lead 裁）**：`src/runtime/engine.ts:70-80` 的 loop 在 `notifyListeners()` **之后**才 `rafId = requestAnimationFrame(loop)` → 从订阅回调里**同步** `engine.stop()` 会被立刻重挂覆盖（=game-103 记档的 BUG-04）。故 **`game-q.ts:104` 与 `game-t.ts:207` 的「局终冻结」现在其实没生效**（game-103 用 microtask 绕过）。本件冻结默认走 `queueMicrotask` 已在壳层规避，两家迁移单写明「迁移即修好」；**根因是否改引擎核（改 loop 重挂顺序=行为面·非壳层）留 Lead 裁**。
> - **红线自证**：`src/games`/`src/ui`/`three-*` **零触碰**（本提交 diff 里游戏面只有 `docs/design/<g>/requests.md` 的工单文字）；三件全是局外壳层，不进 world/snapshot/hash，不参与回放/lockstep。
> - **未落单的存量（供 Lead 决定后续）**：图纸点名六家之外还有 `game-x/record.ts`、`game-g/{sound,sfx,bgm,game-g-save}.ts`、`game-c/sound.ts` 等 localStorage 站点可收编；`game-f/account.ts` = 本件出处但**game-f 冻结·只抄不动**（照图纸）。

### 📦 3D 渲染线需求 → 已移至 `docs/workflow/requests-3d.md`（owner 2026-06-28 立独立池）

> Mesh3D/Transform3D/Camera3D/Sky3D/Model3D/Light3D/Post3D 等 **3D 盒庭渲染线 + Game Z** 的需求 / 工单（含 `REQ-3D-W1高效引擎`·实例化绘制、`REQ-3D-Model导入`·glTF）**全部移至 [`requests-3d.md`](./requests-3d.md)**。新 3D 需求进那里、不进本文件；本文件留通用 UI 库 / 其它游戏需求。

## 已结案条目 → 全文见 `requests-archive.md`

> 所有 done/wontfix/作废 条目（含裁决理由与完工摘要）已归档到 `requests-archive.md`；查旧单先 grep 它。本池只留活跃 open/in-progress/排队 条目（防每读付历史 token·owner 2026-07-04 token 底盘优化）。

## 需求模板（复制这段填写·先确认：游戏级工单请写该游戏的 `docs/design/<game>/requests.md`，此处只收引擎级）

```
### [YYYY-MM-DD] · [提出人角色] · status: open
- 想实现的行为：
- 已经试了什么（哪些能力 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案（可选）· 边界（本单允许触碰的文件范围·复查门核对用）：
```

---
