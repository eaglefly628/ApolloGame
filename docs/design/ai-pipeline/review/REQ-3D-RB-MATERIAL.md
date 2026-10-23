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


## 独立复查判词（Codex · 2026-10-23）

**PASS，结案出池。** 施工 Claude；本复查未参与施工，未修产品、未签真人门。固定审查 `e5ef0095777474527b6159f1fcae6e17d20c7efa`，父版 `3f0fb3edb60e47860f59ab52a0a7c1a1131ad7f5`；当前主干对应实现未变。fixed / parent / mutation 三个临时 clone 独立运行，最后均 clean。

### 独立复跑与实证

- `npx vitest run src/renderer/three/physics.test.ts games/game211/duel-spike.test.ts games/game211/duel-scheduler.test.ts`：3 文件 76 测试，exit 0（准确路径以证据 `targeted-fixed.log` 为准）。材质接线、声明缺省、非法值整份拒收、缓存释放、NON_DETERMINISTIC / hash 不变均实际核验；额外边界脚本 9 断言 exit 0。
- 独立在父版和新版真实录制盒、球、柱 180 帧，共 540 位姿样本。61,097 字节 JSON `cmp` exit 0，SHA256 `4748cf959621a71d59073866ad2d1944333a3486b6b7135809f095aa9d0097a6`。12 检查点的 1,459 字节父版 / 新版 / 测试 golden 原串也相同，SHA256 `90c3a41d224b33adac776dd98b750f463181b5aa1928acfcef537c754603f51a`。未声明场景逐位兼容成立。
- `collision-behavior.ts` 通过真实 PhysicsSystem 跑两组各 180 帧：声明体之间逐帧等于 `sqrt(fa*fb)` / `max(ra,rb)` 的参考；声明体×未声明体逐帧等于直用声明值的参考（世界故意设为 .9/1）；3 断言 exit 0。高 / 低弹配对反弹峰为 8.667706482839563 / 3.2012509419796666。
- 组合规则合理：声明体之间采用常见的几何平均摩擦 / 最大恢复系数；可对照 [Box2D 官方混合规则](https://box2d.org/documentation/md_simulation.html)。声明体对世界直用声明值则是本项目的兼容政策，保障声明旋钮有明确效果；未声明体之间继续走旧世界值。不是宣称真实材料都遵守这一模型。
- 实跑 `node scripts/game211-throw-lab.mjs`，exit 0：8000 张正面 4009（50.11%，95% CI 49.02–51.21%，p=.8493），未躺平 70（.88%），真空中接触 3976/4000（99.40%）。与 2026-08-10 的 50.50%（CI49.40–51.60%）、未躺平 .92% 对照处于相近统计范围，区间重叠；不等于形式等效性证明。

**实验适用范围**：throw-lab 只 import cannon-es 自建世界，不调用本次 PhysicsSystem；其 `--per-body` 也没给地面 / 围栏挂世界材质。因此历史台不覆盖新声明体×world 接线，“引擎现状”注释已陈旧；本次不声称真实 game211 新桥 8000 张或浏览器手感验收已完成。上面的真实桥 180 帧对照补证的是组合接线本身。

### 独立撤修验红（不同于施工方 S1/S2）

先对原串 `count == 1` 断言，再只在 mutation clone 撤修；每次恢复固定 Git blob 并核 SHA。

| 锚点 / 撤法 | 真红输出 | 恢复 |
|---|---|---|
| `    ground.material = this.worldMaterial;` → `ground.material = null;`（hit=1） | 2 个真实反弹 / 滑行断言红，exit 1：`3.8535410234063616 > 4.853541023406361` 不成立；`.015076217261818825 > 3.015076217261819` 不成立 | 撤前 / 撤后 / 恢复 = 0/1/0，2 绿 |
| `    if (!ok(restitution, 1) || !ok(friction, Infinity)) {` → 守卫加 `false &&`（hit=1） | 非法材质回落的真实轨迹断言红，exit 1：`.9999894333587563 !== .9964859343720249` | 0/1/0，1 绿 |

恢复源码 SHA256 均为 `2ca75783732063802af214fc761116a2b988ef8b87e6d0ba2f18c97f6d3bd097`，mutation 工作树 clean。证据有锚点计数、命令和原文，非编译错误 / 缺浏览器冒充红。

### 全量门禁与告警

实际宿主执行 `node scripts/scoped-gate.mjs --base e5ef0095^ --run`，总 exit **0**；671 文件 / 7232 测试通过，慢车道另 3 目标 / 7 测试通过。eslint、depcruise、sim-dom-fence、slow-lane、tsc、vitest:full、build、docs-ref、context-budget 各 **0**；art-ledger-guard **2**（脚本允许的既有 WARN），末行 `✅ 门禁全绿（scope=full）`。

首轮沙箱 exit 1 的 5 例为 listen EPERM / NO_BROWSER，原日志保留；获宿主权限后用真实已安装 Chrome 完整重跑通过，没有清除 sandbox 环境变量。仅为隔离依赖缓存合并原 vite 配置改 cacheDir，测试包含 / 排除与门禁步骤未改；最初被 Vitest2 拒绝的 `--cache.dir` 试跑也保留，未作为有效测试。

已读 224 stderr 块、179 去重主消息：唯一 topological-sort 为既有 `[L,P]` 测试 fixture，父版实际跑 12 测试重现相同原文。父版 host-transition 复跑重现 happy-dom localhost ECONNREFUSED；无新增物理意外告警。父版 art-ledger exit 2 与本版逐字一致：黑户5、死账2、缺来源0（game-a art-03 mock 图、game-c art-017-up 图缺失）。构建大于500kB分块 WARN 已读；未重建父版，不宣称父版 bundle 大小已实测。

### 非阻断观察与范围

`src/renderer/three/physics.ts:271`：有限且合法的 `friction=1e200` 在 `sqrt(a*b)` 中先乘溢出为 Infinity，边界脚本已实证。180 帧堆叠位姿仍有限，未复现常规参数故障；作为数值健壮性观察保留，建议后续用避免中间乘法溢出的几何平均，不在本次替施工方改。未配置的 Tripo / ARP / Mixamo：**真实链路未验**。

完整证据：`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/review-trio-split3d-20261023/rb-material/RECEIPT.txt`、`command-exits.json`、`mutation-receipt.json`、`trajectory-comparison.json`、`collision-behavior.log`、`scoped-gate-host.log`、`warnings-*.json`。证据根见本节末。

证据根（本机持久目录）：`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/review-trio-split3d-20261023`。
