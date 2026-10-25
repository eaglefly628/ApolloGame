# 通用 iOS 发布层 · 实施与复查记录

## 授权与范围

对应 `REQ-MOBILE-SHELL`。owner 已明确采用共享发布层并要求补齐能力：产品配置 → 独立资源包 → iOS 容器 → 实机验收 → TestFlight。App ID 暂缓。施工锁提交 `55a11ae9b`；交付提交见本文件的 Git 历史。

实查旧 `cartridge-entry` 不识别 Game112，原离线包没有 iOS 工程与发行证据门。本次复用 Engine、manifest 校验、mountHost、输入命令、SaveSystem、AudioSync、NativeCharacter，补足宿主与发布工具；未增加游戏专属 system。Game113 不参与产品评估。

## 交付面

| 层 | 入口与行为 |
| --- | --- |
| 产品 | `scripts/ios-product.mjs`；闭集配置、manifest/module 两种源、声明式 public 资源、独立 www 与源码/资源指纹 |
| 容器 | `ios/templates/`、`scripts/lib/ios-native.mjs`；UIKit/WKWebView、固定本地源、安全区、持久存储、生命周期与资源访问策略 |
| 运行 | `src/services/mobile/`；触控/指针与键盘归并、缩放及相机坐标、读档后启动、串行检查点、前后台/音频中断、销毁取消 |
| 发行 | `scripts/ios-release.mjs`；SDK 编译、模拟器、archive、签名、导出、装机、上传、ASC 状态、当前构建证据门 |
| 回归 | `scripts/ios-web-smoke.mjs`、`scripts/ios-touch-smoke.mjs`；真实浏览器启动、资源、触屏位移、暂停、存档重载与横竖屏适配 |
| 接入 | `docs/playbooks/ios-publish.md`；纯数据样板与 Game112 工程入口样板，手动 CI 仅生成未签名包 |

## 独立复查与返工

施工人与复查人交叉分工：原生容器由发行复查方独立运行；移动运行层与产品构建由原生复查方独立运行；发行工具由移动运行复查方独立运行；PUI 兼容由移动运行复查方独立运行。以下问题均先复现再修复：

| 复现 | 修复及回归 |
| --- | --- |
| public 中间目录符号链接可带入私有文件 | 每级路径和复制树拒绝 symlink；原泄漏样本已拒收 |
| 工程源误用空能力子集 | 仅 manifest 使用校验出的子集；工程源保留动态目录 |
| 构建工具变化后旧回执仍可能有效 | 构建工具依赖纳入源指纹；篡改后拒收 |
| dispose 后延迟读档仍恢复旧 world | SaveSystem 可取消 load；销毁中止后续 restore，保留既有快照语义 |
| 旧音频异步恢复完成后暂停新宿主 | 端口 owner 与期望状态检查；原实证及新旧 owner 回归通过 |
| 数据 bundle 顶层 await 遇动态 chunk 环卡住 | 异步 boot 函数；真实浏览器 ready 与错误检查 |
| 真实触屏被浏览器平移接管并 pointercancel | 作用于游戏面板的 touch-action 租约；销毁恢复原值；真实触屏回归 |
| 数据画布固定尺寸溢出手机视口 | 复用 mountHost 等比适配，指针经 DPR/缩放和相机逆投影 |
| 正常松手后的 lostcapture 吞掉点击/拖动 | 区分活跃 pointer 与完成手势；正常释放保留已排队命令，后台取消清空 |

撤修证据：Swift 路径穿越守卫唯一锚点撤掉后政策测试失败；原生可执行平台判断撤掉后错误平台测试失败；PUI 消息来源守卫撤掉后异窗攻击测试失败；指针清理缺失时新生命周期测试验红。真实浏览器中断言 host/canvas 两个样式锚点均为 none，再改为 auto，同一真实手势触发 pointercancel，使禁止 cancel 的断言验红；恢复后完整触屏脚本再通过。源码未在全量门禁过程中撤改。

## 验收结果

**共享能力独立复查 PASS；产品发行门仍为 blocked，等待真实外部条件。**

- 完整 scoped-gate 退出 0：ESLint、依赖边界、sim DOM 围栏、TypeScript、682 个测试文件 / 7419 项测试、全库构建、文档/预算守卫均通过。
- 门禁期间纳入的最新主干 `bcec0f019` 仅增加独立 Mixamo 工具/文档，无本轮文件重叠；新增 20 项测试另行通过。未重置或移动共享工作树的其他改动。
- 两种样板实际构建并在 Chromium 启动。触屏样板真手势无 cancel，横屏 624×390、竖屏 390×243.75 均完整显示；角色位置随拖动变化，后台暂停、清输入、真实 IndexedDB 检查点及重载后归一化位置保持全部通过。独立指针/缩放/样式复跑 28 项通过。
- 全库构建的 chunk 体积/静动态 import 提示不改变退出码，已读取；游戏性能仍需产品实机测量。美术守卫有既存 WARN（game-a/game-c 死账等），Game112 为零；不把这些警告记作本次已修复。
- CI 已提供且条件分支经独立假运行核验，未声称 GitHub 托管 job 已执行。

## 验收范围与外部条件

- 本机 Xcode 26.6、iOS SDK 26.5；SDK 编译可执行，未安装可用模拟器运行时，未连接设备。
- Swift 资源策略真实编译执行 26 项通过。NativeCharacter 的实际播放器在 macOS WKWebView、原生完整 CSP 下完成 ready/status 往返；这不等于 iOS 设备 GPU 验收。
- 暗/亮 UI 审计均 0 重叠，但分别有 10/19 项硬性低对比、11/15 项次级警告。独立归档 HEAD 基线后复跑，输出与当前逐字一致；本次只修改 NativeCharacter URL/消息来源，不改布局、主题或这些控件。
- 首轮全量测试的浏览器路径、macOS 非规范临时路径配置错误，另有并发进程通信超时。使用规范临时目录、实际 Chrome 路径及受限 worker 并发后重新执行门禁；未削弱测试断言。
- 两个样板是工程接入证明；不代表完整素材授权、产品内容验收或 App Store 审核通过。
- 签名/真实设备/Apple 后台凭据与正式商店资料未提供，发行门必须返回 blocked；无 TestFlight 实发证据，不手写通过回执。

## 可复跑命令

按 `docs/playbooks/ios-publish.md` 生成样板，然后运行 web-smoke、touch-smoke、sdk-build 和 doctor/gate。完整共享门禁为 `node scripts/scoped-gate.mjs --run`；macOS 使用实际 Chrome 路径作为 `RENDER_PROBE_CHROMIUM`，`TMPDIR=/private/tmp`，按机器资源限制 Vitest worker 并发。原始日志与包回执另存本聊天的本地产物目录。
