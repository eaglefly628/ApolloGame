# REQ-3D-RENDER-BIND · 施工记录 / 复查导航

施工锁：ddfb85bfc（2026-10-26）。施工主体：Codex / P3D。owner 已裁 A；契约见 [render-bindings.md](../render-bindings.md)。本文件只报告施工实证，**不判独立复查 PASS**。交付提交见本文件Git历史；完整门禁由父代理执行，结果见末节。

## 交付面

- 协议 `components/render-binding.ts`：四目标、四来源、同体载体、范围、秒制缓动、严格 POD 拒收。render barrel、component-map/universe、NON_DETERMINISTIC 登记；无 sim system、hash 算法变化。
- 冻结组件基线 `scripts/component-manifest-baseline.json` 经现有 `component-manifest-guard.mjs --update` 正规更新；只新增 RenderBinding3D，count 162→163，其它元数据不变。
- `assembly/render-bindings.ts`、`scene-import.ts`、`validate-manifest.ts`：Engine.load、同步/异步 manifest 与模板展开同一原子准入；`validate-references.ts` 补 Resource/Flag/Signal 源引用诊断。
- `three/render-bindings.ts`：复用组件观察、只读投影、last publication 置位、绝对时间采样、配置/实体/World/restore 清理；观察器与 Recorder 并存。
- `three/hover.ts`：有效 hover 绑定才挂纯表现指针监听，复用 pick，取消/离开/失焦/隐藏/销毁与回档清理，不阻断触摸点击。
- `three-renderer.ts`：本帧灯/辉光/VFX/材质消费覆盖；绑定值/缓动进脏签名；不改变 pick 返回结构；无绑定读作者原值并继续静态跳渲。
- `three/model-dissolve.ts`、`three/dissolve.ts`：原 shader 作用于 GLB 每个子 mesh/材质槽的独立效果 clone，复用统一进度采样，variant program key 隔离；恢复原实例材质，只释放效果 clone。`three/material.ts` 保留 materialRef 的 inline dissolve/其它作者字段。
- 3D 手册与契约同步；没有改游戏数据、玩法、UI、sim 规则或核心相位。

## 完整文件清单（25项，含冻结基线）

- `docs/playbooks/3d.md`
- `scripts/component-manifest-baseline.json`
- `src/assembly/component-map.ts`
- `src/assembly/component-universe.gen.ts`
- `src/assembly/scene-import.ts`
- `src/assembly/validate-manifest.ts`
- `src/assembly/validate-references.ts`
- `src/engine/protocol/components/render.ts`
- `src/net/determinism.ts`
- `src/renderer/three-renderer.ts`
- `src/renderer/three/dissolve.ts`
- `src/renderer/three/material.ts`
- `docs/design/ai-pipeline/render-bindings.md`
- `docs/design/ai-pipeline/review/REQ-3D-RENDER-BIND.md`
- `scripts/fixtures/render-bindings/browser-probe.mjs`
- `scripts/verify-render-bindings-browser.mjs`
- `src/assembly/render-bindings.test.ts`
- `src/assembly/render-bindings.ts`
- `src/engine/protocol/components/render-binding.ts`
- `src/renderer/three/hover.test.ts`
- `src/renderer/three/hover.ts`
- `src/renderer/three/model-dissolve.test.ts`
- `src/renderer/three/model-dissolve.ts`
- `src/renderer/three/render-bindings.test.ts`
- `src/renderer/three/render-bindings.ts`

## CPU / 静态检查

定向命令：

```sh
TMPDIR=/private/tmp ./node_modules/.bin/vitest run src/renderer/three/render-bindings.test.ts src/renderer/three/model-dissolve.test.ts src/renderer/three/hover.test.ts src/assembly/render-bindings.test.ts src/renderer/three/dissolve.test.ts src/renderer/three/material.test.ts src/renderer/three/environment-lifecycle.test.ts src/assembly/validate-references.test.ts src/net/determinism.test.ts src/assembly/camera-shots.test.ts src/renderer/three/camera-shots.test.ts scripts/build-component-map.test.mjs
./node_modules/.bin/tsc --noEmit
node scripts/build-component-map.mjs --check
git diff --check
```

最终合并定向结果：12文件140/140通过（新增能力四文件39项，其余为原有材质/环境/镜头/引用/确定性及字典生成守卫）。类型检查、修改文件 ESLint 与 diff 检查退出0。完整日志：`/private/tmp/apollo-render-bindings-cpu-20261026.log`。

### 首次整库门禁与基线补齐

父代理首次完整 scoped-gate 实跑退出1：687文件中7477项通过、唯一失败为 `scripts/component-manifest-guard.test.mjs`。原因是施工遗漏共同零件冻结基线更新，新增 RenderBinding3D 已进入协议/字典但未进入 `component-manifest-baseline.json`。完整失败日志由父代理保存在持久证据目录 `render-bindings-20261026/scoped-gate-full.log`。

补救沿守卫原有 `--update` 入口，不修改守卫断言；更新后再以程序核对 added 严格等于 `[RenderBinding3D]`、removed 为空、count 仅加1、其它元数据恒等。补齐后联合复跑该守卫5项与原定向140项，13文件145/145通过、退出0；日志 `/private/tmp/apollo-render-bindings-cpu-after-baseline-20261026.log`。父代理仍须重新完整跑门禁，本记录不把首次失败算作全绿。

