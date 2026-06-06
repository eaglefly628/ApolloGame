# 参考库 · OpenGame（Open Agentic Coding for Games）

> 加入我们 ref 的外部参考。目的：理解其设计 → 和 Apollo 对比 → 把能吸收的直接拿过来。

- 仓库：https://github.com/leigest519/OpenGame （Apache-2.0，TypeScript 为主，~2.5k★）
- 论文：*OpenGame: Open Agentic Coding for Games*（arXiv 2604.18394，2026-04）
- 运行时基座：fork 自 [qwen-code](https://github.com/QwenLM/qwen-code) 智能体运行时
- 一句话：**首个面向"自然语言 → 端到端可玩网页游戏"的开源智能体框架**。

---

## 1. 它的设计（抓工程，不抓训练）

从 NL prompt 到可玩游戏的流水线：

```
prompt
  → 游戏类型分类 + GDD(设计文档) 生成   [reasoning 模型]
  → Template Skill：选引擎(canvas/Phaser/three.js) + 搭稳定工程骨架
  → 代码生成                            [GameCoder-27B]
  → Debug Skill：沙箱里跑 + 抓集成/运行时错误 + 系统化修复
  → 循环直到"可玩"
  → 多模态素材：图(精灵/背景/图块) · 视频(i2v 动画) · 音频(LLM 写 ABC 谱→本地渲染)
```

三大件：

- **Game Skill = Template Skill + Debug Skill**（核心创新，且**会成长**）：
  - *Template Skill*：从经验里**长出一座工程骨架库**，稳住跨文件一致性（场景接线、状态耦合不崩）。
  - *Debug Skill*：维护一份**经验证修复的"活协议"**（verified fixes），把反复出现的集成/运行时错误**匹配 → 复用修复**。
- **GameCoder-27B**：为游戏引擎专门训练的代码 LLM（持续预训练 → SFT on 游戏开发轨迹 → 用"可玩性信号"做执行落地的 RL）。
- **OpenGame-Bench**：**不是静态看代码**，而是**真启动游戏、脚本驱动交互、核验可玩性**（渲染/操作/循环推进/胜负），打三项分：
  - **Build Health**（能不能跑起来/构建健康）
  - **Visual Usability**（视觉可用性，headless 浏览器截图 + VLM 评审）
  - **Intent Alignment**（是否对得上 prompt 意图）

配置（`.env.example`）：主 agent / reasoning / image / video / audio **分模型分 provider**（OpenAI / 通义DashScope / 豆包ARK / fal.ai / OpenRouter），`--yolo` 等审批模式。

---

## 2. 和 Apollo 对比

| 维度 | OpenGame | ApolloGame（我们） |
|---|---|---|
| 产物形态 | LLM **直接写引擎代码**（canvas/Phaser/three 多文件工程） | **游戏=数据**：26 atom + capability 装配出 `WorldBlueprint`（纯 JSON 可重建） |
| 生成前 | 先分类 + 出 **GDD**，再写 | apollo.py 直接 prompt → blueprint JSON（`_validate_blueprint` 结构校验） |
| 稳定性手段 | Template Skill 骨架库 + Debug Skill 修复协议 | 引擎 capability **自描述 schema** + 确定性 lockstep（同输入同 hash） |
| **验证方式** | **执行落地**：跑起来 + 脚本交互 + **VLM 看截图**（OpenGame-Bench） | 老软肋：**从没在浏览器看过一帧**；只有单测 + renderToString 烟雾 |
| 素材 | 多模态生成（图/视频/ABC 音频）分 provider | 资产清单 TBF/filled + 资产透视器（本会话做的）；生成端是路线图 |
| 引擎 | 借现成（canvas/Phaser/three） | **自研 ECS**（确定性、可回滚、可 lockstep）——这是我们独有强项 |
| 多人 | 无强调 | 确定性 lockstep（我们独有） |

**结论**：OpenGame 在**"生成 → 执行验证"的闭环**上明显领先；我们在**确定性 ECS 数据底座**上有它没有的东西。最该补的就是它的**执行落地验证**。

---

## 3. 可吸收清单（直接拿过来）

| # | 吸收点 | 来自 OpenGame | 状态 |
|---|---|---|---|
| 1 | **ApolloBench：执行落地体检** | OpenGame-Bench | ✅ **已实现**（`src/bench/`）。把每份蓝图喂进真实引擎跑 N tick，按 Structure/Load/Determinism/Numeric/Visual 五轴打分；**游戏类型感知**（空间 vs VN/sim，对应它的"游戏类型分类"）。`npm run bench` / `python3 apollo.py bench` / 启动器 Dev Tools「Bench」按钮 / 单测守 `src/bench/apollo-bench.test.ts`。 |
| 2 | **Debug Skill：经验证修复协议** | Debug Skill | ✅ **已起头**（`docs/ref/verified-fixes.md`）。把本会话真修过的 bug（透视器白屏、Windows WinError 2）按"症状→根因→修复→守卫"立档，成长式追加。 |
| 3 | 游戏类型分类 → 分型验证 | 类型分类 | ✅ 已并入 ApolloBench（spatial/non-spatial 不同评分口径）。 |
| 4 | **GDD-first**：先出设计文档再生成 | reasoning 阶段 | 🔜 路线图。apollo.py 现在一步到位 prompt→JSON；可加"先出 GDD → 再装配蓝图"两段式提质。 |
| 5 | Template 骨架库（成长式） | Template Skill | 🟡 部分。我们有 `PRESET_BLUEPRINTS` + 3 个游戏；可形式化成生成器可 scaffold 的模板注册表。 |
| 6 | 真·视觉可用性（headless 浏览器 + VLM 评审） | Visual Usability | 🔜 路线图。需要 playwright/puppeteer（当前未装）+ VLM 接入；ApolloBench 的 Visual 轴是其**数据级代理**（渲染项有限且落在视口内），不是替代。 |
| 7 | 多模态素材生成分 provider（含 ABC 谱音频） | 素材管线 | 🔜 路线图。与我们既有资产 TBF/manifest 流程对接。 |

> 诚实边界：第 6 项（像素级 VLM 评审）我们**现在做不了**（无 headless 浏览器/VLM）。ApolloBench 只在数据层逼近它——能抓"渲染不出东西/全跑到画面外/NaN 炸裂"，但不能替代"人眼/VLM 看一眼好不好看"。

---

## Sources
- [GitHub · leigest519/OpenGame](https://github.com/leigest519/OpenGame)
- [arXiv 2604.18394 · OpenGame: Open Agentic Coding for Games](https://arxiv.org/abs/2604.18394)
- [Hugging Face Papers · 2604.18394](https://huggingface.co/papers/2604.18394)
- qwen-code 运行时：https://github.com/QwenLM/qwen-code
