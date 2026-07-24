# game102《色流工坊 / Pixel Pour》· PE 开工 Handoff（GD 交付 2026-07-23）

> **一句话**：竖屏休闲益智——传送带承载「色炮」到发射位**自动向中央同色像素块连喷**消色，
> 5 待命槽复用 + 连击突破；中央=**整幅像素画**，散布金钥匙，**选对颜色/顺序打通路径命中钥匙 → 开宝箱门 → 过关**。
> **本文是 PE 单文件开工入口**。配套：`gdd.md`（数值/玩法）· `capability-plan.md`（Lead 裁①）· `ui-layout-spec.html`（UI 基准）· `prototype.html`（手感参考·非实现）。

---

## 0. 现状 · 开工点 · 必读

- **阶段**：S1 立项 ✅ · S2 能力计划 ✅（**Lead 裁①**：先组合表达·零运行时游戏层例外·不预下沉）→ **PE 从 S3 骨架关开工**。
- **开工第一命令**：`node scripts/game-pipeline.mjs board game102`（看板·只领第一个非绿阶段）。
- **必读（按序）**：本文 → `docs/playbooks/index.md` → `events-logic.md` / `randomness.md` / `rendering-fx.md`（对应线）→ `capability-plan.md`。
- **能力实名铁律**：下文 capability id 以 `buildCapabilityCatalog()` / `capability-registry` 为准（**别手抄**·§0 防漂移）；发现 id 对不上以机读为准并回本文修正。
- **红线**：游戏层**禁**自由 system 代码 / 手写 DOM / 裸 `Math.random`；机制全落**数据 + 现有能力解释**；撞墙（组合真表达不了）→ `docs/design/game102/requests.md` 报缺口升级引擎池，**绝不游戏层自写编排**。

---

## 1. 数据模型（Schema · 纯数据）

### 1.1 单关 schema（一关一条 · `levels.jsonc`）
```jsonc
{
  "no": 1,                          // 关号（稳定主键·保号）
  "name": "鲸",                     // 图名（选关/HUD 用）
  "cols": 16, "rows": 13,           // 像素画棋盘尺寸
  "palette": ["blue","lblue","teal"],// 本关颜色闭集（=补给区色炮种类·index 对齐 bitmap 数字）
  "ammo": 20,                       // 每炮弹药（连喷·实机校准）
  "conveyorCap": 5, "burstCap": 10, "slots": 5,  // 传送带/突破/待命槽
  "beltSpeed": 95,                  // 传送带速度（随关递增）
  "limit": { "kind": "moves", "n": 40 },   // 限额闭集: moves | {"kind":"time","sec":90}
  "goals": [                        // 目标闭集（可多条）
    { "kind": "clear" },            // 清空全部像素块
    { "kind": "keys", "n": 6 },     // 集齐 N 把钥匙
    { "kind": "door", "needKeys": 6, "target": 100 } // 集够钥匙→开门（target=展示计量）
  ],
  "stars": [3000, 6000, 9000],      // 1/2/3 星阈（分数·1 星须≥达标线）
  "seed": 20001,                    // 确定性种子（补给出色等一切随机）
  "bitmap": [                       // rows 行·每行 cols 字符（GD 手绘友好·亦可脚本生成）
    "................",             //  .=空格（无像素块）
    "....0001111.....",             //  0..N = palette[index] 的像素块
    "...0011111110...",
    "..001111111100.."              //  （完整 13 行·此处省略）
  ],
  "hp": [ /* 可选·同形字符层: .=1  2/3=硬块 hp */ ],
  "keys": [[5,2],[10,2],[3,6],[12,6],[6,9],[9,9]], // 金钥匙坐标[col,row]（须落在 bitmap 有像素处）
  "door": { "col": 7, "row": 10, "w": 2, "h": 2 }, // 宝箱门坐标（render 装饰+目标计量·非可射）
  "note": "教学：单色打通到钥匙"
}
```

### 1.2 装配映射（PE·纯转换零逻辑）
| 数据 | → | 引擎消费 |
|---|---|---|
| `bitmap` 字符 → 带色像素块阵 + `hp` 层 | | `tilemap`（位图→格·**S3 首要核对适配度**·见 §2 待验） |
| `palette` | | 色炮种类 + 像素色映射（渲染皮·§4） |
| `keys[]` | | 标记「钥匙格」（收集件）→ `event-when`+`gauge` 计数（§3.4） |
| `door` | | render 装饰 + 门目标 `gauge`（needKeys 达标→开门信号·§3.4） |
| `goals` / `limit` / `stars` | | 胜负链 `event-when`/`effect-apply` + `flow` + 结算数据（§3.5） |
| `seed` | | `RandomSeed`（补给出色·**禁裸 random**·`randomness.md`） |

