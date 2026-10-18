# Review：REQ-3D-AI-PIPELINE · T7 Blender 作业桥

施工锁 `08dfb7264`（2026-10-18，先独立推送锁行再施工）。本单是3D总单首个阶段，**不是整张3D总单完成**。施工方提交自证，待独立复查，不自判PASS、不签生产人门。

## 做了什么

接受既定T7缺口：registry是运行时capability装配表，`t3-prefab`展开运行实体；`ModelAssetLoader`仅获取模型字节，均不能执行本地DCC作业。实查 registry 的 blender/bpy/rig-arp/build-scene/render-views 零命中，`scripts/blender-job.mjs`不存在；3D手册只有Model3D加载，资产标准§1.4记录“无导入/归一化”。owner已在路线图§1/§3判A并派Codex施工，无新A/B事项。

新增纯数据作业桥：五个闭集op，未知字段/自由代码入口拒收，输入快照与SHA同源、逐次日志/脚本/产物快照、哈希报告、显式mock隔离、缺程序/超时/失败/缺新产物明确拒收。真实执行build-scene、render-views：D1批准行关联显式三维制作数据，固定解释器生成可审bpy作业，保留四类E5节点；Three XYZ矩阵转换Y-up米制，导出恢复glTF约定。固定CPU渲染，移除Blender日期/耗时/EXIF元数据，完整保留PNG的IDAT与色彩/尺寸chunk。

T7先于T4/T5；normalize入口明确报T4执行器未就绪，rig-arp/retarget-arp区分插件缺失与T5未就绪，均真实非零退出且无假产物。实际规范化、绑骨、重定向仍按后续工单阶段交付，不用空成功占位。

## 改动面

- `scripts/blender-job.mjs`：schema、D1关联、输入/输出与证据边界、无shell子进程、mock及报告。
- `scripts/blender/worker.py`：固定Blender执行器、场景与视图解释器、PNG元数据规范化、未就绪操作拒收。
- `scripts/blender-job.test.mjs`：91项普通无网络/无Blender测试。
- `scripts/blender-job.integration.mjs`：可单独运行的真实Blender双跑验收，不在缺程序时静默跳过。
- `docs/design/ai-pipeline/blender-jobs.md`：机读数据契约、使用与证据说明。
- `docs/playbooks/3d.md`：同提交回填工具入口一行。
- 本Review及`docs/workflow/requests-3d.md`总单状态。未改游戏/渲染器/资产索引/UI/sim。

## 怎么自己验

1. `npx vitest run scripts/blender-job.test.mjs`：91项exit0。覆盖未知op及额外字段、D1的approved/route/完整消费、中文splitId、不得猜缺失三维数据、合法GLB/PNG、输入快照、逐次证据保留、显式mock不碰真实输出、缺程序/超时/子进程非0/旧产物不能冒成功、CLI stdout单JSON。
2. 独立复查早期实证出三处阻塞后已补物理目标预检与发布前重检，永久测试为：
   - `rejects ancestor-overlapping outputs before execution and preserves an existing front PNG`；
   - `rejects a symlink output into prior evidence and leaves its retained snapshot hash unchanged`；
   - `rejects distinct lexical outputs aliasing the same physical PNG instead of reporting two hashes`。
   三条均断言执行前拒收、fake未运行、旧文件/旧证据字节不变。复查方另有原8条对抗脚本，修后全部复跑转绿；正式判词由复查方追加。
3. 固定`BLENDER_BIN`为4.5.14 LTS后运行真实integration：exit0；双GLB SHA=`25e14e5495bb9ab0c6ccf2cd6aadec7738ef0582170b4d96f2aaac1f87842928`；双前视PNG SHA=`484533dcaa96f807a685258db3b3d8acbad22455854294fad7c526a8be809901`，双侧视PNG SHA=`9bef1e0c261aa787a20533ec121deca9e068bd4402d167f6562c47c21ded7afe`。校验四类节点、Y-up位移、地板实际尺寸、非零Three XYZ旋转；三个未就绪入口必须命中具名拒收原因，崩溃不算通过。日志`/private/tmp/aiflow-t7-real-final2.log`，证据`/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-blender-real-E61ZFJ/`。

## 撤修验红

隔离副本从最终源码撤修；每处锚点均断言恰好命中1次（祖先冲突需撤两处互补保护，各命中1次），每轮finally恢复原字节/SHA，主施工目录不受影响。

