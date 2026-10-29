# 本地美术资源保险库（架构与合成验证阶段）

施工主体：动画平台会话，仅 `tools/asset-vault`。本工具是离线文件工具，不新增引擎 system，不触碰 PUI/P3D。当前授权仅盘点、架构、源码及合成临时目录测试；尚未选定移动盘，未对真实资源执行备份/恢复。

## 使用目标与范围

一个明确的资源根映射，备份到用户指定的专用目录；普通文件按 SHA-256 校验、保存不可变快照，下一次复用已有且重新核验的对象。恢复到新的资源根后，继续使用现有工具的显式目录参数。源码走 Git；真实资源、逐资产清单、备份数据和实际路径配置留在 Git 外。

建议的资源别名沿用原叶目录名：

- `mixamo`：原始下载、None 母版与旧减帧/Uniform 对照。子目录隔离原样保留。
- `motion-lib-full-frames`：标准动作/角色 GLB 与目录；这是现行主库。
- `scene-props`：场景模型、贴图、包内许可证与目录；内部相对链接关系也必须保留。
- `motion-lib-generated`、`motion-lib-generated-contact-v022`、`motion-socket-validation` 等：独立派生候选和验证证据。失败候选不可因备份变成已批准素材。
- `motion-workbench`：AI 目录/故事计划快照。不是模型副本，不可只备这一个目录就算保存素材。

旧 `motion-lib`、历史实验、工具环境与缓存分别列入用户可选的保留范围。默认不擅自删掉“看似重复”的角色或候选。不能只按磁盘占用估算容量：APFS 克隆副本/稀疏文件在另一文件系统可能按逻辑大小重新占空间。

## 已核实的移植条件

现有 `catalog.json` 的 `clips/<id>.glb`、`skins/<id>.glb` 和场景 `entries[].path` 使用资源根内相对路径。`scripts/motion-library.mjs::libraryPath` 允许显式换根，并拒绝 Git 内资源输出。

工作台通过 `--lib`、`--runtime-lib`、`--runtime-report`、`--preview-report` 重绑定；Mink 通过 `--lib`/`APOLLO_MOTION_LIB` 和 `--python`；Blender 通过 `--blender`/`BLENDER_BIN`/PATH。当前没有统一 `APOLLO_ASSETS` 运行时根 API，本轮不假装已实现。

旧运行报告、作业记录和预览命令可能含绝对本机路径。这些是历史证据，必须保留原字节；恢复后另写本机启动配置，不全库替换字符串、不改历史 SHA。

移动盘能装载备份不代表能直接在盘上运行。保险库不依赖硬链接，适合保留普通文件和链接元数据；恢复内部链接需要目标系统的链接支持。生产侧车依赖 POSIX `flock`/`dir_fd`/`O_NOFOLLOW` 等语义，不承诺 Windows 或任意 exFAT/SMB 上直接运行。建议先恢复到本机合适文件系统，再执行库验证和预览。

Node 依赖、Blender 主程序、Mink/MuJoCo/NumPy/SciPy/DAQP 环境按目标 OS/CPU 重装并复验。复制 Python `.venv` 不能当作跨机器安装方案；不要把工具环境缓存当作资产主库。

## 安全结构

- 显式 source 别名与 target 专用目录；没有明确目标盘就不执行真实备份。默认 dry-run，只读元数据并预算容量，不进行文件内容复制。
- 每个资源树及所有相对路径严格校验；重名、大小写/Unicode 等价冲突、路径逃逸、外部/断裂/循环链接或未知特殊文件拒收。
- 内部相对链接保留为清单记录；备份阶段不解引用复制外部内容。恢复时只重建已确认仍在同一资源根内的链接。
- 只读源。目标通过标记、物理根/卷/目录身份检查；源/目标重叠、目标变盘、意外跨卷和空间不足拒收。不自动格式化、删除、覆盖或清理任何已有内容。
- 对象使用 SHA 目录下的独立 UUID 版本，不与源共享硬链接；对象内容写完、核验后才标记完成。快照在全体对象通过后独占发布清单，未完成目录不能当作可恢复快照。
- 重跑可复用经重新核验的完整对象；失败记录和 partial 保留。损坏对象拒收，不静默覆盖修补；恢复只能到新目录，失败后依据记录选择新目标重试。
- 清单只描述数据，不包含可执行钩子或下载步骤。恢复不运行包内文件、不安装依赖、不替用户修改引擎认证或配置。

这是正常协作写者下的变化检测与错误恢复，不是对恶意同 UID 并发进程的完备防篡改承诺。断盘后不能承诺磁盘仍在线；须检查连接/挂载状态后用明确参数重试。

## 未来真实执行的入口条件

先只读核实用户明确选择的目标磁盘、格式、容量、专用目标路径和冲突策略，并列出本次 source 别名。dry-run 显示逻辑字节和保守空间余量，确认后才执行 apply；本轮无此真实执行。

恢复后核对快照及资源 SHA，再用新根启动工作台和原生库验证。动画主库可运行 `node scripts/motion-library.mjs validate --lib <新根>/motion-lib-full-frames`；工作台命令见 `tools/motion-workbench/README.md`。备份字节通过、库结构/播放通过、真实视觉质量仍是三项不同结果。

当前是 CLI/架构原型，尚无桌面“一键备份”按钮，也没有系统磁盘选择器或任意引擎自动挂载功能。