### 1.3 参数总表
数值键位与基线见 `gdd.md §3`（ammo 20 / conveyorCap 5 / burstCap 10 / slots 5 / COMBO_WINDOW 等）——**全部走 config 数据**，PE 不写死。

---

## 2. Manifest 装配（S3 骨架关）

**目标**：manifest 立起来、`parseManifest` 零 error + 真引擎 `load` + 空跑 2 tick（「能存必须能跑」）。

形态 `{ capabilities: string[], entities: { id: { 组件: 数据 } } }`。**消费能力**（Lead 裁①核过全在 registry）：

```
tilemap · event-when · effect-apply · zone-occupancy · tray · launch ·
group-count · flow · gauge · clickable · (+ atoms: RandomSeed / resource / text-binding)
```

实体骨架（S3 先立起来·细则见 §3）：
- **board**：`tilemap` 一张（cells=bitmap→{color,hp}·特殊件 key/door 叠加标记）。
- **cannon/supply**：每色一个补给源实体（`{color, ammo}` + `clickable`）。
- **conveyor**：`zone-occupancy`（容量 5·队首=发射位）。
- **tray**：待命槽（slots=5）。
- **gauges**：`gauge` × 得分 / 连击 / 钥匙计数 / 门目标。
- **flow**：playing / victory / defeat。

> **S3 待验（Lead 指定）**：`tilemap` 对「位图→带色格阵 + 特殊件坐标」的**适配度** PE 落地即核——
> 若 `tilemap` 表达不了（如 per-cell hp / key 叠加），**回 `requests.md` 报缺口**（附最小复现 + 已试拼法），**不自造**。

---

## 3. 能力接线细则（S4 玩法关 · Lead 给的组合摆法）

> 全部走**声明式数据**（`event-when` 条件树 + `effect-apply` 效果 + 信号），**零游戏层散逻辑**。手册=`events-logic.md`。

### 3.1 传送带队列 + 发射位
- 点补给色 → 生成色炮入 `zone-occupancy`（占用 +1·满[cap]则拒/等待）。
- **队首递进**：`zone-occupancy` 队首 + `event-when` 到位边沿 → 该炮进入「发射位」状态。

### 3.2 自动同色开火（连喷）
- `event-when`：发射位炮 **且** `group-count(该色)>0` → `effect-apply` 触发 `launch`（抛射一发·`hitbox` 命中同色像素块 → hp-1 → 归零消除）。
- 每发 ammo-1，节奏 = 连喷间隔（数据）。

### 3.3 弹尽入槽
- `event-when`：炮 `ammo==0`（或 `group-count(该色)==0`）边沿 → 该炮出传送带 → 入 `tray`（有空槽时）。
- 点 `tray` 槽（`clickable`）→ 炮重装满（`ammo=cap`）→ 回 `zone-occupancy`。

### 3.4 钥匙收集 + 开宝箱门
- 钥匙格被同色消除 → `effect-apply` 钥匙 `gauge +1`。
- `event-when`：钥匙 `gauge == needKeys` → 发「开门」信号 → 门 `gauge` 满 + render 开门演出（`timeline`）。

### 3.5 突破 5→10 / 连击 / 胜负
- **突破**：`event-when` 快连间隔<阈值 → 切 `zone-occupancy` 容量数据 5→10（条件树切数据·**非新逻辑**）。
- **连击**：消除边沿续 combo `gauge`（COMBO_WINDOW 内）→ 得分 `gauge += base×combo`。
- **胜负** `flow`：goals 全达成→victory；`limit` 尽仍有像素→defeat；onEnter 落输入闸。

---

## 4. Play-field 渲染层（PE render 组件 · 非 UI）

手册=`rendering-fx.md`。以下走**引擎 render 组件 + 渲染器**（对齐 game-g 对战场·**不手写 DOM**）：
- 像素画棋盘（tilemap 格·Sprite/Color 皮）· 金钥匙 · 宝箱门（开门演出）· 传送带 + 色炮 · 抛射弹道 · 消除粒子/震屏。
- 皮肤槽：色炮 / 像素块 / 门 / 背景 全带皮肤槽（`art:` 或 Sprite）——美术走 S6 台账（`art-pipeline.md`）。
- 反馈（juice）：连击飘字 / BURST 光晕 / 消除粒子——参考 `casual-toolkit.md`。

---

