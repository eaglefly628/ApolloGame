# Review 单 · `REQ-3D-RB-MATERIAL` 刚体逐体弹性 / 摩擦接线

| | |
|---|---|
| 工单 | `docs/workflow/requests-3d.md` · REQ-3D-RB-MATERIAL（owner 2026-10-22 判 **A 接线**） |
| 施工 | Claude（本会话·锁见同日 `chore(lock)` 提交）。复查人须另派，不得是本会话 |
| 改动面 | `src/renderer/three/physics.ts`（+48）· `src/renderer/three/physics.test.ts`（+5 例 2 组）· `src/engine/protocol/components/render.ts`（两行注释改为真实语义）· `games/game211/design/HANDOFF-duel-physics.md`（「死旋钮」标注改为已接线，历史原文保留） |
| 确定性 | 物理整体 render-only，`RigidBody3D` 已在 `NON_DETERMINISTIC`，无新组件、不进 hash |

## 一、做了什么

1. **所有刚体与地面平面都挂 cannon 材质**。未声明 `restitution`/`friction` 的刚体与地面共用 `worldMaterial`；声明了的按数值对 `(restitution, friction)` 缓存一个材质（同值共用）。
   - 关键实查：cannon-es 只有在**碰撞双方都有材质**时才查材质对，否则一律用 `defaultContactMaterial`（`node_modules/cannon-es/dist/cannon-es.js` narrowphase 约 10562–10595 行）。所以只给刚体挂材质、不给地面挂，最常见的「刚体碰地面」仍然无效——这就是必须连地面一起挂的原因。
2. **材质对懒注册**：某种声明材质第一次出现时，与已知的每种材质（含 world、含自身）各注册一次 `ContactMaterial`。`world × world` **永不注册**，仍落 `defaultContactMaterial`。
3. **组合规则**：
   - 一侧为世界材质（地面、未声明体）→ **直接用声明方的值**（填了就生效，可以比世界值更「死」，例如 game211 的牌 0.34 < 世界 0.4）；
   - 两个声明体相碰 → Box2D 惯例：摩擦 `√(fa·fb)`，弹性 `max(ra, rb)`；
   - 只填一项 → 另一项取世界值（`PhysicsWorld3D` 或缺省 0.4 / 0.35）。
4. **拒收**：非有限、负数、弹性 > 1 → `console.warn('[physics] reject: …')`，回落世界材质。
5. 材质的 `friction/restitution` 保持 cannon 缺省 -1，避免触发 cannon 的「乘积覆盖」旧路径，只经 `ContactMaterial` 生效。

## 二、请逐条核（施工方自陈，复查方须自己复跑）

| # | 核什么 | 怎么验 | 施工方结果 |
|---|---|---|---|
| 1 | 未声明场景逐位不变 | `npx vitest run src/renderer/three/physics.test.ts -t "金标准轨迹"`：3 个刚体（盒/球/圆柱，带初速与角速度）180 帧，45/90/135/180 帧的位置+四元数与**改动前代码**录制的数值 `toEqual` | 通过；另在改动前后各录一次 JSON，`cmp` 字节一致 |
| 2 | restitution 生效 | `-t "restitution 真接线"`：0.95 首弹峰值 > 不填 + 1；0 < 不填 | 通过 |
| 3 | friction 生效 | `-t "friction 真接线"`：初速 12 的盒，摩擦 0 比摩擦 2 多滑 > 3 | 通过 |
| 4 | 非法值拒收 | `-t "非法值"`：四种非法值轨迹与未声明逐值相等，各告警一次 | 通过 |
| 5 | 材质缓存与配对数 | `-t "同值刚体共用"`：两种声明值 → 接触材质恰 5 个 | 通过 |
| 6 | 组合规则 | `-t "声明体×声明体"`：√(0.9·0.1)、max(0.2,0.7)；对世界直用声明值 | 通过 |

## 三、撤修验红（施工方已跑·请复查方另选锚点）

| 撤法（锚点唯一命中） | 结果 |
|---|---|
| S1 `body.material = this.materialFor(id, rb);` → 恒挂 `worldMaterial` | 5 例红（#2–#6） |
| S2 `const vsWorld = ka === 'world' ? b : …` → 恒为 null（对世界也走组合） | 2 例红（#2 弹性 0 与不填相等·#6 组合规则） |

施工中途由测试抓到的设计问题已改：最初「对世界也取 max」会让声明值永远不能比世界值更「死」（game211 牌的 0.34 等于失效），改为对世界直用声明值。

## 四、请重点判

- **game211 现有调参会变**：`duel-spike.ts` 牌上 `restitution: 0.34, friction: 0.45` 从死值变成生效值（世界为 0.22 / 0.5）。按 2026-08-10 的 8000 张对照实测，接上后正面率 50.63% vs 50.50%、未躺平 0.95% vs 0.92%（p≈0.19 不显著）——预期手感基本不变，但 game211 侧应再跑一次 `node scripts/game211-throw-lab.mjs` 确认。
- 组合规则选了「对世界直用声明值 + 声明体之间 Box2D」。若希望「对世界也按平均 / 乘积」，改一处 `pairMaterials`。

## 五、门禁

见提交说明（`node scripts/scoped-gate.mjs --run` 退出码）。
