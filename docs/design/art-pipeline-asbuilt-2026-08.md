# 美术管线 · 如建全景（2026-08-06 · PST 出稿 · 供 owner review）

> **一句话**：把游戏里的视觉槽机器扫成一张带编号的需求台账，再按台账逐行 AI 出图、过机器校验门写回槽位、过人审复核收工——**台账是唯一真相，图按游戏类型分家存放**。
>
> 本页 = **当前实际跑的样子**（含 2026-08 的 ARTPIPE2 四翼 + 08-06 卡带美术归位）。
> 「做 X 用哪个件」查手册 `docs/playbooks/art-pipeline.md`；schema/五步全文查 `docs/design/art-replacement-workflow.md`；
> 07-09 那份终态档是**当时**的收口快照，之后的变更以本页为准。

---

## 一、全景：一张图六个环节

```
 ①扫槽          ②配风格        ③出图            ④写回          ⑤人审        ⑥入库
 derive    →   风格包+锚   →   batch/regen  →  replace/别名  →  approve  →  提交推送
 ↓             ↓              ↓                ↓                ↓            ↓
 art-ledger    闭集9包        真图落 art/gen   过 parseManifest  status=      内置→引擎仓
 .json         +本游戏锚      +provenance     零error 才落盘    approved     卡带→卡带仓
 （编号        （钉死         （断点续跑      （玩法零改）      （人门）      （08-06 分家）
  append-only）  供应商）       缓存不重扣费）
```

**台账 `art-ledger.json` 是整条线的唯一真相**：编号 `art-NN` append-only 永不挪号（重跑合并、退役留墓碑）；
每行记 query/prompt/风格包/provenance/history/status。改提示词 = 改台账行，**不是改文档**。

## 二、两条线：差别只在「写回」那一步

| | **卡带线**（创作台产出·`library/<slug>/`） | **内置游戏线**（`games/<slug>/`·如 game-g） |
|---|---|---|
| 玩法载体 | `manifest.json`（纯数据） | TS 源码 + 蓝图 |
| 视觉槽 | manifest 里的 `art:` 引用 | `Sprite.textureKey` + `skinKey` |
| **写回方式** | 按编号**重钉 manifest 引用**，过 `parseManifest` 零 error 才落盘 | 按 `skinKey` **别名登记**进 `index.json`，资产就绪自动换装（**绝不改蓝图代码**） |
| 美术存哪 | `library/<slug>/art/`（**不入引擎仓**·随卡带自己的 git 仓） | `public/games/<slug>/art/`（tracked·出货内容） |
| 换库/换皮 | ✅ 支持 | ⛔ 平台自动隐藏（无 manifest 可钉） |

> **08-06 变更（REQ-CARTART）**：卡带美术从 `public/games/` 搬进 `library/<slug>/art/`。
> 此前卡带被劈成两半（玩法在仓外、美术在仓内），换图会脏引擎仓、与 mainbranch 撞冲突。
> 关键是**引擎侧只认 URL 不认磁盘路径**，故 URL 契约 `/games/<slug>/art/**` 保持不变、只挪存储 →
> 引擎零改动、台账里的 servedPath 一字未改。伺服层（`server.py` + `vite.config.ts` 两个孪生 shim）做回退。

## 三、闭集与红线（这条线为什么不会跑飞）

- **风格包 = 闭集 9 个**（`neon-synthwave`/`pixel-retro`/`cartoon-thick`/`disney-supercell`/`dreamy-pastel`/
  `apollo-toon`(house)/`sakura-nijigen`/`vegas-victoriana`/`modern-manor`），每包钉死中英双方言 + palette + 供应商。
  另有 owner 自建本地风格库（`.apollo-styles.json`·不入库）。
- **供应商**：2D = 千问万相 / Seedream；3D = Tripo / Meshy。默认随风格包，可点名覆盖。
- **prompt 拼装**（逐行确定性）：`prompt` > `query+desc` > `query` ＋ 类型词 ＋ 包方言 ＋ 本游戏风格锚。
- **mock 只许显式、且永不上画面**：产物落独立命名空间 `gen/mock/`（gitignored），只供平台墙预览（⚙MOCK 标）——
  **不写回 manifest、不登记别名、不可 approve**。无 key 时必须见探针输出，静默顶替 = 假绿。
