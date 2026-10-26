# Game 628 · 游戏级需求单（不占引擎池槽位）

> 引擎能力缺口不写这里，写 `docs/workflow/requests.md` / `requests-3d.md`；这里只放本作的设计与生产工单。编号 `G628-NN`，开单前 grep 防重号。

### G628-01 · GDD v0.1 → v1.0 定稿 · [2026-10-16] · owner 提 · status: open
- ✅ 2026-10-22：owner 定 3D；其余三项按 Lead 默认推进（见 `gdd.md` §9）。剩风格令牌（G628-02）待 owner 看一眼。

### G628-02 · 风格令牌定稿 · [2026-10-16] · status: open
- 草案见 `design-freeze.md` §2。格式等 `REQ-AIFLOW-STYLETOKENS` 定；在此之前以草案表为准。

### G628-03 · 风格锚 KA-02（铁火炉）出图与定稿 · [2026-10-16] · status: blocked（等 `REQ-AIFLOW-REFGEN`）
- 先只出这一张；owner 定稿后作为全作参考图。

### G628-04 · 其余关键图 + 角色设定 · [2026-10-16] · status: blocked（等 G628-03）
- 清单见 `design-freeze.md` §3。

### G628-05 · 拆层单 D1 · [2026-10-16] · status: blocked（等 `REQ-AIFLOW-SPLIT` + G628-04）
- 预期拆法见 `design-freeze.md` §4；owner 确认后才进美术台账。

### G628-06 · UI 需求单 → Claude Design 出稿 → 收稿 · [2026-10-16] · status: blocked（等 G628-01/02）
- `node scripts/ui-brief.mjs --game game628` 可直接从 `gdd.md`「屏幕」「动作词表」两节推导。

### G628-07 · 文本：原著改编（中 / 英） · [2026-10-16] · status: open
- 依据 `gdd.md` §6：英文以 H. P. Paull 1872 公版译本为底本；中文自行翻译改编，不用现代译本。

### G628-09 · 动作清单 `motion-list.md`（Mixamo 搜索词 · 是否需 IK 修正） · [2026-10-22] · status: open
- 草案见 `design-freeze.md` §5.5「绑骨与动作」行。

### G628-10 · 真实 3D 链路首跑 · [2026-10-22] · status: blocked（等 owner 配置 Tripo key / Blender LTS / Auto-Rig Pro / Mixamo）
- 先用小女孩一个角色跑通 T3 → T4 → T5 → E2/E3/E4，产出独立复查记录；之前一律 Mock，不得标完成。

### G628-08 · 设计定稿人门 · [2026-10-16] · status: blocked（等 G628-01–07）
- 五件齐全由 owner 签；签后改设计开变更单。

### G628-11 · 首个 iOS / App Store 验收产品接入 · [2026-10-26] · owner 指定 game628 · **施工主体 = Codex（2026-10-26·本行即锁）** · status: blocked（发布准备已交·待独立复查；可玩入口 / 设计定稿 / 产品资料未齐）
- 范围：复用共享 iOS 发布工具，核实本作实际入口与资源；形成产品发布契约、商店文案草案、截图清单和逐项验收脚本；游戏可运行后再生成真实产品配置并执行真机 / TestFlight 验收。
- 不把样板冒充本作，不伪造 Bundle ID 所有权、商店网址、分级、签名和 Apple 后台证据；不代签设计定稿人门。GAP-628-04 / 05 已由 owner 2026-10-26 裁 A / B；G1实现待独立复查，G2不再新增环视能力。
- 前置实查：目前无 games/game628 入口、无可玩的 manifest、无本作场景 / 角色资源；只有设计文档和 draft 风格令牌。选为验收对象不等于这些产品内容已存在。

- 发布契约与9项产品验收剧本：[ios-release-plan.md](./ios-release-plan.md)；中英文资料草案：[app-store-draft.json](./app-store-draft.json)；施工记录：[review/G628-11-IOS.md](./review/G628-11-IOS.md)。以下子单只在各自前置具备后开工，不把父单视为已完成提审。

### G628-12 · 本作 iOS 可玩产品包与设备适配 · [2026-10-26] · status: blocked（等G628-01–08设计前置、GAP-628-04能力交付及实际可玩入口）
- 复用共享iOS工具，建立真实产品配置与资源清单；不复制touch-orbit玩法或用空manifest过关。按ios-release-plan的IOS628-01–07验收；iPhone/iPad均保留时均测。无签名SDK编译不是可上传IPA。
- 完成标准：本作包buildId在档、实际玩法与存档 / 音频 / 触屏 / 安全区 / 性能证据齐备，另一复查人核验；G628-10真实美术链路要求保持。

### G628-13 · App Store 商店材料与隐私 / 版权核实 · [2026-10-26] · status: blocked（文案草案已备；等最终可玩内容、发行主体与公开网址）
- 以app-store-draft的中英草案为起点，逐句对照真包；制作正式图标 / 实机截图、来源授权清单、最终SDK与数据清单、隐私 / 支持页面、年龄问卷与加密声明。名称、地区、商业模式及价格由owner决定。
- 完成标准：字段完整且真实、网址公开可达、应用内隐私入口可用、商店功能承诺与包一致；不能用原生模板的无采集声明代替最终产品核查。

### G628-14 · 签名 IPA、真机与 TestFlight 分发 · [2026-10-26] · status: blocked（等G628-12/13、真实Apple账号 / 签名与连接设备）
- 真实主体创建App记录与配置签名；按共享工具签名→导出→真机装机 / 运行→上传→ASC状态查询。凭据只放本机 / 环境。若选择章节内购，先立明确权益契约并完成购买 / 取消 / 恢复实证，不能用Mock替代Apple沙盒。
- 完成标准：同一buildId的签名、设备报告、上传与TestFlight可测试 / 分发证据齐备；发布门通过，无过期状态，不签真人门。

### G628-15 · App Store 提审、退回处理与发布 · [2026-10-26] · status: blocked（等G628-13/14及owner确认发布地区 / 商务材料）
- 完成真实审查联系信息、操作说明与适用账号 / 后端；上传时复核官方SDK / 截图 / 地区要求。按实际Apple审核回复处理，不以TestFlight成功当上架通过。
- 完成标准：Apple后台审核结果与实际商店状态有证据；正式发布由owner控制。审核未通过、待审核、未公开均不能标“已上架”。