覆盖：有限/闭集/POD/原子拒收；四输出/反向范围/三曲线/重定向/大跳时/倒退时钟；缺源日志与恢复/创建序语义id；初始信号不播/同实体多发布/追赶期间发布即销毁/真实Timeline快进/144Hz重复render；配置等值保持与变化失效/删除重建/换World/restore；1200次不同绘制时刻持续核snapshot、full+incremental hash、writeSequence、dirty；无绑定原World恒等；GLB多子mesh/多材质槽/共享纹理与独立释放；hover各生命周期与无opt-in无监听。

## 真实 Chrome WebGL

`TMPDIR=/private/tmp node scripts/verify-render-bindings-browser.mjs` 已以真实本机 Chrome 执行，退出0，无warning/error/pageerror。结果：

- 报告 `/private/tmp/apollo-render-bindings-browser-u4CUis/report.json`；同目录 `initial.png`、`reversed.png`、`glow.png`、`bindings.png` 已目击。
- 原生 GLTFExporter 生成4024字节测试GLB，再由实际 ModelPool/GLTFLoader 解析两实例；实际GPU `uDisProgress` 分别0.15000000596046448/0.8500000238418579；信号翻转实际变化26469像素。
- 独立Glow状态变化实际变化7240像素（当时VFX未发射、模型终态0、灯参数未变，不靠其它live标记掩护脏帧）。VFX随后单独由Signal置位并实际发射。
- hover/cancel/restore、既有pick返回、无绑定回作者值与静态跳渲通过；26次sync逐次验证快照、hash、writeSequence、dirty恒等。
- 14份效果材质各dispose一次；删除一个实例时共享纹理dispose为0。关闭后组件监听为空、canvas=0；28个观察到的原生GPU handle均不可用。
- **共享资源口径**：Three.Sprite 使用模块级共享quad。最后context loss前info.memory.geometries有既有共享quad统计1、textures=0；不能逐Sprite销毁该全局对象。探针明确校验关闭context后实际handle清零，没有把统计1偷偷报成0，也未扩大修改Three全局几何所有权。

探针图元仅是能力测试夹具，不作为任何游戏的主角资产或真实美术生产证据。

## 唯一锚点撤修（施工自证）

证据：`/private/tmp/apollo-render-bindings-sabotage-20261026/report.json`，含每项red/restored日志；两个锚点均先断言命中恰好1次，执行后原文件逐字恢复。

| 锚点 | 临时撤修 | 实跑结果 |
|---|---|---|
| `render-bindings.ts` 的 `channel.value = sample();` | 改为直接取goal，绕过绝对时间缓动 | `samples bounded ratios` 原绿→退出1（采样断言红）→恢复退出0 |
| `model-dissolve.ts` 的 `const copy = material.clone(); injectDissolve` | 改为直接复用原材质 | `isolates every submesh` 原绿→退出1（独立材质断言红）→恢复退出0 |

### 精确撤修、红断言与恢复SHA

两处已针对最终源文件再次复跑基线→撤修→恢复，每次退出码均为0→1→0；不是仅引用早先绿灯。

- 文件 `src/renderer/three/render-bindings.ts`；原串（保留前导空格）：

```ts
      channel.value = sample();
```

  替换串：

```ts
      channel.value = goal;
```

  命中1次。红断言 `expect(value(controller, world, 200)).toBe(5);`（`src/renderer/three/render-bindings.test.ts:34:43`）；原文 `AssertionError: expected 20 to be 5 // Object.is equality`。恢复后SHA-256：`a0ce90b9e27228b01401fcc277a22a8be935d2b65d362c2d96f2df868bcb7c7d`，与撤修前逐字节相同。

- 文件 `src/renderer/three/model-dissolve.ts`；原串（保留前导空格）：

```ts
            const copy = material.clone(); injectDissolve
```

  替换串：

```ts
            const copy = material; injectDissolve
```

  命中1次。红断言 `expect(new Set(all).size).toBe(6);`（`src/renderer/three/model-dissolve.test.ts:19:93`）；原文 `AssertionError: expected 1 to be 6 // Object.is equality`。恢复后SHA-256：`7589727be3509b18048af4dcf091d33a6327e83f71b58569f0e7cfa34a0237d9`，与撤修前逐字节相同。

## 复查门

复查人须独立运行CPU/GPU/撤修与整库门禁，核日志中的警告与上述共享quad口径。施工自证、报告路径和截图均是导航，不能代替独立复跑。父代理负责game628裁决文档/池status与最终提交推送；此记录不改owner人门或其它生产里程碑。

## 最终完整门禁（2026-10-26）

实际运行 `node scripts/scoped-gate.mjs --run`，总exit0，末行 `✅ 门禁全绿（scope=full）`。687个测试文件、7478项测试全部通过。eslint、depcruise、sim-dom-fence、tsc、vitest:full、build、docs-ref、context-budget均0；art-ledger-guard为允许的既有WARN（退出2，黑户5/死账2/缺来源0）。唯一topological-sort仍为既有[L,P]负例；原始WARN/reject和大chunk提示已留档，未改守卫放行。首次漏更新冻结清单的唯一红完整保留；正规更新仅增加RenderBinding3D后重跑全量。证据根：`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/render-bindings-20261026`。

GAP-628-04仍待非施工方独立复查，不将施工自证当PASS或签人门。
