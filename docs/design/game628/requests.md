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
