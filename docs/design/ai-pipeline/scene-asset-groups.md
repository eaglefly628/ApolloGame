# R4 场景资源组契约

资源组是资产层纯数据`Record<groupId, readonly assetKey[]>`。groupId为1..64位字母起头的字母/数字/下划线/连字符；组内key按首见顺序去重，必须是已注册的物理资产描述符，命名animation须写其atlas key。配置校验后整体登记，无效配置不产生I/O。

```json
{"version":1,"assets":[],"groups":{"menu":["tex/title"],"yard":["mesh/house","tex/stone"]},"initialGroup":"menu"}
```

上例assets按原AssetIndex填完整条目（此处空数组只示字段布局，引用必须实际存在）。groups/initialGroup均可选；initialGroup需命中groups。registerAssetIndex先注册原描述符，再注册组；loadGameArtInto/通用manifest宿主在索引声明groups时只预载指定初始组，无初始组时只登记并明确提示。没有groups的旧索引继续loadAll。不会猜世界State或信号作为切场景协议。

AssetManager新增闭集API：registerGroups、preloadGroup(id)、releaseGroup(id)、groupProgress(id)、subscribeGroups(listener)、unload(key)、onEvict(listener)。预载同一活跃组幂等；不同组共享key只加载一次，释放最后一个组引用且无旧API常驻pin才evict。旧load/loadAll形成常驻pin，unload(key)显式清pin；若仍被组持有只解除pin不evict。分组内部加载不建立常驻pin，默认旧游戏驻留行为兼容。

进度快照`{group,status:"unloaded"|"loading"|"ready"|"failed",loaded,failed,total,errors:[{key,message}]}`：按成功key数量而非字节/模型解码进度计。load失败时所有当前组工作均结算后Promise以AggregateError拒绝，快照failed且保留错误；重试同failed组重新加载失败项，已成功项复用。空组ready并打印skip。releaseGroup立即取消当前等待Promise（AbortError），状态unloaded；底层请求可结束，但过期成功/失败不得复活缓存、删除同key新inflight或污染下一组世代。clear同样守请求identity，清注册及组，旧异步结果按可选loader.release回收。

组定义登记为增量；相同组同key列表可幂等重登，修改正在持有资源的组拒收，先释放再改。unload/clear及零引用释放时，onEvict通知解码消费者，ModelPool按key拆实例/模板并使旧parse失效；不取消另一个key。loader.release?(LoadedAsset)是可选同步资源回收口，旧loader兼容；observer/release异常打印错误并隔离，不阻断其它资源清理。

资产层`createAssetGroupDataSource(manager, fallback?)`按现有结构输出resource/flag并保留fallback的value/list：resource("asset-group:<id>")返回成功数/max；空组ready时UI规范化为1/1，统计total仍0。flag("asset-group:<id>:loading|ready|failed")用于显隐；未知名域回落原世界数据源。subscribeGroups可触发宿主重新resolveBindings，进度只在表现层，不写世界/快照hash。实际ProgressBar/Label通过既有resolveBindings验证，src/ui不修改。

这是资源组预载/卸载与UI数据源能力。场景选择由调用方显式选group；首版用索引initialGroup支撑纯数据首屏分段装载，不新增自由表达式、自动推断或字节级假进度。模拟loader覆盖无网络路径，真实浏览器另验ModelPool按组evict及下一代模型重新加载。
