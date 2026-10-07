# 第三方代码台账（THIRD-PARTY NOTICES）

本仓包含从第三方项目移植的代码。逐条列出：出处、许可证、落在哪、改了什么。
**新增移植代码时必须在这里登记**（Apache-2.0 第 4 条等许可证要求「随分发附带许可证正文与修改说明」，
只在源文件里写一行 SPDX 是不够的）。

---

## Spritegen（离线美术技能）

- 上游：https://github.com/usexless/Spritegen ，固定 revision `510d2552add33ab056f16c69b1c70f748fea699d`。
- 作者：上游 package.json 标记 Jakob；license 字段声明 MIT，但此 revision **没有完整 LICENSE 文件**。本地安装用于作者工具；向外再分发前需补齐上游完整许可声明，不能把本记录当作许可正文。
- 位置：`.claude/skills/spritegen/`（入库源）与 `.agents/skills/spritegen/`（本地 Codex 镜像）；不进入游戏运行时依赖。
- 本地修改：Apollo 指令与导出工具链接、custom 绘本风提示词、禁用删除旧 run 的 `--force`、禁止隐式拉伸图集、空帧作为错误、测试。
- 生成图片的授权独立于脚本许可；每项游戏资产另记模型、参考图、提示词和来源。`UPSTREAM.json` 保留版本与修改记录。

---

## RVO2 Library（ORCA 避让）

| 项 | 内容 |
|---|---|
| 上游 | RVO2 Library · <https://gamma.cs.unc.edu/RVO2/> · 源码 <https://github.com/snape/RVO2> |
| 版权 | Copyright 2008 University of North Carolina at Chapel Hill |
| 作者 | Jur van den Berg, Stephen J. Guy, Jamie Snape, Ming C. Lin, Dinesh Manocha |
| 许可证 | Apache License 2.0 —— **正文见 `licenses/Apache-2.0.txt`** |
| 移植进 | `src/skills/tier2/orca.ts`（对应上游 `src/Agent.cc` 的 agent 部分 + `src/Vector2.cc` 的常量） |
| 消费方 | `src/skills/tier2/flow-field.ts`（`FlowAgent.orca`） |

**修改说明**（Apache-2.0 §4(b)「载明显著修改」；逐条的技术理由写在 `orca.ts` 文件头）：

1. 不含障碍物（Obstacle）那半段——本仓静态障碍由流场的 `blocked` 格解决。
2. 不含 KdTree——邻居改由流场自带的网格分桶提供，但保留「按距离平方升序取最近 k 个」的语义。
3. C++ `float`(32 位) → JS `number`(64 位)。
4. `Agent` 类拆成纯函数。
5. 邻域半径由 `timeHorizon × speed × ORCA_RANGE_SLACK + radius` 推导，而非上游的独立 `neighborDist`。
6. `timeStep` 恒为 1（本引擎一拍 = 一个时间单位）。
7. 补了上游没有的两处：**完全同位**的退化分支（上游 `w/|w|` 在此除零得 NaN，而 NaN 约束会被
   线性规划静默丢弃）、**不还礼的邻居**（上游假设所有 agent 都跑 ORCA，本仓允许混装单位类型）。

> 上游未附 NOTICE 文件，故本仓无 NOTICE 转载义务（Apache-2.0 §4(d) 以「上游存在 NOTICE」为前提）。
