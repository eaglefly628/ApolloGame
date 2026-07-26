# game101 ·《海港绯闻》美术台账（art-manifest·非 Sprite 补充）

> **两份台账·分工明确·互相链接**
> - **机器真相 = play-field Sprite 域** → `public/games/game101/art/art-ledger.json`（+ 人读镜像 `art-ledger.md`）。由 `scripts/game101-art-derive.mjs` 扫 `buildBlueprint()` 全视觉实体**自动推导**（48 皮肤槽·棋盘物品/生成器/沙格/泡泡的 `Sprite.textureKey`）。**勿手改**（改台账改脚本/JSON）。
> - **本文 = 非 Sprite 美术补充** → 推导脚本捕捉不到的四域：① 顾客立绘 ② 场景/背景（含 owner 要的卡通背景）③ UI 皮 ④ FX/特效。本文为**人读台账·全占位清单·零真 key·不生成真图**。
>
> **口径/规格来源**：`docs/design/game101/ui-brief.md`（§0 色板 + §0.1 UI 铁律）· `gdd.md`（§角色与世界观·纵火案悬疑港湾）· `refs.md`（原作布局拆解·换皮基准）。
> **IP 红线（gdd §换皮）**：全部**原创**·机制复刻·**禁抠原作 PNG**。**风格锚统一** = `cozy / 海港治愈 / 暖阳 / 轻插画 2.5D / 糖果感`。
> **画布基线**：竖屏 1080×1920（9:16）。**色板**（ui-brief §0.2）：暖阳橙 `#FF9A3C`·海水蓝 `#3EC5E8`·珊瑚粉 `#FF6F91`·奶白底 `#FFF7EC`·深褐字 `#4A3B2A`·能量黄 `#FFC43D`·星星金 `#FFD34E`·金币金 `#F4B740`·宝石紫 `#8A5CF6`。
>
> **资产约定**：真资产落地走 asset 管线（`assets/index.json` 单一真相 + 本游戏本地 `public/games/game101/art/index.json`·带 `provenance`/`license`）。本次**只出台账·不 vendor 真图**。状态图例：⬜ 待美术（全部当前状态）。

---

## 域 1 · 顾客立绘（character portraits）

> 消费位：`theme.ts CUST_PORTRAITS[]` → 订单卡 `Avatar.src`（`s1.ts` `ord-{i}-av`·`size:190·shape:rounded`）。剧情演出（S6 dialogue）另需半身立绘 + 表情差分。
> **当前占位**：CC0 faceset（`superpowers/ninja-adventure/characters/faceset/{1,5,12}.png`·38×38 像素头·asset-manager 2026-07-25 vendor·已登记本地 index.json `cust_portrait_1..`）。像素风与本品「轻插画 2.5D 糖果感」**风格不符**，且尺寸远小于订单卡 190 显示 → 全部待原创替换。
> 角色设定见 `gdd.md §角色与世界观`（纵火案悬疑·家族秘密·情感纠葛）。**当前 orders.json 只用到 周航/老陈/苏晴 三位**；林夏（女主）/林国栋/阿雅为剧情线角色，随 Day 内容上线。

### 1a · 订单柜台小立绘（半身·表情差分·棋盘常驻）

| 角色 | 定位（gdd） | 消费位 | 尺寸规格 | 透明底 | 风格锚 | 当前占位 | 状态 |
|---|---|---|---|:--:|---|---|:--:|
| 周航 | 青梅渔民·供货·暧昧线 | 订单卡 Avatar（`ord-*-av`） | 立绘半身 512×640·卡内 190 圆角显示 | 是 | 阳光渔家青年·暖调·糖果感 | faceset `1.png`（像素占位） | ⬜ |
| 老陈 | 万能维修工 | 同上 | 512×640 | 是 | 憨厚工匠中年·暖调 | faceset `5.png`（像素占位） | ⬜ |
| 苏晴 | 好友·副线 | 同上（限时特惠单顾客·金框） | 512×640 | 是 | 温柔都市女性·暖调 | faceset `12.png`（像素占位） | ⬜ |
| 林夏 | 女主·离异回乡 | HUD 玩家头像（S4）+ 后续订单/剧情 | 头像 128×128 + 立绘 512×640 | 是 | 主角·四表情起（见 1b） | 无（HUD 现为 Lv 文字胶囊） | ⬜ |
| 林国栋 | 女主父亲·关系紧张 | 后续订单/剧情 | 512×640 | 是 | 严肃长者·暖调 | 无 | ⬜ |
| 阿雅 | 好友·副线 | 后续订单/剧情 | 512×640 | 是 | 活泼少女·暖调 | 无 | ⬜ |

