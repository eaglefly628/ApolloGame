# Apollo AI Dev Pipeline — 设计备案

> 讨论时间：2026-06-17　　状态：**架构已定，实施中**
>
> 记录「创意 → 发布」完整工具流的设计决策，供后续实施参考。

---

## 一、定位

**对象**：内部团队（X）+ 外部小游戏工作室（Y）
**核心价值**：LLM 把设计意图翻译成 Apollo 数据——人只需写创意，引擎跑数据，工具链完成中间转化。
**最高纲领**：数据驱动宣言不变。LLM 输出的是**数据**（蓝图/关卡/组件参数），不是游戏专属 TS 代码。

---

## 二、六段流水线

```
[1] BRIEF        →  [2] SPEC DOC    →  [3] ASSET MANIFEST
 人写创意描述         LLM 结构化         LLM 提取资源 id 表
 brief.md             game-X-spec.md     assets/game-X.json

────────────────── LLM / API Key 介入边界 ─────────────────

[4] DATA GEN     →  [5] VALIDATE    →  [6] SHIP
 LLM 读 schema        tsc + vitest       build_game.py
 → blueprint /         失败反馈 LLM        apollo-X-rk3562.tar.gz
   level data           最多 N 次重试
   src/games/X/
```

### 各段现状

| 段 | 现状 | 文件 |
|---|---|---|
| [1] Brief 模板 | 有 design-doc 范式，待固化成统一模板 | `docs/game-design/*.md` |
| [2] Spec Doc | 无自动化，人工编写 | 待建 |
| [3] Asset Manifest | 规范在 `asset-flow.md`，无自动化 | 待建 |
| **[4] Data Gen** | **空白，最核心缺口** | 待建 |
| [5] Validate + 重试 | tsc + vitest 已有，重试循环无 | 待建 |
| [6] Ship | **已完成** — `scripts/build_game.py` | ✓ |

---

## 三、工具链文件规划

```
scripts/
  build_game.py          ✓ 已有 — 打包任意游戏为 RK3562 tar.gz
  preview_cartridge.py   ✓ 已有 — 本地预览 CartridgeOS
  create_game.py         ○ 待建 — LLM 生成流水线主入口
  validate_game.py       ○ 待建 — tsc + vitest 单游戏校验 + 重试

prompts/                 ○ 待建 — LLM prompt 模板
  schema-context.md        自动从 protocol/components/ 提取的 schema
  blueprint-gen.md         few-shot blueprint 生成示例
  brief-template.md        创意简报填写模板

.apollo-config.json      ○ 待建 — API Key、模型选择（gitignore）
```

---

## 四、[4] Data Gen 的设计决策（待定）

LLM 需要三件事喂给 prompt：

| 输入 | 来源 | 准备方式 |
|---|---|---|
| Schema context | `src/engine/protocol/components/` | 脚本自动提取 |
| Few-shot examples | `src/assembly/*.ts` + `src/games/game-f/` | 手工精选截段 |
| Design brief | 用户写的 `brief.md` | 用户填写 |

**输出格式（两条路，用户决策中）**

| | 方案 A（稳）| 方案 B（快）|
|---|---|---|
| 格式 | **JSON** 纯数据 | **TypeScript** 对象字面量 |
| 引擎改动 | 需加 JSON→blueprint 加载器（Lead 下沉） | 无需改引擎 |
| LLM 难度 | 低（弱 LLM 也能填） | 中（prompt 要防幽灵代码） |
| 验证 | JSON Schema | tsc --noEmit |
| 推荐路径 | Y（外部）长期目标 | X（内部）先跑通 |

**当前建议**：先 B（内部跑通），后续有外部用户需求再下沉 A。

---

## 五、API Key 配置方案

```json
// .apollo-config.json  (gitignored)
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-opus-4-8",
  "maxRetries": 3
}
```

或直接读环境变量 `ANTHROPIC_API_KEY`（CI / RK3562 部署用）。

---

## 六、VS Code 集成规划

最终 F5 下拉菜单：

| 配置 | 作用 |
|---|---|
| `Create Game (AI)` | 交互式：填 brief → LLM 生成 → validate → 可选 ship |
| `Build Cartridge (menu)` | ✓ 已有 |
| `Preview Cartridge` | ✓ 已有 |
| `Build + Preview: game-f` | ✓ 已有 |

---

## 七、实施顺序（推荐）

1. **Brief 模板固化** — 统一 `docs/game-design/brief-template.md`（小，1h）
2. **Schema 提取脚本** — 从 `protocol/components/` 自动生成 prompt 用的 schema context（小，2h）
3. **`validate_game.py`** — 单游戏 tsc + vitest 封装，为重试循环做准备（小，1h）
4. **`create_game.py` MVP** — 读 brief + schema → 调 Claude API → 写 blueprint → validate（中，1天）
5. **重试循环** — 失败时把 tsc/vitest 错误反馈给 LLM，最多 N 次（小，2h）
6. **方案 A JSON 加载器** — 引擎侧，Lead 评审后下沉（视需求）

---

*本文档随实施推进持续更新。*
