# Game F · REQ-F-061(斩杀/处决)落地设计

> 主策划 ｜ 2026-06-14 ｜ F-061 引擎已 done,本文设计**怎么把它用进游戏**(数据落地路径)。
> ⛔ 纪律自检:先问「能不能用纯数据表达,不加新机制?」——**能,所以回驳我自己上轮提的 `hitbox-mod` CardSpec(过度设计)**。executeBelow 是数据,放进单位/职业模板即可。

---

## 〇、引擎已落地的确切契约(已核 `hitbox.ts`)

| 字段 | 语义 | 确定性 |
|---|---|---|
| `Hitbox.requireHpFracBelow` | 仅作用于 hp 比例 **<** 此值的目标(残血技) | 乘法比较 `current < max×frac`(无除法) |
| `Hitbox.requireHpFracAbove` | 仅作用于 hp 比例 **≥** 此值的目标(满血/精英技) | 同上 |
| `Hitbox.executeBelow` | 命中且 hp 比例 < 此值 → **处决清 0**(与 amount 同存;低于线斩、否则常规伤害);处决即 `continue` 跳过常规结算,不双算 | 同上 |

> 都是**目标侧** hp 条件。`关羽斩杀 = Hitbox{ amount, targetMask:ENEMY, executeBelow:0.15 }`(Lead 给的例)。

---

## 一、落地原则:executeBelow 是数据,放「单位/职业模板」,不加新 CardSpec

**回驳上轮自己的 `hitbox-mod` CardSpec 提法**:斩杀不是"卡牌往普攻注入"才能表达——它本就是**某些单位/某个职业的固有招牌**,直接烘进那些单位的 strike/ult 模板数据即可。加一个"卡牌改 hitbox"的通用机制 = 为想象需求拓宽(违 YAGNI)。**只有一个场景真需要它,见 §五,暂缓。**

---

## 二、落地点 A:太阁 Boss 斩杀(模板数据,最便宜)

给 `combat.ts` 的 `strike()` / `ultTemplate()` 工厂加一个**可选** `execBelow?` 入参 → 透传到 `Hitbox.executeBelow`(缺省 undefined = 零迁移)。然后在 Boss 模板数据里填:

| Boss | 招牌 | 数据 |
|---|---|---|
| `kenshin` 上杉谦信·无双斩 | 斩杀残血 | strike `execBelow: 0.30`(高线=斩杀王) |
| `tachibana` 立花宗茂·雷切 | 对残血斩 | strike `execBelow: 0.20` |
| `hattori` 服部半藏·忍 | 斩后排(执行部分) | strike `execBelow: 0.25`(绕后=F-062 暂缓,执行先上) |

> Boss 波落地时(W6,roster §七)填这几行即可。**纯数据,零新机制。**

## 三、落地点 B:刺客职业 trait(数据,零新 CardSpec,解锁白衣渡江)

让**刺客职业(ASSASSIN)的普攻**自带执行——在 `templatesFor` 生成 strike/projectile 时,按 `h.cls === ASSASSIN` 注入 `execBelow: 0.15`:

```ts
// combat.ts templatesFor 内,生成 strike/proj 时:
const exec = h.cls === ASSASSIN ? 0.15 : undefined;   // 刺客职业 trait = 斩杀残血后排（TFT 式职业身份）
h.atkType === 'melee'
  ? [`strike_${h.id}`, strike(h.enemy, finalAtk(h), fx, scaleId, exec)]
  : [`proj_${h.id}`,   projectile(h.enemy, finalAtk(h), fx, scaleId, exec)];
```

→ **「刺客 = 斩杀残血」成为职业身份**(像 TFT 刺客 trait),纯数据、零新 CardSpec。当前 roster 的 `黄忠`(ASSASSIN)立即获得;未来刺客英雄自动继承。

## 四、白衣渡江 deck #3(drop-in 草案)+ ⚠️ roster 前置

斩杀既是刺客职业 trait(§三),**白衣渡江 = 刺客 synergy 牌组**(放大刺客),用**现成 CardSpec**(threshold-buff + shop-weight),**不需要任何新卡类**:

```ts
export const BAIYI_DECK: Deck = {
  id: 'baiyi', name: '白衣渡江', faction: 'shu',
  cards: [
    // 白衣 ⭐：场上刺客 ≥2 → 全队 +18%；≥4 → 再 +22%（刺客成军质变）。斩杀来自职业 trait（§三）。
    { kind: 'threshold-buff', id: 'baiyi', tagMask: BENCH_OCC | ASSASSIN, tiers: [ { at: 2, bonus: 0.18 }, { at: 4, bonus: 0.22 } ] },
    // 锦帆：前 3 回合刺客压制（沿用 round-buff）。
    { kind: 'round-buff', id: 'jinfan', untilRound: 3, bonus: 0.12 },
    // 募刺：商店刺客码加权（待 roster 扩充刺客后填码）。
    { kind: 'shop-weight', id: 'muci', codes: [/* 刺客英雄码 */], copies: 3 },
  ],
};
```

> ⚠️ **roster 前置(诚实账)**:现 roster **只有黄忠 1 个刺客**(蜀),魏 0 个 —— 刺客 synergy 凑不齐。**白衣渡江要成立,需先给 roster 加 2–3 个刺客英雄**(吕蒙/甘宁/马超改刺客…)。这是和「桃园缺刘备」同类的 roster-reality 前置:**deck 草案先放着,补完刺客英雄数据再启用**。

## 五、唯一真需 `hitbox-mod` 的场景 = 暂缓(YAGNI)

只有「**卡牌动态抬高执行线**」(如「渡江」星球牌:把斩杀线 0.15→0.25)才需要往模板**注/改** executeBelow —— 这是 hitbox-mod 唯一真用例。**暂缓**:等真做星球牌强化、且证明"换个高 execBelow 的 strike 模板变体"绕不过去时,再评估下沉 hitbox-mod。**现在不做。**

## 六、修正:真田决死 ≠ F-061(分类纠错)

roster §六 把 `yukimura 真田幸村·六文钱「自身残血伤害递增」` 标了 🔴 F-061。**错**:F-061 是**目标侧** hp 条件;真田是**攻击者自身** hp 越低伤害越高 = self-hp 系数(scaleByResource 读自身 hp,per-unit),**属另一机制**,F-061 给不了。→ 真田的标注应改为「self-hp 系数(待评估,非 F-061)」;它的落地走"自身 hp → 伤害系数"的路,与虎豹 buff 同族但 per-unit,届时单独评估。

---

## 七、验收(F-061 落地)

1. `strike()/projectile()/ultTemplate()` 加可选 `execBelow?` 透传 `Hitbox.executeBelow`(缺省零迁移)。
2. 刺客职业 trait:`黄忠` 普攻对 hp<15% 敌处决(加一测:残血敌被秒)。
3. (Boss 波落地时)谦信 `execBelow:0.30` 斩杀测。
4. tsc 0 + vitest 绿 + 确定性 hash 不变。

> 复诵:executeBelow 是数据,落在「太阁 Boss 模板」+「刺客职业 trait」,零新 CardSpec;白衣渡江=刺客 synergy(现成卡类),但 gated 在 roster 补刺客;hitbox-mod 仅"卡牌抬高执行线"才需,YAGNI 暂缓;真田是 self-hp 系数、非 F-061(已纠错)。