| 项 | 撤修方式 | 精确红灯 |
|---|---|---|
| op闭集 | 禁用唯一`if (!BLENDER_OPS.includes(job.op))` | `rejects an unknown op even when every other field satisfies the reserved-operation schema` exit1/AssertionError；其余字段全合法，不能靠别的守卫遮盖 |
| 证据保护 | 禁用唯一`if(nested(reserved,physical[i]))` | 证据alias具名测试exit1/AssertionError（预期拒绝而实际成功） |
| 物理别名 | 禁用唯一物理nested/重叠守卫 | 同物理PNG双别名具名测试exit1/AssertionError |
| 祖先冲突 | 禁用“祖先不是目录”及物理nested两处守卫 | 祖先输出冲突具名测试exit1/AssertionError，发生发布后文件路径错误 |
| child失败传播 | 禁用唯一`if(r.status!==0)` | `does not publish any partial outputs when child mode is fail` exit1/AssertionError，非0原因未传播 |
| PNG字节确定性 | 唯一`canonical_png(output)`改为pass | 真实integration exit1、精确命中`同render job两跑PNG必须同hash`，没有降低为只比像素 |

日志`/private/tmp/aiflow-t7-{op,evidence,alias,overlap,child-exit,png}-red.log`。全部红灯均为目标断言失败，无加载失败冒充。真实PNG初次验收也曾因此红，修后保留元数据前后IDAT一致的证据。

## 已知局限 / 偏离

- T7阶段只交桥及建场景/预览；T4规范化与T5绑骨/动作尚未交，3D总单继续开放。
- 真实夹具使用仓内基础cube作为模型输入，不是3个Tripo样本；没有冒称完成T4或真调Tripo。
- ARP插件当前缺失，已验拒收路径；实际授权插件安装后的检测与操作需T5真实核证。
- 固定版本/同环境保证字节复跑；不承诺跨Blender版本/操作系统逐字节相同。
- 图元仅box/plane/empty，必须来自D1 build判据及显式制作数据；不提供任意Python/自动图像推断/运行时热编辑。其余模型通过GLB输入。
- 发布前验证全体产物；不声称磁盘故障等跨多文件写入具有文件系统事务性。每次原字节快照保留，可审计恢复。

未签K2/D1/R1或任何真人门。正式独立复查结论另由复查方填写。


## 最终门禁（2026-10-18，稳定91项测试集）

**除基线 depcruise 外全绿**。全量5919/5920通过、0 pending/todo，唯一失败是指定game113围栏基线；确认最终全量报告包含T7全部91项。

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint0、depcruise1，仅game113/guide-art.ts相对导入） |
| tsc | 0 |
| vitest 全量 | 1（仅同一围栏基线1例） |
| build | 0 |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有允许WARN，game-a art03/game-c art017缺servedPath） |
| spritegen 原生 node:test | 0（5项，同前轮原生runner适配，不减少断言） |
| T7定向 / 真实Blender integration | 0 / 0（91项 / 双跑真实模型及图片） |