- **可消费槽铁律**：台账每行必须有真实消费槽（`art:` 或游戏侧消费的 `skinKey`）。无槽的孤儿行禁止上台账
  ——换了不上画面 = 白换。
- **游戏侧必须读 skinMap 优先、硬编码路径只作回退**——否则「换了没反应」（反面教材 game-101 立绘读死表）。

## 四、机器门与人门（double verify）

| 门 | 是什么 | 拦不拦推送 |
|---|---|---|
| `parseManifest` 零 error | 卡带线写回前的落盘门 | ✅ 不过不落盘 |
| `art-ledger-guard.mjs` | 黑户（磁盘有文件·台账无行）/ 死账（台账指的文件不在）/ 缺来源 | ⚠ **在门禁里但只报 WARN**（`allowExit:[0,2]`） |
| `ledger-audit.mjs` | 孤儿行（无消费槽） | ⚠ 顾问态·`--strict` 才单游戏拦 |
| **人审复核** approve | 人眼看过才算数；**mock 行拒绝复核** | 流程条第⑤步·全绿才算走完 |

## 五、入口（同一份台账，三个界面）

- **美术台账墙**（`ArtLedgerPanel`）——缩略图墙 + 五步流程条 + 三式替换（重生成/库选换/上传）+ 一键全量/换皮
  + **⤴ 提交推送**（内置游戏专用·08-06 加：改完一键 commit+rebase+push，凭证缺失秒失败不挂起）。
- **资产浏览器**（ARTPIPE2 A2-A4）——三栏目录树 + 拖入自动登记 + git 历史/回退到此版 + 消费方反查。
- **Workshop 素材屏** + 美术对话 agent——agent 可产 ```art-ops 提议，**人点头才执行，agent 永不代执行**。

## 六、当下真实体检（2026-08-06 实测）

| 游戏 | 台账行 | 状态分布 | 黑户 | 死账 |
|---|---|---|---|---|
| game-i | 103 | filled 103 | 0 | 0 |
| game102 | 14 | filled 14 | 0 | 0 |
| game101 | 69 | filled 65·replaced 4 | 3 | 0 |
| game-g | 110 | replaced 53·**needs-art 57** | 0 | 0 |
| game-b | 51 | replaced 41·planned 6·placeholder 4 | 0 | 0 |
| game-c | 36 | replaced 12·**placeholder 24** | 1 | 1 |
| game-103 | 23 | filled 12·needs-art 11 | 4 | 0 |
| game-a | 13 | filled 7·generated 2·awaiting-upload 3 | **57** | 1 |

总判词 **WARN**：黑户 65 处、死账 2 处。

## 七、已知缺口（我认为值得你拍板的）

1. **守卫只 WARN 不拦**——黑户 65 处能一路推上去。要不要把 `art-ledger-guard` 升成硬门（或对新增黑户上棘轮）？
2. **game-a 57 个黑户**集中在一家，像是批量导入没登台账；game-c 24 行 placeholder 长期未配。要不要专门清一轮？
3. **`pipeline.json` 仍落引擎仓**——08-06 那单只搬了 `art/`，立项卡不在 art 下没顺手扩面。卡带仍会往引擎仓丢这一个小文件。
4. **提示词 subject 仍是 `query+desc`（偏肥）**——你此前认可收敛成 `query`（功能标签）、风格全交给风格层，尚未做。
5. **WEBP 未支持**——若某供应商接口返 WEBP，解码器会明确报错（不是静默坏图）。
6. **卡带美术历史依赖卡带自己的 git 仓**——机器无 git 时降级为快照，历史粒度不如引擎仓。

## 八、这页与别处的关系（防口径漂移）

- 「做 X 用哪个件、按什么顺序」→ `docs/playbooks/art-pipeline.md`（手册·全员必读）
- schema / 五步流程 / 验收口径全文 → `docs/design/art-replacement-workflow.md`
- 卡带美术归位的图纸与如建 → `docs/design/cartridge-art-storage-2026-08.md`
- 二期两翼（台账强制 + 资产浏览器）图纸 → `docs/design/artpipe2-blueprint-2026-08.md`
- 07-09 终态档 → 当时的收口快照，**现状以本页为准**