### 1b · 剧情立绘表情差分（S6 dialogue·情感核心·P1）

> ui-brief §7：立绘表情与打光要「有戏」——情感表达是本品差异化命根。女主 4 表情起。

| 角色 | 表情集 | 消费位 | 尺寸规格 | 透明底 | 风格锚 | 状态 |
|---|---|---|---|:--:|---|:--:|
| 林夏（女主·首要） | 平静/惊讶/难过/微笑（4 起） | S6 `dialogue.portrait` | 半身 720×1280·分层可选 | 是 | 情感戏·柔光·2.5D 插画 | ⬜ |
| 周航 | 平静/微笑/严肃（3 起） | 同上 | 720×1280 | 是 | 同上 | ⬜ |
| 老陈 / 林国栋 / 苏晴 / 阿雅 | 各 2–3 表情（随剧情追加） | 同上 | 720×1280 | 是 | 同上 | ⬜ |

**小计**：订单半身立绘 6 位 + 剧情表情差分（林夏 4 + 周航 3 + 其余各 2–3）≈ 20+ 表情态。

---

## 域 2 · 场景 / 背景美术（scene & background）

> owner 明确要「卡通背景作为美术台账」。play-field 合并板本身走 Sprite 域（棋盘格底为色块占位·见 art-ledger）；本域列**背景层 / 场景 CG / 地图**——这些不是 per-entity Sprite，脚本不推导。

| 名称 | 消费位 | 尺寸规格 | 透明底 | 风格锚 | 当前占位 | 状态 |
|---|---|---|---|:--:|---|:--:|
| 港湾卡通主背景 | S1 合并主界面板后底层（play-field 底衬） | 1080×1920·可竖向平铺/视差 | 否 | 云汐湾晨曦·暖阳海港·卡通轻插画 | 无（现纯色 Screen 底） | ⬜ |
| 合并板操作台底纹 | 板井内衬（`s1.ts` WELL `#7f97dd` / CELL_BG `#c3cef0` 色块占位） | 平铺纹理 512×512 | 是 | 暖操作台质感·淡内阴影·治愈蓝 | 色块 `#7f97dd`/`#c3cef0` | ⬜ |
| 板外框 / 奶油边 | 板容器边框（`s1.ts` FRAME `#f2e3c2` 占位） | 9-slice 边框 | 是 | 奶白圆角·糖果感 | 色块 `#f2e3c2` | ⬜ |
| 菜单 / HUD 面板底 | 信息菜单 `menu-body`(bg sunken) + HUD 胶囊底 | 竖屏面板底 + 9-slice | 是 | 半透奶白·柔投影 | 语义令牌 panel/sunken/gold | ⬜ |
| 剧情 CG ×2（M1 起） | S6 `dialogue.bg` | 1080×1920 | 否 | ①白天海港街 ②餐厅夜景（`汐味馆`） | 无 | ⬜ |
| 装修场景（修复前/后） | S7 场景视图（花星星修复·风格 3 选 1） | 1080×1920×（前+后+3 风格） | 否 | 破败→温馨木质/现代简约/复古海洋 | 无（皮肤槽 f2-flag 切换） | ⬜ |
| 世界地图 | S8 海港地图（餐厅/码头/集市/灯塔热点） | 1080×1920 | 否 | 手绘感俯瞰·云汐湾·已解锁高亮/剪影上锁 | 无 | ⬜ |

**小计**：背景/底纹层 4 + 剧情 CG 2 + 装修场景 5（前+后+3 风格·首场景）+ 世界地图 1 = **12 项**（不含后续 Day 扩展 CG/场景）。

---

## 域 3 · UI 皮（UI skin·对应 s1.ts 现用令牌/custom hex 占位位）

> 全 UI = LayoutNode 闭集（禁手写 DOM/CSS）。「UI 皮」= 给现有语义令牌（`bg:'panel'/'gold'/'sunken'`）与 `custom` hex 占位处配套的**皮肤图**（9-slice / 图标）。扩令牌/异形容器走 `requests.md` 报 PUI，**本文只登记美术需求·不改控件**。