本面没有新增art-smoke/backupSmoke触发。正式末行`❌ 门禁失败于 depcruise（退出码 1）`；剩余计划逐步补跑末行`除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。日志`/private/tmp/aiflow-t7-final-{scoped,complete}.log`与`/private/tmp/aiflow-t7-targeted-final.log`。浏览器及Blender真实验证在具备本地执行权限的环境运行，沙箱Metal探测崩溃不计作测试通过；未修改系统配置。


## 正式复查（独立复查代理·2026-10-18）· T7 **PASS**

受审提交 `916631f97299ecba64e7a1e3c2dbb023e0641dc2`；复查方未参与施工，在独立 clone `/private/tmp/apollo-t7-independent-20261018` fetch 后锁定确切源码，逐行核查桥、固定 worker、集成及91项测试。早期验证使用的 worker SHA 与提交一致；最终桥的分级 stderr 和目标路径判断变更已核对并在确切提交重跑。本判词只通过 T7 作业桥、搭场景和预览阶段，3D 总单继续施工，不签任何游戏生产人门。

| 四律 | 独立证据 | 结果 |
|---|---|---|
| ① 独立复跑 | 确切提交定向91项、复查方自建8项对抗、真实4.5.14 LTS integration 与另写的几何/渲染双跑；另起完整门禁 | 91/91、8/8、真实验证exit0；全量5919/5920，仅指定围栏基线1例 |
| ② 撤修验红 | 另选三处锚：payload直接消费原输入路径；D1取消approved拒收；worker取消完整矩阵的Y-up/Z-up基变换 | 每处断言命中恰1次，分别红于快照哈希不符、proposed未抛错、GLB世界矩阵偏差12；均finally恢复原字节与SHA，恢复后91/91、8/8及真实几何/双跑全绿 |
| ③ 实证复现 | 初轮独立发现并打回祖先输出覆盖、证据符号链接别名、双路径指向同一物理产物三处问题；修后复用原脚本原断言 | 三项预拒且旧文件/旧证据不变；另核未知op/自由字段、子进程失败/缺新产物、输入快照同源、出界/悬空链接、D1批准及显式三维数据 |
| ④ 读告警与接缝 | 检查完整stderr、Blender逐跑job.log、PNG chunks、全部发布前物理目标校验、输入/worker哈希及每次独立快照 | 预期reject/mock/skip分支可解释；真实成功支无新Warning/Error。构建块大小提示及game-a art-03/game-c art-017台账死账均为现有告警 |

独立几何实证直接解 GLB 节点世界矩阵和 POSITION 数据，不以名字存在代替正确性：`col_* / nav_* / pick_* / spawn_*` 全保留；含平移、非零三轴旋转和缩放的矩阵逐项对 Three XYZ，最大误差 `4.38e-7`；box实际尺寸 `[2,4,6]`、XZ plane `[8,0,4]`，Y-up米制不丢。独立job的两次GLB SHA同为 `586631cb371ddc1bbc6563480d2b619c4579ec83cdfb595c6a41b3b5c3624fc8`，两个机位分别双跑字节相同、彼此不同；PNG保留IDAT及尺寸/色彩相关chunks，原字节快照和报告哈希对应。真实integration也独立双跑通过，normalize命中T4执行器未就绪，rig/retarget命中ARP缺失并非零，未用崩溃冒充拒收成功。

### 独立完整门禁

`scoped-gate --base 916631f97^ --run` 的完整计划为 eslint → depcruise → tsc → vitest → build → docs-ref → context-budget → art-ledger-guard。eslint exit0；depcruise exit1，实证唯一违规 `games/game113/guide-art.ts → src/assets/asset-index.ts`，与已批准基线完全相同。按原计划独立补跑后：

| 步 | 结果 |
|---|---|
| tsc / build | exit0 / exit0 |
| vitest全量 | exit1，5919/5920通过，0 pending/todo；唯一失败为同一 `depcruise-fence.test.mjs` 基线，JSON确认T7全部91项在内且通过 |
| spritegen原生node:test | exit0，5/5；仅将该原生文件从Vitest排除并独立执行，不删断言 |
| docs-ref / context-budget | exit0 / exit0 |
| art-ledger-guard | exit2，既有WARN允许档，无新增棘轮违规 |
| T7定向 / 自建对抗 / 固定Blender真实验证 | exit0 / exit0 / exit0 |

本次改动面无 artSmoke/backupSmoke 触发。**除基线 depcruise 外全绿**：正式末行 `❌ 门禁失败于 depcruise（退出码 1）`，逐步补跑末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。浏览器端口及Blender在获准环境真实运行；固定程序4.5.14，未改系统规避Metal探测、未使用真实ARP、未调用付费生成API或真实LLM会话。

证据：完整门禁 `/private/tmp/aiflow-t7-independent-final-{scoped,complete}.log`，同前缀分步日志和Vitest JSON；确切提交与恢复后测试 `/private/tmp/t7-independent-916631f97-{targeted,adversarial,real,geometry,restored-targeted,restored-adversarial,restored-geometry}.log`；另选撤修 `/private/tmp/t7-independent-916631f97-red-{snapshot,d1-approved,yup-basis}.log`，总记录 `/private/tmp/t7-independent-916631f97-sabotage.log`。独立脚本 `/private/tmp/t7-independent-early.mjs`、`/private/tmp/t7-independent-real-geometry.mjs`；恢复后真实证据 `/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/t7-independent-real-geometry-UuOriq/`，integration证据 `/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-blender-real-ofI2Af/`。
