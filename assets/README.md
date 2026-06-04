# `assets/` — 原始资产存储（Raw Asset Store）

> **这是「内容」，不是「代码」。** 资产系统代码在 `src/assets/`，别混淆。

最底层、按类型分、**纯叶子、无逻辑**的资产存储。游戏里用到的每一份美术/音频/模型，
都在这里有一条索引，逻辑层**只引用稳定 id、永不引用二进制文件**。

## 结构

```
assets/
├── index.json     ← 唯一索引：游戏所有资产从这里索引（id → type / 描述 / 状态 / 路径）
├── texture/       ← 贴图（png/jpg/svg…）
├── mesh/          ← 网格模型
├── material/      ← 材质
├── sound/         ← 音频（bgm/sfx/voice）
├── animation/     ← 动画数据
└── video/         ← 视频
```

类型集合可扩展，但保持「按类型分的叶子目录」这一约定。

## 索引条目（`index.json`）

| 字段 | 说明 |
|---|---|
| `id` | 稳定 id（如 `bg.office`、`char_S.portrait.neutral`）。**逻辑只认它**。 |
| `type` | `texture｜mesh｜material｜sound｜animation｜video` |
| `description` | 给人看 + 将来作生成 prompt 种子 |
| `status` | `tbf`（待填充）/ `filled`（已填） |
| `path` | 相对 `assets/` 的文件路径；**仅 `filled` 时存在** |
| `spec` | 可选目标规格（宽高/透明/格式/loop…） |

## To-Be-Filled（TBF）约定

- 需要一份资产 → **先在 `index.json` 声明一条 `status:"tbf"` 的条目**（给 id + 描述 + 规格），**先别管文件**。
- 游戏蓝图里用 `id` 引用（如 `Sprite{ textureKey: "bg.office" }`）。
- 资产没填时游戏**照样能跑**（渲染层退化为占位）。
- 真资产就绪 → 文件丢进对应 `assets/<type>/`，把条目改成 `status:"filled"` + `path`。**同一个 id,游戏代码一行不改。**

完整流程见 `docs/workflow/asset-flow.md`。驱动 TBF 的「填充工具 / 预览器」是外部框架,后续接入。

> 确定性：资产是表现层,逻辑只持有字符串 id,像素/音频**不进模拟哈希** → 填充/替换不破坏 lockstep 与录放。
