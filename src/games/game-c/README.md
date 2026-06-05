# Game C ·《缝纫物语》(Stitch & Style)

> 负责人：**PC**（Game Creator）。题材：女孩子换装 · 三消（针线/布料/缎带）+ 缝纫店养成 + 爱诗(AIGP)视频展示。
> 设计文档：`docs/game-design/game-c-dressup-match3.md`。

## 一句话

**主玩法**=针线缝纫主题三消；**数据玩法**=用消除攒到的材料升级缝纫店、做出更华丽的衣服；**输出点**=把女孩当前换装喂给「爱诗」视频生成做展示。

## 这一版（v0.1）交付什么

PC 是 **Game Creator**：只做**数据驱动的装配**，不写游戏专属系统代码。本版把**能用现成引擎能力表达的部分**全部装配为数据，把**引擎缺的逻辑**写成需求。

| 部分 | 状态 | 怎么实现 |
|------|------|---------|
| 材料经济（6 材料 + 针线币） | ✅ 数据 | `resource`(F1) 原子，各一个 `Resource` |
| 缝纫店升级链（攒够材料→解锁衣服→推进外观） | ✅ 数据 | `event-when` + `effect-apply`（Condition→Event→Effect），见 `blueprint.ts` |
| 当前换装外观（供展示读取） | ✅ 数据 | `state`(J1) + `text`(L6) |
| 爱诗(AIGP)提示词组装表（外观→视频 prompt） | ✅ 数据 | `theme.ts` 的 `LOOK_PROMPTS` / `composeAishePrompt`（= 周期表 X4 ShadowDictionary 的数据形态） |
| **三消棋盘机制**（找连/交换/重力/补块/消除产材料） | ⛔ 引擎缺口 → **已提需求 REQ-C-001** | 待引擎团队下沉为通用 capability |
| 棋格点击命中 → 语义动作 | ⛔ 缺口 → **REQ-C-002** | 同上 |
| 主动缝制消费（花材料换衣服） | ⛔ 缺口 → **REQ-C-003** | 同上 |
| 爱诗视频生成后端（表现层旁路） | ⛔ 缺口 → **REQ-C-004** | 同上 |

> REQ-C-001 落地后，棋盘 capability 只要往这些 `Resource` 灌 `ResourceModify`，本目录已装配好的整条升级/换装/展示链会**自动点亮**，无需改游戏数据。

## 文件

```
theme.ts        纯内容数据：材料 / 衣服阶梯 / 外观 / 爱诗提示词表
blueprint.ts    纯数据装配：材料 Resource + 升级链(Condition→Event→Effect) + 外观 state
index.ts        导出
game-c.test.ts  数据验证：模拟消除掉落 → 断言升级链点亮（5 测试，确定性）
../../game-c.tsx        launcher 卡带：工坊预览（表现层，读世界态渲染；标注核心待 REQ-C-001）
```

## 边界（PC 自律）

- ✅ 自由改：`src/games/game-c/**` + 本游戏的 launcher 卡带 + `docs/`。
- ⛔ 只读 + 提需求：`src/engine/**`、`src/skills/**`、`src/assets/**`、共享组件契约、`SystemPhase`、拓扑/求解器。
- 拿不准算引擎还是游戏？→ 当引擎，提需求。