| 名称 | 消费位（s1.ts） | 现占位 | 尺寸规格 | 透明底 | 风格锚 | 状态 |
|---|---|---|---|:--:|---|:--:|
| HUD 资源胶囊皮 ×3 | `hud-energy`/`hud-coins`/`hud-gems`(bg panel·h96 横胶囊) | 语义令牌 panel + emoji 字形 ⚡🪙💎 | 9-slice·≥300×96 | 是 | 雪盖圆角糖果胶囊·暖调 | ⬜ |
| 关卡+星进度胶囊皮 | `hud-lvl`(bg gold) + `ProgressBar hud-lvl-bar`(tone ok) | 令牌 gold + 系统进度条 | 9-slice + 条皮 | 是 | 星星金进度·暖阳 | ⬜ |
| 菜单按钮皮 ☰ | `hud-menu-frame`(bg gold·108×96·action open_menu) | 令牌 gold + 字形 ☰ | 108×96 | 是 | 糖果方钮·柔投影 | ⬜ |
| 商店按钮皮 🛒 | ui-brief S4「[🛒]」（购物车·`open_shop`） | 未落地（brief 规划） | 108×96 | 是 | 同上 | ⬜ |
| 糖果卡片皮（菜单/链条/日志/规则） | `menu-chain-*`/`menu-log-*`/`menu-rule-*`(bg custom·CANDY 8 色) | custom hex `#ffd7a6…#c8ecff`（8 色轮） | 9-slice·卡宽 | 是 | 糖果高饱和·彼此可辨 | ⬜ |
| emoji 圆牌皮 | `emojiChip`（白圆牌 dim140·装物品/链条 emoji） | custom `#ffffff` 圆底 | 140×140 圆 | 是 | 圆牌高光·卡通糖果 | ⬜ |
| 订单卡皮（普通/可交付/限时） | 订单 `Panel`(bg panel·edge ok/gold·限时 shape cut) | 语义令牌 + 矩形金框顶异形 | 9-slice·卡宽 | 是 | 柜台卡·可交付绿框·限时金框 | ⬜ |
| 托盘（餐盘）+ slot 皮 | `ord-*-plate`(bg sunken) + `ord-*-s*`(bg ok/gold/raised) | 语义令牌 | 9-slice + slot 格 | 是 | 木质餐盘·slot 空/已点/集齐三态 | ⬜ |
| 星锁区 / 里程碑皮 | 里程碑 marker（`milestoneTag`·星达标解锁新区） | 令牌占位（progression 驱动） | 图标 + 锁罩 | 是 | 星星金锁·解锁高亮 | ⬜ |
| 泡泡（气泡锁）皮 | 棋盘泡泡格 `t-live-*`(bg custom `#bfe4ff`·action pop_*) + 金币价签 | custom `#bfe4ff` 半透 | 84×84 泡 + 价签 | 是 | 半透明泡泡 + 金币价签 | ⬜ |
| 能量药水皮 | 棋盘能量物 `t-live-*`(bg custom `#6a5acd`·可合并道具) | custom `#6a5acd` 色块 | 84×84 | 是 | 紫/蓝多级药水瓶 | ⬜ |
| 沙格 / 阻碍层皮 | 覆盖格 `t-live-*`(bg custom COVER_BG `#b8895a`·💥N 角标) | custom `#b8895a` 沙色 | 84×84 + 角标 | 是 | 沙土/蛛网·挖掘揭开 | ⬜ |
| 生成器格皮 ×4 | 棋盘 gen 格 `bg custom GEN_BG #c8871e` + 令牌 GEN_TINT `0xc8871e`（皮肤槽 gen_fridge/coffee/fishbox/toolbox 在 Sprite 域 art-ledger·此为**格底衬皮**） | custom `#c8871e` 金 | 96×96 底衬 | 是 | 暖金生成器台·⚡/⏱ 角标位 | ⬜ |
| 关卡完成横幅皮 | `lvl-done`(bg gold·edge ok·800×400 中央) | 令牌 gold + Particles | 800×400 | 是 | 庆祝横幅·码头声名远扬 | ⬜ |
| 进度条皮 | `ProgressBar`(tone ok·关卡星进度) | 系统控件默认 | 条皮 9-slice | 是 | 星星金填充·暖底槽 | ⬜ |

**小计**：**15 类 UI 皮**（生成器格皮含 4 个·泡泡/药水/沙格随棋盘状态复用）。
**PUI 依赖记账**：限时订单「异形容器」现用矩形金框 + `shape:'cut'` 顶着 → 引擎池 `REQ-UI-异型容器` / `REQ-101-07`（复用 ShapeToken 到 Panel）落地后升级；**绝不手写 clip-path**（已在 ui-brief §4.1 记）。

---

## 域 4 · FX / 特效（program-procedural·可长期占位）

