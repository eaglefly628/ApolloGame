# game-103《幸存者核心原型》· 美术解决方案（art-plan v1）

> 2026-07-23 · GD-103 · 依 `docs/playbooks/art-pipeline.md`（编译期游戏线·game-q 样板）+ `assets.md`。
> **GD 只定槽位与需求·不碰资产**；实际导入/生成/接线=PA 域（asset-manager agent + resource-manager 技能）。
> 红线：**主体视觉实体必带皮肤槽**（`Sprite` + skinKey·**必与 Shape 并存**·未就绪回退 Shape=观感零变）；**台账只列有真消费槽的行**（禁孤儿行）；mock 永不上画面。

## 0. 一句话方案

**占位几何体（现成·已在设计稿）→ 免费 CC0 库自动解析（FreeArtLib·幸存者品类素材充足）→ 风格包 AI 生成终态（需真 key）**——三段递进，每段都可玩、可换皮、兜底不丢。

## 1. 美术需求槽位（源自 `ui-scene-design.md §5`）

| 主体 | 槽 | 数量 |
|---|---|---|
| 玩家 | Sprite | 1 |
| 敌人 E1–E6（蹒跚/疾行/胖子/爆裂/精英/Boss） | Sprite | 6 |
| 武器投射物 W1–W5 + 5 进化体 | Sprite | 10 |
| 经验宝石 蓝/绿/金 | Sprite | 3 |
| 道具 回血/磁铁/炸弹 | Sprite | 3 |
| 命中/AoE/进化特效 | 特效帧 | ~8 |
| HUD chrome（血/经验条框·图标） | LayoutNode 主题件/Button.skin | 走 UI 线 |

## 2. 三段路径（编译期游戏线）

### 段一 · 占位几何体（**现状·零成本·可玩**）
- 设计稿 `.dc.html` 已用圆/方/菱形 + 发光占位（玩家蓝圆·敌红圆·宝石菱形…）。
- PE 骨架期：视觉实体挂 `Shape`（程序化）——先跑通玩法，观感占位。

### 段二 · 免费 CC0 库（**近乎免费·demo 可用**·PA 主力）
Apollo 自带 **FreeArtLib** CC0 库，幸存者品类素材**存量充足**：

| 分类 | 存量 | 覆盖我们的 |
|---|---|---|
| `FreeArtLib/monster` | **235** | 6 敌人 + Boss + 变体绰绰有余 |
| `FreeArtLib/effect` | **238** | 投射物 + AoE + 命中 + 进化 FX |
| `FreeArtLib/player` | 19 | 玩家角色 |
| `FreeArtLib/item` | 13 | 宝石/回血/磁铁/炸弹 |
| `FreeArtLib/gui` | 10 | HUD 框/图标 |

- 接入：`resolveArtRefs` 确定性解析（同 query 同图）；PA 用 resource-manager 技能 vendor 进 `public/games/game-103/art/` 本地目录 + 登记 index。
- **结论：demo/首个可玩版几乎不必 AI 生成**——从免费库选配即可成型。

### 段三 · 风格包 AI 生成（**终态观感·需真 key**）
- 走美术平台「⚡ 一键全量」（`scripts/art-replace.mjs`）：选**风格包**（闭集·中英方言+palette+钉供应商）+ 填**本游戏风格锚** → 逐槽生成 → palette-snap + 规格缩放 → 落资产目录 + provenance。
- **风格锚建议**（GD 出题·PA 定稿）：暗色霓虹幸存者场景 + 高辨识度发光实体（近未来/像素/卡通三选一·待 owner 定调）。现有风格包（sakura-nijigen/apollo-toon/modern-manor/vegas-victoriana）均为卡牌/麻将题材·**幸存者宜新建专属风格锚**。
- **依赖卡口**：AI 生成需真 API key（连 `REQ-AIGEN` 卡口）；无 key = 探针 + mock 预览（mock 永不上画面）。

## 3. 接入三步（PE 骨架期·一次性·照 game-q 样板）

1. theme 定 skin key → 每个视觉实体蓝图加 `Sprite:{textureKey, anchorX:.5, anchorY:.5}`（**与 Shape 并存**）。
2. 写 requirements 推导脚本 `scripts/game-103-art-derive.mjs`（扫 skinKey → 生成 `art-ledger.json` 台账·append-only 保号·**零孤儿行**）。
3. mount 拉本地 index 注册 AssetManager（`game-q.ts` skinAssets 样板）。
- 换皮=skinKey 别名登记进 `public/games/game-103/art/index.json`，资产就绪自动换装，**玩法/蓝图零改**。

## 4. 分工与依赖

| 事项 | 归属 |
|---|---|
| 定槽位/需求/风格锚出题 | GD-103（本文档） |
| 蓝图挂 Sprite 槽 + 推导脚本 + AssetManager 接线 | PE（骨架期） |
| FreeArtLib vendor + index 登记 + AI 生成 + 人审 | PA（asset-manager agent） |
| AI 生成真 key | owner（连 REQ-AIGEN） |
| 台账孤儿审计 | `npm run ledger:audit`（完工=零孤儿） |

## 5. 里程碑对齐

- **M1–M2 原型**：段一几何体（够验证玩法/性能）。
- **M3 关卡**：段二 FreeArtLib 选配（敌人/特效/道具上真图·demo 观感）。
- **M5 打磨**：段三风格包 AI 生成终态（需 key）+ 命中反馈/屏震特效。

---

*配套：`ui-scene-design.md §5`（槽位总表）·`docs/playbooks/art-pipeline.md`（管线权威）。*
