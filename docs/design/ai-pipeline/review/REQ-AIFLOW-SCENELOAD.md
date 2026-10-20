# Review：REQ-AIFLOW-SCENELOAD · R4 场景资源组

施工锁`a42528474`（2026-10-20先单独推送后施工）。施工方交测试与撤修自证，正式结论由独立复查追加；不自判PASS，不签人门。E1独立通过`148d13ebc`。

## 做了什么

接受既定R4：实查AssetManager只有单key/all加载，既有ModelPool没有逐key驱逐；单靠旧loadAll不能分段或释放解码模板。按owner路线图§3.5的判A扩写资产层，不新增游戏脚本或sim system。

本地AssetIndex可声明纯数据groups/initialGroup，通用宿主只预载所选组；旧索引保留loadAll。组内key去重、跨组引用计数，旧load/loadAll用常驻pin兼容。进度含成功/失败数量与错误，支持重试、取消、卸载与订阅。每请求identity阻止晚到结果污染新世代。ModelPool按key释放实例、模板和GPU资源，保留其它组共享资源。

`createAssetGroupDataSource`把进度接到现有LayoutNode资源/flag绑定，同时转发世界数据源的resource/value/flag/list；只读表现层，不改UI基座、world或快照hash。

## 改动面

- `src/assets/asset-types.ts`、`asset-groups.ts`、`asset-manager.ts`：纯数据组、进度/驱逐事件、optional loader.release、引用计数及请求identity。
- `src/assets/asset-index.ts`、`game-art-load.ts`、`index.ts`：索引元数据解析/登记、初始组选择、取消后不登记及出口。
- `src/assets/asset-group-source.ts`：现有UI数据源结构适配。
- `src/services/manifest-game.ts`：消费同一装载器，卸载时取消索引并clear资产。
- `src/renderer/three/models.ts`：逐key解码资源释放与旧parse隔离。
- 新测试`src/assets/{asset-groups,asset-group-source,game-art-groups}.test.ts`、`src/renderer/three/model-groups.test.ts`。
- `scripts/scene-asset-groups.integration.mjs`：真实raw/Draco/KTX2跨组生命周期，开发根路径和build子路径。
- 契约`docs/design/ai-pipeline/scene-asset-groups.md`、资产手册本行、本Review及工单status。

## 怎么自己验

1. 定向10文件测试：`npx vitest run src/assets/asset-groups.test.ts src/assets/asset-group-source.test.ts src/assets/game-art-groups.test.ts src/assets/asset-manager.test.ts src/assets/asset-index.test.ts src/assets/game-art-load.test.ts src/renderer/three/models.test.ts src/renderer/three/model-groups.test.ts src/renderer/three/model-codecs.test.ts src/renderer/three/render-hygiene.test.ts`。138/138，exit0；其中新组测试61项。
2. 检查组配置原子校验、重复key、空组、失败等待全部结算及仅重试失败项；不同组共享key只一次I/O，释放最后一组才回收，旧load pin不被误删。取消立即拒facade但不破坏其它组；clear/取消后老成功或老失败不能覆盖新cache或删除新inflight。
3. 用真实World数据源与resolveBindings消费进度，确认ProgressBar/Label及loading/ready/failed显隐；原型方法依赖私有this的fallback仍完整转发。未知名字回原数据源。索引只选initialGroup，未选与无初始组资产I/O为0；旧无groups索引仍全载。
4. `RENDER_PROBE_CHROMIUM=<本机Chrome> node scripts/scene-asset-groups.integration.mjs`：真实离线GLB与本地decoder，不用付费API；开发/build子路径各两代加载。释放A时保留共享Draco和B的KTX2；最后释放后池实例4→3→0，跟踪几何/材质/纹理/clone材质均恰释放一次；renderer.memory几何/纹理归0；重新加载各key每代一次，最终worker/Blob归0。
5. 原`compressed-models.integration.mjs`完整真实回归exit0：三种压缩对raw像素差0，下载/解码中取消及失败清理仍成立。R4证据`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r4-real-a0ZAJ7/report.json`；E1回归`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e1-real-XzZWhL/report.json`。

## 撤修验红

隔离副本运行`/private/tmp/aiflow-r4-red.mjs`，五处各断言源码锚点恰1次；每轮finally恢复原字节，不动施工树、不改测试断言。以下均exit1且明确AssertionError：

| 撤修 | 命中测试 | 红灯输出 |
|---|---|---|
| 驱逐守卫去掉groupRefs条件 | `multiple groups share a key...` | `expected false to be true`（另一组共享key被提前驱逐） |
| 旧成功缓存写入去掉request identity | `late old success after the new generation is ready...` | `expected { descriptor: ... } to be { descriptor: ... }`（新代被覆盖） |
| UI成功数固定为0 | `real resolveBindings maps successful keys...` | `expected { value: +0, max: 2 } to match object { value: 1, max: 2 }` |
| initialGroup改回loadAll | `initialGroup fetches only its members...` | `expected ['title','house','unused'] to deeply equal ['title']` |
| 去掉逐key模板资源dispose | `subscribes lazily and evicts all A instances...` | `expected "dispose" to be called once, but got 0 times` |

原始输出`/private/tmp/aiflow-r4-{shared,identity,progress,initial,gpu}-red.log`；恢复后定向138项全绿。独立复查另做自己的锚点撤修和实证，不采信这些自陈作为判词。

## 已知局限 / 偏离

- 进度按成功key数量统计，非下载字节或GPU解码百分比；空组显示1/1而统计total仍0，不编造精细进度。
- 场景选择是显式组API，纯数据首屏用initialGroup；现有仓库无统一world State切场景协议，不猜测状态或自动切组。与R4预载/卸载/进度既定范围一致。
- 释放不强制中断底层loader网络；立即取消调用方等待，晚到资源通过可选release回收且不能复活缓存。loader需自己实现句柄析构，旧loader兼容；现有图像为HTMLImageElement、模型为ArrayBuffer，GPU由ModelPool独立管理。
- observer/析构异常明确console.error并隔离，未知组操作拒收日志；只读未知进度返回undefined，避免UI轮询刷屏。
- 真实解码用自产离线夹具，不冒称Tripo真实模型已验；未购买API按owner许可保留mock路线。本阶段不改任何游戏层、PUI或sim。

## 最终门禁

**除基线 depcruise 外全绿**。冻结源码全量6076/6077通过、0 pending/todo，唯一失败为指定game113围栏。各步实际退出码：

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint0；depcruise1，仅game113/guide-art.ts） |
| tsc / build | 0 / 0 |
| vitest全量 | 1（仅对应围栏基线1例） |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有允许WARN，无新增棘轮） |
| spritegen原生node:test | 0（5项，按原生runner保留全部断言） |
| R4定向 / R4真实Chrome / E1真实回归 | 0 / 0 / 0 |

本面无其它face guards。正式末行`❌ 门禁失败于 depcruise（退出码 1）`；余计划实际补跑末行`除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。日志`/private/tmp/aiflow-r4-scoped.log`、`/private/tmp/aiflow-r4-final-{complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,native}.log`与Vitest JSON；定向`/private/tmp/aiflow-r4-targeted.log`。

正式复查人另写判词，本施工方未签任何人门。
