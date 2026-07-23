# game-103《幸存者核心原型》· 场景布局 & UI 布局设计交接案（v1）

> 2026-07-23 · GD-103 · S4 交付物。配套设计稿（**PE 1:1 复刻基准**·CLAUDE.md 稿铁律·均渲染目击在案）：`survivor-hud-mockup.dc.html`（SC-2 战斗 HUD + SC-3 升级三选一）· `survivor-menu-result.dc.html`（SC-1 主菜单 + SC-4 结算胜/负）。
> **UI 铁律**：HUD/菜单/弹窗全部用 `LayoutNode` 闭集控件（`src/ui/components/catalog.ts`）；**play-field（玩家/敌人/子弹/宝石实体）走 render 组件 + 引擎渲染器**（rendering-fx.md），不是 LayoutNode。写世界=`action` 信号入队，handler 不塞逻辑。
> 做前必读 `ui-playbook.md` 四准则（防重叠/对比/透明/布局卫生）；交付前跑 `/check-ui` + `tools/ui-audit.mjs` 归零。

## 0. 场景流转图

```
[SC-1 主菜单] --开始--> [SC-2 战斗(核心)] --经验满--> [SC-3 升级三选一 Modal] --选完--> 回 SC-2
                                    |                                            
                              HP归零/Boss死                                       
                                    v                                            
                            [SC-4 结算] --重开/返回--> SC-1                        
   [SC-5 设置] 全局 Modal（SC-1/SC-2 均可唤）
```

## 1. 全局设计语言

- **形态**：移动优先竖屏 9:16（触屏单摇杆天然契合）；桌面居中裱同比。
- **视觉基调**：暗色战场（深底聚焦发光实体）+ 高对比 HUD。主题令牌走 `UITheme`（换皮）。
- **配色（语义令牌·非裸 hex）**：面板底 `SurfaceToken` = `ink/raised`；血=`danger`、经验=`jade`/`ok`、金币=`gold`、Boss=`danger`。文字 `Label.color ∈ {text,sub,dim,gold,danger,ok}`。
- **字体槽**：数值/计时 `display`（大字醒目）；正文 `ui`；三选一稀有度标题可用艺术字 `impact/epic`。
- **HUD 布局法**：分 5 个 dock（顶栏满宽 / 左上 / 右上 / 底部托盘 / 中央弹层），dock 内流式排，dock 间留距——**杜绝手填坐标重叠**（ui-playbook §1）。

## 2. 场景清单

| 场景 | 类型 | 核心控件 | 备注 |
|---|---|---|---|
| SC-1 主菜单 | Screen | 大标题 Label + 菜单按钮框（等宽 stretch）+ 版本 | 开始/局外升级/设置 |
| SC-2 战斗 | play-field + HUD overlay | 见 §3 SC-2 | **核心场景** |
| SC-3 升级三选一 | Modal（遮罩盖战斗） | 3× 选项卡 + 稀有度 Badge | **核心爽点·时停** |
| SC-4 结算 | Screen | 战绩栏 + 进化图谱 + 重开/返回 | 胜/负两态 |
| SC-5 设置 | 全局 Modal | 音量/操作/退出 | — |

## 3. 逐场景详案

### SC-2 战斗（核心场景）

**play-field 层（render 组件·引擎渲染器·非 LayoutNode）**：
- 玩家（中心跟随·`camera`）、敌群、子弹/AoE、经验宝石、道具、Boss —— 全是实体，挂 render-only 的 `Sprite`/`Shape` 皮肤槽（art-pipeline 红线：主体实体必带皮肤槽，原型用占位几何体）。
- 伤害飘字 / 拾取 +Exp = `Float` + `anim:'floatUp'`（juice·render-only 不进 hash）。

**HUD overlay 层（LayoutNode）**：

| Dock | 元素 | 控件（闭集） | 数据绑定 |
|---|---|---|---|
| 顶栏满宽 | 经验条 | `ProgressBar{tone:'jade',showValue?}` | resourceId=`exp` |
| 顶栏满宽 | Boss 血条（Boss 战才显） | `ProgressBar{tone:'danger'}` | resourceId=`bossHp` |
| 顶-中 | 计时 mm:ss | `Label{font:'display',format:'time'}` | StringVar=`gameTime` |
| 顶-中 | 等级 Lv.N | `Badge{tone:'gold'}` | StringVar=`level` |
| 左上 | 生命条 | `ProgressBar{tone:'danger',size,showValue}` | resourceId=`hp` |
| 左上 | 击杀数 🗡 | `Label{spans:[icon,text]}` | StringVar=`kills` |
| 右上 | 金币 🪙 | `Label{spans:[icon,text]}` | StringVar=`gold` |
| 右上 | 暂停 | `Button{icon:'⏸',action:'sig.game.pause'}` | — |
| 底部托盘 | 武器格 ×6 | `Panel{bare,row}` > `Button.skin`（图标）+ 等级点 `Badge` | 每格=武器 id + lv |
| 底部托盘 | 被动格 ×6 | 同上（区分底色 `raised`） | 每格=被动 id + lv |

