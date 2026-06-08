# Game E · 逐步计分 Trace 设计（演出数据驱动化）

> 目标：消解 `game-e.tsx` 里**手算的计分演出帧序列**（去代码化审计 #10，唯一真缺口）。
> 原则：**引擎计分时额外吐一串「逐步事件」（trace），UI 只回放**。计分结果一字不改，UI 不再重建顺序/增量。
> 尺子：trace = 引擎报告「我按什么顺序、把谁加/乘了多少、当前 chips/mult 多少」——这是**数据**（最弱 LLM 也能消费这串事件画动画）。UI 回放=表现层。

---

## 1. 为什么必须引擎吐（不能 UI 重算）

UI 现在为了演出，**自己重算了一遍计分顺序**（基础→逐张→小丑→合并）——这就是要消解的专有游戏代码，且**有与引擎结果分叉的风险**。正确做法：**引擎是唯一真相**，它本就按确定顺序逐步改 chips/mult，只要把每一步**记下来**给 UI 即可。不是新能力，是给计分链加一个**输出缓冲**。

## 2. 数据形态

```ts
// 一步计分事件（引擎按真实执行顺序 append）。
interface ScoreEvent {
  seq: number;                       // 步序（0,1,2…）
  phase: 'base' | 'percard' | 'percard-rule' | 'joker' | 'combine';
  target: 'chips' | 'mult' | 'score';
  op: 'set' | 'add' | 'mul';
  value: number;                     // 本步的量（add 的加量 / mul 的倍率 / set 的值）
  chips: number;                     // 本步后 chips（供 UI 计数器跳动）
  mult: number;                      // 本步后 mult
  source?: string;                   // 语义来源（牌型名 / 'card' / Effect 实体 id）
  cardIndex?: number;                // percard：哪张牌（PlayedHand 下标）→ UI 高亮
  jokerId?: string;                  // joker：哪个小丑实体 → UI 抖动
}

// 挂在牌桌单例上的输出缓冲（每次计分开头清空）。
interface ScoreTrace { events: ScoreEvent[]; }
```

## 3. 谁 append（计分链各系统加几行，不改结果）

| 系统 | append 的事件 |
|------|--------------|
| `poker-eval`（set 牌型基础分） | 1 条 `base`：set chips/mult，source=牌型名 |
| `card-score-pass`（逐张） | 每张计分牌 1 条 `percard`（chips+=baseChips, cardIndex）；命中的逐张小丑各 1 条 `percard-rule`（jokerId） |
| `effect-apply`（手牌级小丑，按 order） | 每条命中的 Effect 1 条 `joker`（op/value/jokerId=Effect 实体 id），及最终 `combine`（score=chips×mult） |

每条都记**本步后的 chips/mult**（系统本就就地连写，顺手记一份）。顺序 = 引擎确定执行序（card-scoring 序 + effect-apply 的 order 排序）→ trace 天然确定。

## 4. 确定性 / 快照

- trace 是**表现输出**，不影响计分结果。建议**排除出 hashSnapshot**（同 Camera 先例），避免污染 lockstep hash + 它每次计分重生成。
- 即便不排除也安全（确定产生）；但 UI-only 输出排除更干净。
- 每次新计分（scoring 上升沿 / PlayedHand 非空首拍）**清空** events 再 append。

## 5. UI 回放（game-e.tsx 消解后）

```
出牌 → 引擎 tick 计分（chips/mult/score 真值 + ScoreTrace.events 就绪）
     → UI 读 ScoreTrace.events，按 seq 逐条定时回放：
         · base/percard：计数器跳到 event.chips/mult；cardIndex 高亮 + 飘 +value
         · joker/percard-rule：jokerId 对应小丑抖动；计数器跳
         · combine：score 大跳
     → 回放结束（最后一条 event 的 chips/mult/score == 引擎真值，必然吻合）
```
UI **不再有任何计分逻辑**——只是「读事件流、按时间轴画」。换计分规则/加小丑，trace 自动变，UI 一行不改。

## 6. 能力评审（该不该做 / 重组 vs 缺口）

- **重组够不够？** 不够。要拿到「逐步顺序 + 每步增量 + 每步后值」，只有计分链自己知道；UI 重算 = 专有代码 + 分叉风险。**故是引擎该补的输出**。
- **是新 Tier3 能力吗？** 不是。是给已有 `poker-eval`/`card-score-pass`/`effect-apply` **各加几行 append**（+ 一个 `ScoreTrace` 组件 + 排除出 hash）。**小钩子，集中、可审计**。
- **复用面**：任何「分步结算要演出」的玩法（杀戮尖塔式遗物结算、ARPG 伤害分解）都能复用这条 trace 模式 → 通用，不是 game-e 专属。

## 7. 落地顺序

1. 引擎：`ScoreTrace` 组件 + 三系统 append + 排除出 hash + 单测（trace 末条 == 资源真值；顺序确定）。
2. game-e.tsx：删手算 frame 序列，改读 `ScoreTrace.events` 回放（演出触发点全来自数据）。
3. 验收：grep game-e.tsx 无计分顺序/增量逻辑；trace 驱动演出；tsc+vitest+build 绿。

> 一句话：引擎按它本来的确定顺序「边算边记一串事件」，UI「读事件流画动画」。计分仍是引擎真相，演出变成数据回放——#10 专有代码消解。