## 命令与验证

以下路径为占位示例，本轮没有对真实资源执行这些备份命令。`--target` 必须预先存在，且为空的专用目录或本工具已有保险库；不能直接把整块有用户文件的盘根当作目标。

```sh
# 无写入的容量计划；backup 不带 --apply 也只做同样的计划。
python3 tools/asset-vault/vault.py plan \
  --source motion-lib-full-frames=/chosen/ApolloAssets/motion-lib-full-frames \
  --source scene-props=/chosen/ApolloAssets/scene-props \
  --target /chosen/backup-directory

# 未来用户已明确目标盘及范围之后才执行。
python3 tools/asset-vault/vault.py backup \
  --source motion-lib-full-frames=/chosen/ApolloAssets/motion-lib-full-frames \
  --source scene-props=/chosen/ApolloAssets/scene-props \
  --target /chosen/backup-directory --apply

python3 tools/asset-vault/vault.py verify --target /chosen/backup-directory --snapshot SNAPSHOT_ID
python3 tools/asset-vault/vault.py restore --target /chosen/backup-directory \
  --snapshot SNAPSHOT_ID --destination /chosen/new-restored-assets --apply

# 仅合成临时目录的测试，不需要任何美术素材或移动盘。
python3 -B -m unittest discover -s tools/asset-vault -p 'test_vault.py' -v
node node_modules/vitest/vitest.mjs run tools/asset-vault/vault.test.mjs
```

空间计划为全量最坏大小加目录/清单余量和默认64MiB保留，即便已有对象可能复用也保守拒绝容量不足。增量会重新读取源和已复用对象以校验 SHA；省的是复制空间，不保证无需读取大文件。恢复前和逐文件也检查容量。可用 `--reserve-bytes` 显式调整余量，不能把 dry-run 估计当作拔盘后仍有效的容量保证。

内部相对链接仅接受直接指向资源根内已有实体的形式，保留其原始相对链接文字；链式链接、穿过链接目录的目标、绝对/外部/断裂/循环链接明确拒收，不扁平化、不偷偷改写。文件名非 NFC 时也拒收而不自动改名。若源在执行期间变化，须查看失败日志并用原 source/target 参数重新运行；已完成对象会重新核验复用。硬崩溃留下的锁、初始化中断目录和损坏对象不自动清除，需独立人工核对，不能无条件自动重试。

保险库结构为 `vault.json` 标记、`objects/<SHA>/<UUID>/data` 与对应完成标记、`snapshots/<UUID>/complete.json` 以及 `logs/*.jsonl`。没有“删除旧版本”或“覆盖损坏文件”命令。清单及失败日志可能很大且属于本机数据，全部必须在 Git 之外；工具会拒绝 Git 内目标/恢复目录，仓库既有 `__pycache__/`、`*.pyc` 忽略规则只用于代码测试缓存，不增设全局模型忽略以免隐藏合法游戏资源。

## 三层范围：运行数据、离线运行全备、制作档案

默认不把所有历史目录都装进包。“最小”由运行入口的实际依赖闭包定义，本轮入口为完整动画工作台与完整场景草稿树，不能缩成一个样片。

- **最小运行数据**：原库 catalog 和所有索引 clips/skins；运行时 Socket catalog 和所有索引 clips/skins、完整/精简报告；场景整树含许可、贴图与安全相对链接。使用新资源根显式启动，不包含未索引作业、旧压缩对照或 static-skins。
- **离线完整运行 Backup**：上述数据、固定 Git commit 的源码归档、锁文件、相对根绑定及恢复说明，取回源码无需 GitHub。可附当前 OS/CPU 的现有 Node/依赖种子，但它不是通用跨平台安装包，也不自动包含 Blender/Mink 制作环境。
- **可选制作源/历史档案**：原始 FBX、旧减帧对照、独有派生动作、导入证据及候选历史。未进入运行包不等于可删除；角色历史来源可能仍引用旧导入目录。具体清理必须另有依赖核对、可恢复备份与用户确认。

`runtime-plan.mjs::buildRuntimePlan` 只读生成运行闭包，显式参数为 libraryRoot、runtimeRoot、runtimeReport、previewReport、sceneRoot 与完整40位 codeRevision。默认校验所有文件 SHA；`verifyAssets:false` 仅将模型按元数据列出，并显式标记实际模型 SHA 待核验，不能冒充已备份。计划含本机 sourceAbs，真实逐资产计划不得提交 Git。

输出按 library/runtime/scene 三个别名绑定；目录中的全部动作、角色和交互适配都覆盖。原始 catalog/report 逐字保留；历史绝对 source/evidence URI只作为历史来源，不是运行时读取路径。场景库仍是原始草稿，不因复制而获规范化或视觉验收。

```sh
node node_modules/vitest/vitest.mjs run tools/asset-vault/runtime-plan.test.mjs
```

隔离验证须把全计划数据复制到新目录并核 SHA，恢复固定代码，禁止读取原 ApolloAssets，使用新服务加载。代码版本中若含本机绝对依赖链接，要保留其元数据并禁止自动跟随，不能偷偷借原链接通过测试。字节校验、HTTP 可加载、少量真实渲染和全库视觉验收分别记录；其它游戏/制作入口需各自闭包和平台验收。