## 5. UI 层（PUI 域 · PE 不做）

HUD/结算/选关/续命四屏 = **LayoutNode 纯数据**，基准=`ui-layout-spec.html`，工单 **REQ-G102-UI 派 PUI**。
PE 只负责 play-field 与 UI 的**信号对接**（写世界=action 信号入队·handler 不塞自由逻辑）。
**两层 1:1 律**：S4 结构 1:1 照 UI 稿（素皮）；S5 视觉 1:1（皮/字体/渐变）。

---

## 6. 随机与确定性

- 一切随机（补给出色等）走 `RandomSeed` + `nextRandom`（关卡 `seed` 字段）——**裸 `Math.random` = 红线**（`randomness.md`）。
- 保持 lockstep-safe（全整数 + 种子 PRNG）；balance-sim 依赖确定性回放。

---

## 7. 验收剧本（S4 机器门 · **GD 出 · PE 不改**）

> 依「验收剧本循环律」：玩法正确性裁判 = GD 写的剧本（seed+操作+逐步期望·纯数据），harness 驱动真引擎对账。
> **✅ GD 已交付 5 份**（>门槛 3）= `docs/design/game102/acceptance/*.scenario.jsonc`（+ README 定义**动作词表/机读态词表**）。
> **PE 只需写薄适配器** `src/games/game102/acceptance-adapter.ts`（纯接线：动作→引擎 action 信号、机读态→ README 投影表 Resource/Flag/StringVar），**不改剧本**；剧本写错=GD 改。
> 跑：`npx vite-node scripts/acceptance-run.mjs --game game102`（进推送门禁）。5 份覆盖：①基础消色 ②弹尽入槽+复用 ③钥匙开门 ④突破 5→10 ⑤限额判负。

---

## 8. balance-sim（关卡可解性 · GD 工具 · authoring-time）

- Lead 已准的例外（非运行时代码）：确定性 bot 跑每关 × N seeds → 输出**可解率 / 平均步 / 钥匙可达率 / 分数 P50·P85**。
- **解谜校验（本作关键）**：bot 须验证「存在一条颜色/顺序方案能命中全部钥匙且不堵死」——不可解的摆盘 = 关卡 bug，改 bitmap/keys 重跑。
- 报表落 `docs/design/game102/balance-report.md`（关卡表变更必重跑·陈旧=过期信号）。bot 全用引擎导出纯函数（**零自写规则副本**）。

---

## 9. 八阶段开工清单（PE 逐关推进 · 一会话一关）

| 关 | 做什么 | 机器门（gate） | 人门 |
|---|---|---|---|
| **S3 骨架** | manifest 立起（§2）· 核 `tilemap` 适配 | `parseManifest` 零 error + load + 2tick | 挂载目击签（截图） |
| **S4 玩法** | §3 组合接线 · 核心循环闭环 | 该游戏 walkthrough vitest 绿 **+ GD 验收剧本 ≥3 场景 conformance 绿** | 试玩签（真浏览器截图序列） |
| **S5 UI** | 对接 PUI 的 LayoutNode 四屏 · 守纪律 | `game-skill-audit game102` 红旗零 | `/check-ui` 结论签 |
| **S6 美术** | 台账→风格锚→生成→写回 | 台账推导（MOCK 不算完成） | 平台逐行复核 |
| **S7 品质** | 八维视觉评分卡 | —（人门为主） | 得分记 note 签 |
| **S8 终检** | tsc+vitest+build 三绿 + 复盘回填 | 三绿·证据绑 git HEAD+净树 | 手册缺口回填签 |

**完成判词**：宣布「完成」必须贴 `node scripts/game-pipeline.mjs board game102` **全绿**输出；不全绿只许说「做到 SN」。

---

## 10. 边界与红线（PE 一体适用）

- 游戏层**零 system 自由代码**：机制=数据+现有能力（Lead 裁①）；撞墙→ `requests.md` 报缺口升级引擎池（spec 由 Lead 亲笔·Opus 施工），**在此之前不游戏层自写编排**。
- 禁手写 DOM（UI 走 LayoutNode·play-field 走渲染器）· 禁裸 `Math.random` · 禁零测试出货 · 禁虚胖数据（填了没解释器的表）。
- 域边界：`src/games/game102/**` = PE；`src/ui/**` = PUI；引擎 = Lead。跨域改走 `requests.md`。
- 提交署名 `Claude <noreply@anthropic.com>`·信息以 session URL 结尾·不写模型标识·推 `claude/mainbranch`（fetch→rebase→scoped-gate 全绿→push）。
