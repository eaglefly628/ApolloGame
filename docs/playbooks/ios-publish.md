# 通用 iOS 产品发布手册

产品使用共享 Web 引擎和 UIKit/WKWebView 容器。发布链为产品配置、独立资源包、iOS 工程、设备验收、TestFlight。账号、广告、内购及内容合规按具体产品另行接入。

## 产品配置和构建

- 配置样例：`products/examples/touch-orbit/product.json`（纯数据）和 `products/examples/game112.json`（工程入口）。闭集校验：`scripts/lib/ios-product-config.mjs`。
- `source.kind=manifest` 引用仓库内 JSON，使用真实 manifest 校验和能力子集；`module` 直接指定 `games/**` 的 `mount(host)` 入口，保留动态能力目录。
- `resources` 声明 `public/` 下的随包文件或目录，保持相同 URL；不允许路径穿越、符号链接、覆盖生成 bundle。未声明的运行时资源不会自动打入。
- Game112 示例需要先按 `tools/native-character-runtime/README.md` 构建播放器；正式动画及美术仍由产品选择并登记。示例配置不是素材授权或产品完成度背书。
- 执行 `npm run ios:prepare -- products/examples/touch-orbit/product.json`，输出 `release/ios/touch-orbit/`：`www/`、原生工程、`product.json` 和 `product-build.json`。
- 生成目录只在带有本工具回执时替换；失败保留上一份成功包。改配置、源码或引擎提交后重新生成，不复用旧回执。
- 构建身份绑定配置、源提交、源码/构建工具和最终文件的 SHA256；manifest 校验加载完整能力库，所以数据产品同时绑定全 src 树。

## 移动运行能力

- `runtime.touch={mode:'drag',range:64,deadZone:8}` 将拖动转为首个 `Controllable.playerId` 的 tick 输入，并与键盘合并；触控取消、后台及失焦清空输入。只在非按钮/输入区域采集，不创建游戏专用 UI。
- 数据产品复用 mountHost 等比适配，既有 PointerInputSource 经 DPR、缩放和相机逆投影采集点击/拖动；游戏面板禁浏览器平移，卸载恢复租用样式。
- `runtime.save={slot:'product-progress-v1',intervalMs:15000}`：成功读档后才启动，复用既有快照/序/checksum；持久化失败或坏档明确报错。一次只允许一个引擎持有同一配置槽位。
- 定时与后台请求串行保存；系统强杀最多保留最近一次成功检查点。显式退出需先 `await mobile.flush()`；不能保证 pagehide 的异步写必然完成。
- `runtime.audio.specs` 接世界 `Sound`，首次手势解锁并处理前后台/中断。产品自有音乐通过 `registerMobileAudio(port)` 加入同一生命周期；不自动接管自由音频逻辑。
- 工程入口在 `mount` 前安装环境并等待 `settled()`；数据入口由 `mountMobileBlueprint` 安装。API 与错误事件见 `src/services/mobile/README.md`。
- 容器使用固定 `apollo://app`、持久化 WK 数据仓库和系统安全区；阻断外站资源及导航，允许受控同源 frame。NativeCharacter 的 URL、窗口来源与 v1 消息桥兼容该协议。

## 验收命令与状态

下面的 `OUT` 是已生成产品目录。每个命令都验证当前 buildId；回执写 `OUT/release/`，构建产物写 `OUT/build/`。

| 命令 | 证明的事项 |
| --- | --- |
| `node scripts/ios-web-smoke.mjs OUT` | 桌面 Chromium 中真实启动、同源资源和初始错误；不代表 iOS 真机 |
| `node scripts/ios-touch-smoke.mjs OUT` | 仅 touch-orbit 样板：真实触屏位移、横竖屏适配、后台暂停和存档重载 |
| `node scripts/ios-release.mjs doctor OUT` | Xcode、SDK、模拟器运行时、可用设备的实际状态 |
| `node scripts/ios-release.mjs sdk-build OUT --target simulator` | 模拟器 SDK 真编译，未运行 |
| `node scripts/ios-release.mjs sdk-build OUT --target device` | 设备 SDK 真编译，未签名 |
| `node scripts/ios-release.mjs simulator OUT` | 需要已安装模拟器运行时；按真实结果记账 |
| `node scripts/ios-release.mjs archive OUT` | 未签名标准 xcarchive；不代表可上传 |
| `node scripts/ios-release.mjs sign OUT --execute --team-id TEAM` | 显式使用已配置的签名环境生成签名 archive |
| `node scripts/ios-release.mjs export OUT --execute --export-options FILE` | 使用已确认的导出配置导出 IPA |
| `node scripts/ios-release.mjs device OUT --execute --device UDID` | 真实连接、安装与启动；设备类型从实际 Mach-O 和 Info 核验 |
| `node scripts/ios-release.mjs upload OUT --execute` | 上传接收状态；还需 Apple 后台处理 |
| `node scripts/ios-release.mjs testflight-status OUT --execute` | 查询 ASC：处理中、可测试和已进入测试分发分别记录 |
| `node scripts/ios-release.mjs gate OUT --target testflight` | 当前包、签名、设备及有效 Apple 后台证据齐备才通过 |

- TestFlight 凭据只由环境提供：`ASC_APP_ID`、`ASC_API_KEY_ID`、`ASC_API_ISSUER_ID`、`ASC_API_PRIVATE_KEY_PATH`。密钥内容不写产品配置、输出或回执。
- `store` 需产品负责人给出真实 `privacyPolicyURL`、`supportURL`、年龄分级、明确的 `exportCompliance.usesNonExemptEncryption`；`icon` 指向产品 PNG。技术构建可缺这些资料，发行门拒绝缺失和占位。
- SDK 编译、模拟器、设备、上传接收和 TestFlight 可测试的证据分开；无设备/签名/资料时返回 blocked/failed，不能将命令干跑或手写通过标志当成完成。
- ASC 状态证据一小时后需重新查询；上传成功不等于后台处理成功或 App Store 审核通过。
- 设备安装启动是最小自动证据；完整触控、存档重启、音频中断、性能与内容走查仍应由该产品附具名设备报告。

## 流程接线与维护

- iOS 产品在 S8 工程终检外执行上述发行门，留存当前 buildId 的设备与 TestFlight 回执；通用 S8 三绿只覆盖工程健康。
- 手动 CI：`.github/workflows/build-ios-product.yml`，校验配置、移动回归、真 Web 启动及两类 SDK 编译，上传未签名产物；不会自动签名、装机或上传 TestFlight。
- 回归：`scripts/lib/ios-{product-config,native,release}.test.mjs`、`src/services/mobile/`、触控/键盘与 NativeCharacter 测试；Swift 政策测试在 `ios/tests/SchemeHandlerTests.swift`。
- Apple 当前上传 SDK 要求见 [SDK requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)；上传工具及后台处理见 [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)。
