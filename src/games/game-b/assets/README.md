# Game B 资产目录（占位阶段）

> 按用户指示：资产**暂时先放在这个目录下**。完整资产流程（provider / 规范化 / 管理器）
> **待 Lead + Gemini review `docs/design/asset-manifest-and-manager.md` 后落地**。

## 现状

- `asset-manifest.json` —— Game B 的 **TBF（待填充）资产清单**草稿，全部 `status: placeholder`。
  这是 `docs/design/asset-manifest-and-manager.md` 里数据结构的一个具体实例，先把"这个游戏需要哪些资产"显式列出来。
- 真二进制资产（背景图 / 立绘 / BGM）尚未填充 —— v0.1 demo 用 React 演出层的**占位色块**代替（见 `../ui/VNStage.tsx`）。

## 落地后（review 通过）

- 清单将**从蓝图自动派生**（引用即注册槽位），不再手工维护。
- 资产管理器读此清单，提供四条填充路径：一键生成 / 从库选 / 手动上传 / 程序化占位。
- 填好的资产经 `src/assets/`（Lead 已建的 `AssetManager` + `ImageAssetLoader`，即 R1）加载，渲染器显图。
