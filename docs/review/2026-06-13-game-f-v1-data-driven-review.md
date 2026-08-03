# Game F v1 核心战斗 · 「游戏=数据」合规 Review(③)

> 主策划 ｜ 2026-06-13 ｜ 对 v1 实现(T1–T5,提交 `3789fdc`/`36cc901`/`05b08ee` 等)的符合性审查。
> 触发:用户 ③「等 v1 跑绿后 review 实现是否守住"游戏=数据"」。**结论:跑绿 + 守住。**

---

## 一、跑绿(已亲验)

- `npx tsc --noEmit` → **exit 0**。
- `npx vitest run games/game-f` → **39/39 passed**(6 文件),含:
  - 确定性 hash(同初值重跑 hash 一致);
  - 战斗涌现链(aggro+grid-move+timer→event-when→caster→hitbox 两队对冲);
  - 大招(over-time 回蓝→SelfRule 蓝满放招,全 per-instance 不串台);
  - **T3/T4「每波累加贡献;攻岛满 100=岛陷落→通关」**(= `game-f-contribution-system.md` 设计)。

## 二、守住「游戏=数据」(逐文件核读)

| 文件 | 结论 | 依据 |
|---|---|---|
| `decks.ts`(T2/T5) | ✅**模范** | 牌组=数据(`CardSpec` union);`buildDeckRules` 把每张卡**物化成现成 capability 规则实体**(GroupCount/EventWhen/Effect/shop-weight),**零发明能力**。且用 **EventWhen edge 开战锁存**(TFT 语义,优于我文档担心的 live 计数),复用蜀魂 bond 成熟模式 |
| `taikou.ts`(T1) | ✅ | 纯数据 records(code/name/sprite/atkType)+ 复用战斗词汇;数值在 `stages.ts` 数据 |
| `combat.ts` | ✅(见小观察) | 408 行**全是 `PrefabTemplate` 工厂 + `templatesFor` 装配**;**无 `defineCapability`、无 per-tick execute、无手写战斗 UI**(血条=`Gauge`、结算面板=`TextBinding`、特效=`Tween`,皆数据实体交引擎渲染) |
| `economy.ts`/`stages.ts`/`heroes.ts` | ✅ | 纯数据叶子(数值表/英雄 spec) |

**提交均标「零引擎改动 / 纯数据装配」——核读属实,`src/{engine,skills}` 未被游戏层改动。**

## 三、关键一致性确认

- 「虎豹骑令」buff 实现链 = `GroupCount→deck_count 资源→EventWhen edge→Effect valueFrom→dmg_scale_a→hitbox.scaleByResource`,**与 `game-f-v1-data-pack.md` §六 修正后的配方一致**,且用 edge 锁存比我原稿的 live 计数更对(TFT 开战锁存语义)。
- 缺口 REQ-F-061/062 **v1 未触碰**(虎豹铁骑零缺口依赖)——符合 `game-f-core-combat-dev.md` 的不阻塞设计。

## 四、一处小观察(非违规,记账)

`combat.ts` 是 408 行**装配代码**(工厂函数生成 `PrefabTemplate` 数据),属宪法说的「**趋近**纯数据」的装配层,不是字面数据表。**可接受**:① 它只**产出数据**、不含任何 system/execute,过「最弱 LLM 能否产出这些数据」的尺子;② 是项目一贯做法(blueprint 装配层);③ 强行外化成纯数据表是 YAGNI。**远期**若工厂分支膨胀,可把 hero/mob 的模板参数进一步数据表化,但**现在不必**。

## 五、裁决

> ✅ **v1 通过**:跑绿(tsc 0 + 39 测)、守住「游戏=数据」(无游戏层 system / 无手写战斗 UI / 牌组与太阁皆数据 + 薄加载器)、贡献/攻岛闭环工作、确定性 hash 绿。
> **可以在此基线上继续**:接更多牌组(待 loader 契约已验,可放心铺)、太阁国人众/Boss(数据已备,roster §六/§七)、缺口 REQ-F-061/062(交主程评估后接 🔴 流派与 Boss)。

---

## 勘误（Lead 复核，2026-06-14）：本审查范围只覆盖 v1 牌组切片，漏判「第二种死法」

本审查对象是 v1 卡牌 T1–T5（`decks.ts`/`taikou.ts`/`combat.ts` 工厂），对**这一切片**的判定成立（叶子数据干净、无游戏 system、无手写战斗 UI）。但它**未覆盖 `blueprint.ts`**（flow/经济/商店/UI 编排），第二种死法藏在那里：

- 数据驱动有两种死法：① 游戏层写 system 代码（本审查查了，game-f 确无）；② **"数据"其实是元编程 + 多拍脉冲编排**（本审查未查）。
- 实测 game-f 整体（含 `blueprint.ts`）：非测试码 **2658 行**、生成器构造 **56 处**、**两段脉冲标记 114 个（其余 5 游戏合计 0）**、EventWhen×39 / Effect×115 / Flag×78（对照 game-b：0/6/5）。这部分**过不了** §4 引用的"最弱 LLM 能产出这些数据"尺子。
- 故修正：**「v1 牌组切片通过」属实；「整个 game-f 守住游戏=数据」不成立**——`blueprint.ts` 是全项目臃肿离群点。§4 把"工厂装配层趋近纯数据"判为可接受是对的，但**多拍脉冲状态机不属"装配层"，是真·在数据里编程**，二者要分开看。
- 去腐交办见 `docs/workflow/requests.md` 的 `LEAD→PF · 2026-06-14`（照 game-b 改 manifest + 接 GameShell；纯游戏侧，引擎不加能力）。