> 现全部走基座 `Particles`（render-only·不进 sim/hash）+ `layout.flyTo` 飞行原语（唯一飞行原语·非自造）。**判断：程序化占位质量足够·可长期使用**，真特效素材为**可选增强**（非阻塞）。列出以备后续贴图化。

| 名称 | 消费位（s1.ts / gdd §7） | 当前占位 | 可选真素材 | 风格锚 | 状态 |
|---|---|---|---|---|:--:|
| 合成迸发（星光爆） | `t-live-*-burst`（`Particles kind:'stars' count:14`） | 程序化 stars 粒子 | 星光圈 sprite sheet（可选） | 合并瞬间星星光圈 | ⬜ 可选（程序化可长用） |
| 交付飞金币 | `layout.flyTo{to:'hud-coins',arc}`（金币沿弧飞进钱包·juice deliver） | 飞行原语 + Label 🪙 | 金币 sprite（可选·现 emoji） | 弧线飞入 HUD | ⬜ 可选 |
| 沙格 / 阻碍消融 | `t-live-*-dis`/`-dis2`（`Particles confetti+sparkle`·挖掘揭开叠尘土） | 程序化 confetti+sparkle | 尘土/碎屑 sheet（可选） | 挖开迸尘 | ⬜ 可选 |
| 关卡完成彩带 | `lvl-done-fx`（`Particles kind:'confetti' count:60 loop`） | 程序化彩带 | 彩带 sheet（可选） | 庆祝满屏彩带 | ⬜ 可选 |
| 订单集齐庆祝 | `ord-*-cel`（`Particles kind:'sparkle' count:18`） | 程序化 sparkle | 星光 sheet（可选） | 订单可交付闪光 | ⬜ 可选 |
| 破泡 / 生成器按下缩放 / 发奖入袋 | gdd §7（`JUICE_TIMELINES` 数据编排） | timeline + Particles（部分待落地） | — | 破裂/缩放/入袋 | ⬜ 可选 |

**小计**：**6 类 FX**·均标「程序化占位可长期用」·真素材为可选增强（非 ⬜ 待美术阻塞项）。

---

## 台账覆盖汇总（本文·非 Sprite 域）

| 域 | 项数 | 阻塞待美术 | 备注 |
|---|---:|---:|---|
| 1 · 顾客立绘 | 6 角色（+20 表情态） | 6 立绘 + 表情差分 | 现 CC0 像素占位·风格/尺寸均不符 |
| 2 · 场景/背景 | 12 | 12 | 含 owner 要的港湾卡通背景 |
| 3 · UI 皮 | 15 类 | 15 类 | 对应 s1.ts 令牌/custom hex 占位 |
| 4 · FX/特效 | 6 类 | 0（全程序化可长用·真素材可选） | — |

> **Sprite 域（另一份台账·不重复）**：48 皮肤槽（5 链物品 + 生成器 sprite + 沙格 + 泡泡）见 `art-ledger.json` / `art-ledger.md`。

---

## 附 · play-field 台账缺漏 / 不一致（报告·未擅改自动生成物）

1. **顾客立绘不在自动台账内**：`CUST_PORTRAITS` 是 `Avatar.src`（外部图片路径·非 `Sprite.textureKey` 皮肤槽），`deriveRequirements` 只扫 Sprite 皮肤槽 → 顾客立绘漏出 Sprite 台账。**本文域 1 已补**。属预期分工，非 bug。
2. **生成器「格底衬皮」vs「生成器 Sprite」两层**：art-ledger 覆盖生成器 `Sprite.textureKey`（gen_fridge 等·物件本体）；但棋盘 gen 格底还有一层 `bg custom #c8871e` 格衬皮（s1.ts），不在 Sprite 域。本文域 3 已补登记。
3. **命名一致性**：generators.json 里 `gen_fridge` 中文名已从「冰箱」改为「米仓」（产 food 粮食链）、`gen_toolbox` 改「甜点炉」（产 tool 甜点链），但 ui-brief §2/§11 与 refs 仍写「冰箱/工具箱」。**仅文档措辞滞后·不影响 key**；建议 owner 定稿后回填 ui-brief（未擅改）。
4. **CC0 占位风格债**：ninja-adventure faceset 为像素 RPG 风·38×38，与本品「轻插画 2.5D 糖果感」+ 订单卡 190 显示尺寸均不符 → 域 1 全部标 ⬜ 待原创替换（已在 index.json `license:CC0-1.0`·可安全替换）。
</content>
</invoke>
