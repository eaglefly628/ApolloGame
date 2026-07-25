# game102 · 消除特效 spec：真3D 物理碎片 + 平台落地（GD 出 2026-07-24 · owner 拍板 B·真3D）

> owner 2026-07-24：「像素被打掉→**真3D 粒子碎片掉落**；下面有个**平台**，碎片**真物理**落到平台上，像雕刻碎片落地。」
> 结论：**现有 P3D 能力可直接拼·非缺口**（cannon-es 物理已在 game-d 掷骰 / game-c 筹码用）。归 **P3D 域**·走 `requests-3d.md`·GD 出 spec、P3D 施工、Lead 裁架构。
> 3D 手册=`docs/playbooks/3d.md`；本 spec 只定「要什么观感 + 用哪些现成件 + 待裁架构」，字段以 registry/`render.ts` 机读为准。

> **承 core-experience-v2 §1.5（owner 2026-07-24）**：中央核心 = **3D 像素方块结构·持续旋转**（非静止 2D 图）——本效果的"被打碎的像素"即该 3D 核心的外沿 voxel。这使**全 3D 盒庭（本文件 §2 方案 B）成为自洽首选**：旋转 3D 核心 + 360° 环轨 + 绕行炮 + 剥离碎片落平台，全在同一 3D 空间。

## 0. 一句话观感

每消除一个像素 → 该像素**炸成几块同色小方块**，带初速迸溅、空中翻滚、**真物理落到下方平台上弹跳/堆叠**，短暂停留后隐去（下沉/淡出）。质感=**雕刻/石屑**（非塑料），有重量感与打击感。

## 1. 用现成件怎么拼（P3D 施工·全 render-only）

| 元素 | 现成件（3d.md 实名）| 参数意图 |
|---|---|---|
| **碎片体** | `Mesh3D{shape:'box'}`（小·像素同色）+ `Transform3D` | 每像素炸 3-5 块·尺寸随机小块 |
| **雕刻质感** | `Material3D{shading:'toon'\|'flat', surface:{pattern:'bumps'\|'scratches'}}`（+可 outline 卡通描边）| 石屑/雕刻感·非塑料光 |
| **真物理** | `RigidBody3D{shape:'box',mass,restitution~0.25,vx/avx}`（cannon-es·懒加载·写回 Transform3D）| 落地弹跳/翻滚/堆叠·game-d `throw3d.ts` 同套 |
| **迸溅初速** | `Impulse3D{trigger,x/y/z,torque,mode}`（或初速 vx/avx）| 消除瞬间向外上方迸 + 旋转 |
| **落地 squash** | `Anim3D` channel `scaleY/scaleX`（spring）| 触地挤压回弹·增重量感（可选） |
| **平台/地面** | `Mesh3D{shape:'box'\|'plane'}` + 静态 `RigidBody3D{shape:'box'\|'heightfield',mass:0}` | 接碎片·「无 Mesh3D 的 RigidBody3D=隐形墙」也可当挡板 |
| **平台质感** | `Material3D`（石板/工坊台面·PBR 或 toon）| 「雕刻工坊」主题落点 |
| **舞台光/后处理** | `Light3D`（暖主+冷补）+ `Post3D{ao,bloom,vignette}`（收） | 立体感与聚焦·反捷径律：先造型后特效 |
| **打击反馈** | `Camera3D.shake{trigger,...}` | 消除/连击震屏（bump trigger）|

## 2. 关键架构决策（**请 Lead + P3D 裁**）

碎片是真3D，但棋盘/传送带/色炮当前是 2D render 层——**3D 碎片与 2D 棋盘怎么合成？** 两条：

- **A · 2D 棋盘 + 3D 叠层**：棋盘保持 2D，其上/其后叠一个 3D 物理层（正交相机对齐像素格坐标·`screenToWorld` 定位碎片生成点），平台在 3D 层。**改动小**，但 2D/3D 两套渲染合成需 P3D 确认对齐与层序（game-g 屏已叠 Vfx3D 先例）。
- **B · 全 3D 盒庭棋盘（GD 倾向·签名差异化）**：把棋盘本身做成 3D——每像素=一薄 `Mesh3D` 瓦片立在 3D 舞台上，消除即原地炸成 `RigidBody3D` 碎片落到下方平台。**物理最自洽**（同一 3D 空间），且把本作升级成「**3D 盒庭休闲解谜**」，充分吃我们 P3D 线做视觉护城河。代价：棋盘渲染从 2D 迁 3D（PE 蓝图改动大·相机/光照/性能都要 P3D 主理）。

> **GD 建议**：owner 既然要真3D 物理 + 平台雕刻感，**倾向 B（全3D盒庭）**——碎片落平台在同一空间才真自洽，也让 3D 成为本作卖点；若要快、想省，退 A。**最终由 Lead/P3D 裁**（涉及棋盘渲染归属与性能）。

## 3. 性能预算（P3D 主理·必列）

- 一关像素数百·每消一像素炸数块 → 峰值刚体数会飙。**必须**：并发刚体上限（建议 ≤120 活跃·可配）、**碎片落定/超时即 despawn**（sleep 后 ~1.5-2.5s 下沉淡出回收）、对象池复用、`dprCap`/阴影/AO 按 game-z「画质档」可降。
- 连锁炮/激光大范围消除瞬间碎片洪峰 → 需生成节流（合批/上限截断·超出用轻量 Vfx3D 粒子替代真刚体）。

## 4. 确定性 / 边界（红线）

- **RigidBody3D/Impulse3D/Vfx3D = render-only**（3d.md 铁律）：**不进 sim/hash·不被 Condition 读·不为联机同步**。→ 3D 物理碎片**不影响玩法确定性/回放/验收剧本/balance-sim/lockstep**（碎片是纯表现·消除结算仍在 2D sim 判定）。
- **域**：3D 渲染线（`three-renderer`/`three/**`）+ 施工 = **P3D 独占**；GD 只出本 spec，PE 不碰 3D 线。跨域走 `requests-3d.md`。
- **反捷径工艺律**：先碎片造型/材质→再光照→最后 bloom/AO；禁给素坯糊辉光冒充质感。

## 5. 交接

- 工单：`docs/workflow/requests-3d.md` **REQ-3D-G102-DEBRIS**（派 P3D·Lead 裁 §2 架构 A/B）。
- 验收：视觉里程碑走 `docs/playbooks/visual-scorecard.md`（8 维·真浏览器截图目击碎片落台弹跳堆叠）。
- 关联：本效果是「消除」的表现层升级；玩法/数据仍以 `gdd.md`/`capability-plan.md` 为准（sim 不变）。
