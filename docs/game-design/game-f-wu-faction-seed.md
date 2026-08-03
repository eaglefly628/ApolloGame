# Game F · 吴(孙)faction 刺客核心 · 英雄数据 seed(启用白衣渡江 + 三人征日前置)

> 主策划 ｜ 2026-06-14 ｜ 承 F-061 落地:白衣渡江=刺客 synergy,但其刺客(吕蒙/甘宁)是**吴**不是蜀。
> 故正确落地 = **播种吴 faction 的刺客核心**,而非往蜀硬塞吴将(守"不硬塞、对世界观诚实"纪律,同「桃园缺刘备」)。
> ⛔ 本文是**英雄数据 seed**(drop-in `heroes.ts` HeroSpec 格式)。3-faction 的**布局/选阵营 plumbing** 是多人重构的活(见 §三),本文只交数据。

---

## 〇、为什么是吴、为什么现在

1. **lore 正确**:白衣渡江=吕蒙(吴)、锦帆=甘宁(吴)。刺客职业 trait(F-061 落地 §三:ASSASSIN 普攻自带 executeBelow)的天然集大成者是吴。
2. **三人征日必需**:孙刘曹三方 → 吴(孙)faction 早晚要做;现在播种刺客核心,顺势把白衣渡江盘活。
3. **纯数据**:6 条 HeroSpec,不发明机制;斩杀走已 done 的 F-061 职业 trait。

> 备选(若想在现 2-faction v1 里更快见到白衣渡江):给蜀加 1–2 个 lore 勉强的刺客(如魏延)。**不推荐**——魏延当刺客牵强,且吴 faction 反正要做。

---

## 一、吴 faction 英雄数据(drop-in `heroes.ts`,4 刺客 + 1 谋 + 1 将)

> 字段对齐现 `HeroSpec`。`team/enemy/q/r` 由 3-faction 布局定(§三),此处留占位 `TEAM_C`/待定。数值=首版待平衡,对齐现 roster 量级(刺客=低血高攻,如黄忠 hp130/atk22)。

| id | 名 | cls | hp | atk | atkType | 大招 ult | ultDmg | ultSize | ultFx | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|
| `c_lvmeng` | 吕蒙 | **ASSASSIN** | 150 | 20 | melee | 白衣渡江(突后排斩残血) | 55 | 50 | STRIKE | 队长级刺客;斩杀走 F-061 职业 trait |
| `c_ganning` | 甘宁 | **ASSASSIN** | 135 | 23 | melee | 百骑劫营(冲阵连斩) | 50 | 55 | STRIKE | 锦帆游侠,高攻脆皮 |
| `c_taishici` | 太史慈 | **ASSASSIN** | 130 | 22 | ranged | 神射(锁后排) | 52 | 45 | ARROW | 远程刺客(绕后=F-062 暂缓,执行先上) |
| `c_lingtong` | 凌统 | **ASSASSIN** | 145 | 19 | melee | 旋身突阵 | 48 | 52 | STRIKE | 凑满 4 刺客成军 |
| `c_zhouyu` | 周瑜 | TACTICIAN | 125 | 23 | magic | 火烧赤壁(范围灼烧) | 38 | 92 | FLAME(ultDot) | 吴谋核心;DoT 走现成 over-time |
| `c_sunce` | 孙策 | WARRIOR | 210 | 15 | melee | 小霸王(冲锋) | 50 | 70 | STRIKE | 前排坦,护刺客 |

> 4 个 ASSASSIN(吕蒙/甘宁/太史慈/凌统)→ 刚好支撑白衣渡江「场上刺客 ≥2 / ≥4」两档阈值。

---

## 二、白衣渡江 deck #3 补全 codes(承 f061-landing §四)

吴 faction 落地后,刺客码填上:

```ts
export const BAIYI_DECK: Deck = {
  id: 'baiyi', name: '白衣渡江', faction: 'wu',
  cards: [
    // 白衣 ⭐：场上刺客 ≥2 → +18%；≥4(成军) → 再 +22%。斩杀来自刺客职业 trait(F-061,已 done)。
    { kind: 'threshold-buff', id: 'baiyi', tagMask: BENCH_OCC | ASSASSIN, tiers: [ { at: 2, bonus: 0.18 }, { at: 4, bonus: 0.22 } ] },
    { kind: 'round-buff', id: 'jinfan', untilRound: 3, bonus: 0.12 },                  // 锦帆:序盘压制
    { kind: 'shop-weight', id: 'muci', codes: [/* 吴刺客码,见 codesFor(rosterFor('wu')) */], copies: 3 },
  ],
};
```
> 依赖:① F-061 职业 trait(已 done,f061-landing §三);② `threshold-buff` 扩展(deck2-hanshi §二);③ 吴 faction(本文 + §三 plumbing)。前两个就绪,差吴 faction。

---

## 三、3-faction plumbing 依赖(给主程,非本文范畴)

吴英雄数据本身即插即用,但要真打起来,需多人重构里这几件(N阵营架构,`game-f-coop-sunliu.md` §一已立原则):
- `constants.ts` 加 `FACT_WU` 势力位(现有 FACT_SHU/WEI)。
- `heroes.ts` `rosterFor`/`swapFactions` 从「2 faction 镜像」升级为「3 faction 选位」(team/enemy 由对局拓扑定,不再写死 A↔B)。
- 布局:三方 120° 阵地(`game-f-coop-sunliu.md` §三)给吴一个 sector → 填 q/r。
- 选阵营 UI:蜀/魏/吴三选(大厅 S2 已画三席)。

> 这些是**多人重构的活**,与 F-061 落地解耦。**吴英雄数据可先落库待命**(放 heroes.ts 不接线不影响现 2-faction v1),plumbing 到位即启用。

---

## 四、验收

1. 6 条 HeroSpec 落 `heroes.ts`(`FACT_WU` + cls/atkType/大招数值)。
2. F-061 刺客职业 trait 自动覆盖这 4 刺客(对 hp<15% 敌处决)。
3. (plumbing 后)选吴 → 装白衣渡江 → 上 4 刺客 → 斩杀残血敌 + threshold buff 生效。
4. tsc 0 + vitest 绿 + 确定性 hash 不变。

> 复诵:白衣渡江的刺客是吴不是蜀——正确落地=播种吴 faction 刺客核心(6 英雄数据),而非往蜀硬塞。斩杀走 F-061 已 done 的职业 trait;deck 三依赖只差吴 faction;3-faction plumbing 是多人重构的活,数据可先落库待命。