> 移动摇杆=`input-capture`+`controllable`（play-field 输入·非 UI action）；HUD 不接管走位。

### SC-3 升级三选一 Modal（核心爽点·时停）

- 遮罩 `Screen`/`Panel` scrim ≥0.85（透明铁律：内容区不透穿），盖住战斗但战斗**暂停**（time-scale=0）。
- 标题 `Label{font:'impact'}`「升级！选择一项」。
- **3× 选项卡**（`Panel` 或 `Card`·竖排或横排 grid）：每卡 = 图标 `Image`/`Button.skin` + 名称 `Label` + 描述 `Label{color:'sub'}` + 稀有度 `Badge{tone}`（普/稀/史诗→ `ok`/`jade`/`gold`）+「进化就绪 ⚡」高亮态（`fx:'holo'` 或金框 `edge:'gold'`）。
- 整卡可点 → `action:'sig.levelup.pick'` + `arg=choiceId`（信号入队·由 sim 消费应用升级）。
- 可选重roll/跳过按钮（后置）。

### SC-4 结算

- 胜/负标题（`Label{font:'epic'}`）+ 战绩栏（存活时长/击杀/最高等级/金币·`Label` 网格）+ 本局进化图谱（获得的进化武器图标行）+ 按钮框（重开 `sig.result.retry` / 返回 `sig.result.home`）。
- 庆祝：胜利 `Particles{kind:'confetti'}`；金币结算飞入 `layout.flyTo`。

## 4. 信号总表（命名约定 `sig.<域>.<动作>`）

| 信号 | 触发 | sim 消费 |
|---|---|---|
| `sig.game.pause` | 暂停键 | 开设置 Modal + time-scale 0 |
| `sig.levelup.pick`（arg=choiceId） | 三选一选卡 | 应用升级/进化·关 Modal·恢复 time-scale |
| `sig.result.retry` | 结算重开 | 重置单局（新 seed） |
| `sig.result.home` | 结算返回 | 回 SC-1 |
| `sig.menu.start` | 主菜单开始 | 进 SC-2 |
| `sig.settings.*` | 设置项 | 音量/操作 |

## 5. 美术槽位总表（→ S6 台账预备 · 原型占位几何体起步）

| 主体 | 皮肤槽 | 原型占位 |
|---|---|---|
| 玩家 | `Sprite` | 蓝圆 |
| 敌人 E1-E6 | `Sprite`×6 | 灰/红/紫圆·大小分档 |
| 武器投射物 ×5 | `Sprite`×5 | 白/黄几何体 |
| 经验宝石 蓝/绿/金 | `Sprite`×3 | 三色菱形 |
| 道具 回血/磁铁/炸弹 | `Sprite`×3 | 图标方块 |
| 武器/被动图标 ×13 | `Button.skin` 台账 | emoji 占位（🗡🌀⚡…） |
| Boss | `Sprite` | 大红圆 |

> 皮肤就绪即盖过占位（art-pipeline 红线：主体实体必带皮肤槽·程序化观感仅回退）。台账推导脚本 `game-103-art-derive.mjs`（待建·形态定后）。

## 6. 交接注意（下游 PE/PUI 必读）

- HUD 坐标**先渲一次量真实包围盒再摆**（padding 撑宽/内容撑高·ui-playbook §1.1）；能流式就别绝对定位。
- 一切随机（三选一抽取/散射）走种子 PRNG，**禁裸 Math.random**。
- 三选一/进化/波次三处编排=**capability-plan §4 E1–E4 待裁**，过审前不写游戏层 system。
- 交付前 `/check-ui` + `tools/ui-audit.mjs` 归零；至少过深主题 + daylight 亮主题两遍对比度。

## 7. 表达存疑项（留给 PUI/LEAD 裁决·S5 前清零）

| 存疑 | 说明 | 去向 |
|---|---|---|
| 虚拟摇杆控件 | 闭集有无触屏摇杆件？还是走 input-capture 手势层 | ⬜ 查 catalog / 提 requests |
| 底部武器托盘"等级点 pips" | Badge 数字 or 小圆点条·哪个控件最贴 | ⬜ PUI |
| 进化就绪高亮 | `fx:'holo'` vs 金框 `edge:'gold'` 哪个达观感 | ⬜ 渲染目击后定 |
| 伤害飘字规模 | 大量 Float 飘字性能（数百/秒） | ⬜ 原型压测 |

## 8. 评审记录

- 提交人 / 日期：GD-103 / 2026-07-23
- Lead/PUI 裁决：⬜ 待审（连同 capability-plan 一并）
