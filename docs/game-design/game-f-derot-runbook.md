# Game F 去腐执行 runbook(`blueprint.ts` → 纯数据 manifest + GameShell)

> 主策划/PF ｜ 2026-06-14 ｜ 执行 `requests.md` 的 `LEAD→PF · 2026-06-14` 去腐交办。
> 病灶(Lead 实测):game-f 非测试码 2658 行 / 生成器 56 / 脉冲标记 114(其余 5 游戏合计 0)/ EventWhen×39·Effect×115·Flag×78 —— 过不了"最弱 LLM 一致产出"尺子。**病灶单一:`blueprint.ts`(794 行,band/visSwap/makeRoundFlow 生成器 + 商店两段脉冲)+ `game-f.tsx`(623 行手写壳 + 假点击桥)**。引擎已备齐,**不加任何能力**,纯游戏侧。
> 自我纠错:我 v1 review 判"通过"只覆盖牌组切片(decks/taikou/combat),**漏审 `blueprint.ts`**——本 runbook 是补这半 + 给出去腐路径。

---

## 〇、目标范式(已读真实代码,照抄)

- **game-b**:整个游戏 = `data/game-b.manifest.json`(`id`+`content`+`ui`+`modules`+**扁平 `entities`**:Resource/Flag/EventWhen/Effect 全是 JSON 字面量,**不靠循环生成**)+ 薄 loader。
- **GameShell**:DOM 壳 = 一份 `UILayout`(闭集 union:`col/row/panel/tabs/text/stat/bar/button`;**事件=信号名、绑定=resourceId**)交 `@ui/shell/GameShell` 渲染,游戏层不写 React 壳。

---

## 一、★ 安全网(整个去腐的命门,先建)

> 平移类改动**必须语义等价**;靠肉眼对 794 行不可靠。**先加一个 deep-equal 快照守**:

- **片 0(先做,零风险)**:加测 `blueprint.snapshot.test.ts` —— 把当前 `buildGameFBlueprint()` 的输出 `JSON.stringify` 钉成快照基线。**此后每个"平移片"改完,输出必须与基线逐键 deep-equal**(行为零变),否则即回退。
- **绿灯逐关**:每片改完 `npx tsc --noEmit` + `npx vitest run src/games/game-f` **全绿才进下一片**;`world.hash()` 确定性测不许变。

---

## 二、分片(按风险升序;低风险纯平移先行,证方法再啃 redesign)

| 片 | 内容 | 类型 | 守 |
|---|---|---|---|
| **0** | blueprint 输出快照基线测 | 加测 | —— |
| **1** | `band()`(§4.1/4.2 经济)生成的实体 → **展平成 manifest JSON 字面量**(算出来的 income 档/CD_TICKS/hp 写定值);函数删、产物留 | 纯平移 | deep-equal + 绿 |
| **2** | `makeRoundFlow()` 生成的 `GameFlow` + `visSwap()` 的可见性切换 → 展平成 flow/实体字面量 | 纯平移 | deep-equal + 绿 |
| **3** | **商店两段脉冲**(`shop_marks/shop_marks2` destroy-tagged + 重铺,114 标记)→ **删**,改 **GameShell 按 `CardPile.hand` 声明式渲染** | ⚠️**redesign**(非平移,行为会变=不再多拍脉冲)→ deep-equal 不适用,改"商店买/刷/卖 26 测全绿"守 | 行为测 + 绿 |
| **4** | `game-f.tsx`(623 行手写壳 + canvas 假点击桥 x=2000)→ `GAME_F_UI: UILayout` 数据 + `GameShell`;删假点击 | ⚠️redesign | 行为测 + 手验 |
| **5** | 清理对账:脉冲标记归 0;EventWhen/Effect/Flag 回落到合理量级(对照 game-b);非测试码行数大降 | 核账 | 全绿 |

**不动**:`valueFrom` 经济链(10 处,合法跨游戏能力,game-e 亦用)。

---

## 三、执行纪律

1. **一次一片,绿灯才进**;平移片(1/2)拿 deep-equal 兜底,redesign 片(3/4)拿行为测兜底。
2. **片 1/2 先行**(纯平移、低风险、有 deep-equal 安全网)——先证"manifest 化"方法成立;**再啃片 3/4**(redesign、风险高)。
3. 每片单独提交(可回退);提交信息标片号。
4. 引擎一行不改(交办明确);纯 `src/games/game-f` + `data/` + 接 `@ui/shell`。

---

## 四、验收(去腐完成)

- `game-f.manifest.json`(扁平 entities)+ 薄 loader 取代 `buildGameFBlueprint` 生成器;`GAME_F_UI: UILayout` + GameShell 取代 `game-f.tsx` 手写壳;**脉冲标记 = 0**。
- tsc 0 + vitest 全绿(含确定性 hash)+ 商店/战斗/流程行为不变。
- 过"最弱 LLM 能一致产出 manifest 数据"尺子(对齐 game-b)。

> 复诵:去腐 = 把 blueprint.ts 的生成器/脉冲展平成 game-b 式 manifest + 把 game-f.tsx 换成 GameShell UILayout;命门是"片 0 快照守 + 绿灯逐关";平移片先行证方法、redesign 片(商店脉冲/手写壳)后啃;引擎不加能力。
