# Session 交接 / 项目现状（2026-06-12）
> 纲领：`data-driven-manifesto.md`｜规范：`CLAUDE.md`｜需求池：`requests.md`
> **分工**：主程只动引擎+文档；游戏层任务走 `docs/workflow/programmer/inbox.md` 派 PE；PE 不得直改引擎。

---

## 0. 最新交接摘要（2026-06-12，PE-F session）

**🔴 高分屏点击回归（`1fce0e0` 已修）**：`c105b92` 改 canvas 缓冲=逻辑×dpr，但 PointerInputSource 仍按 canvas.width(=缓冲)算坐标 → 落点偏 dpr 倍全空。修：onPointer 先 ÷dpr 还原逻辑坐标。⚠️ headless dpr=1 测试**不保真**——改任何 canvas 尺寸/坐标须真高分屏手验或传 dpr≠1 测试。

**🟡 REQ-F-061 选阵营（`d3dd065` 地基已推）**：`buildGameFBlueprint({playerFaction:'shu'|'wei'})` 纯数据。**待接**：`src/game-f.tsx` 加开局选阵营菜单 → 选定后再 start。

**🟢 本周引擎交付**：倒排索引(World.query 性能)；validate-references(P0 链接器)；REQ-F-049~055（部署门/占位/group-count 席板/点拖互斥/card-pile 刷新/t2-tray 托盘）；详见 `requests.md`。

**给主程复核**：① F-053 up/drag 互斥改了输入域形态（lockstep 安全，但值得过目）；② deploy 移入战拍偏离 flow-spec §3.3（策划 PF 尚未复核）。

---

## 1. 架构一句话

```
Manifest(纯数据) ──parseManifest──▶ WorldBlueprint ──engine.load──▶ World ──tick──▶ 确定性状态
```

- **引擎** `src/engine/`：ECS World（snapshot/hash）；SystemPhase 拓扑排序
- **能力库** `src/skills/`：Tier1（运动/动画/hierarchy-cascade）/ Tier2（物理/逻辑链/ARPG/tilemap/hex/gauge）/ Tier3（dialogue/match3/prefab/caster/aggro/poker-hand/card-scoring/flow/card-pile）
- **桥接** `src/assembly/`：capability-registry + parseManifest/exportManifest + schema 校验 + validate-references
- **Studio** `src/studio/`：数据透视器、资源库（art:<query>）、ApolloBench
- **启动器** `apollo.py`：Vite+API+多 LLM；`bench` 命令

## 2. 五个游戏

| 游戏 | 一句话 |
|---|---|
| **A** 协作平台 | 双人卷轴；zone-occupancy+event-when+effect-apply |
| **B** 乙游 VN | dialogue；7 属性+掷骰；多结局 |
| **C** 缝纫物语 | match3+craft-recipe+换装 |
| **D** 暗黑 ARPG | aggro+caster+tilemap；WASD 可玩 |
| **E** 小丑牌 | poker-hand→card-scoring；150 小丑；webp 美术 |
| **F** 自走棋 | 六角+hex A*+回合 flow；MVP-1 商店待接；选阵营菜单待接 |

## 3. TODO

| 条目 | 内容 | 优先 |
|---|---|---|
| **R9** | TBF 资产"诊所"工具 | P2 |
| REQ-C-005/006/007 | match3 扩展/健壮/特效 | P1/P2 |
| REQ-023 | group-effect（不 greenlit，先重组） | P3 |
| PE-E | flow/card-pile 重写回合 + ScoreTrace | PE-E |
| PE-F | 选阵营菜单(game-f.tsx)；8将扩充（待用户给经济设计）；羁绊 | PE-F |

**🔵 Studio follow-up**：结构编辑；playwright 真截图；⭐ NL→意图层（`ai-data-editor.md`）；Controllable schema

## 4. 技术债

- 🔴 无真浏览器帧验证；🟠 跨端浮点未验；🟠 多 session：push 前 fetch→rebase

## 5. 关键文件

- 宪法 `docs/design/data-driven-manifesto.md`｜需求 `requests.md`｜知识库 `wiki/skills/`
- 代码 `src/{engine,skills,assembly,studio,bench,games}`｜`apollo.py`
- 参考 `docs/ref/verified-fixes.md`
