# Game F · 牌组 #2「兴复汉室」(蜀·连携)+ `threshold-buff` 扩展 spec

> 主策划 ｜ 2026-06-14 ｜ 承 v1 绿 + ③ 通过,点第二套牌组 drop-in `decks.ts`,顺带它暴露的**一个干净小扩展**。
> ⛔ 仍是数据 + 复用现成 capability;扩展是给 `decks.ts`(游戏层,非引擎)加一个 CardSpec union 成员 + 一段 `buildDeckRules` 分支,**零引擎改动**。

---

## 〇、roster 现实修正(先说清楚,免得照搬 10 套表)

`game-f-deck-spec.md` §2 原写「桃园结义=刘关张」。**核对 `heroes.ts`:roster 无刘备**(蜀 6 将 = 关羽/赵云/诸葛亮/张飞/马超/黄忠)。
→ 桃园(刘关张)落不了地;但**五虎上将(关·张·赵·马·黄)五个全在**。故 deck #2 改做**「蜀·连携 threshold」**(场上蜀越多越强,满编质变),既贴现有英雄、又正好需要并验证 `threshold-buff` 扩展。**符合宪法纪律:对着真实数据改,不硬塞不存在的英雄。**

---

## 一、牌组数据(drop-in `decks.ts`,默认蜀玩家的起手组)

```ts
// 兴复汉室（蜀·连携）：场上蜀越多越强，满编(5)质变。与「虎豹铁骑」(魏·速攻)对称——一势力一起手组。
export const HANSHI_DECK: Deck = {
  id: 'hanshi',
  name: '兴复汉室',
  faction: 'shu',
  cards: [
    // 桃园誓 ⭐：在板蜀 ≥3 → 全队 +20%；≥5(满编) → 再 +25%（兴复质变）。banded 阈值，开战锁存。
    { kind: 'threshold-buff', id: 'taoyuan', tagMask: BENCH_OCC | FACT_SHU, tiers: [ { at: 3, bonus: 0.20 }, { at: 5, bonus: 0.25 } ] },
    // 章武：前 3 回合伤害 +12%（序盘不被速攻压死）。
    { kind: 'round-buff', id: 'zhangwu', untilRound: 3, bonus: 0.12 },
    // 募贤：商店蜀码加权（蜀将各多 2 张洗入牌袋）。
    { kind: 'shop-weight', id: 'muxian', codes: [1, 2, 3, 4, 5, 6], copies: 2 },
  ],
};
```
> `BENCH_OCC | FACT_SHU` 与「虎豹铁骑」`BENCH_OCC | FACT_WEI` 同形(数在板 marker 的势力位);`round-buff`/`shop-weight` 是 v1 已实现的现成 kind。**唯一新东西 = `threshold-buff`(下节)。**

---

## 二、`threshold-buff` 扩展 spec(给主程,零引擎改动)

**它是什么**:连携/羁绊的通用形——「场上某 tag 数**越阈值**→阶梯 banded buff」。区别于 v1 已有的 `synergy-buff`(线性 perUnit×count):**连携要的是"够 N 个才质变"的阈值台阶**,不是线性。

**①`decks.ts` CardSpec union 加一员:**
```ts
| { kind: 'threshold-buff'; id: string; tagMask: number; tiers: { at: number; bonus: number }[] }
```

**②`buildDeckRules` 加一分支(和现有 synergy-buff/round-buff 同构,全复用):**
```ts
} else if (card.kind === 'threshold-buff') {
  const cr = `deck_count_${card.id}`;
  ents[`gc_${card.id}`]  = { GroupCount: { countResource: cr, requiredTag: card.tagMask, onBoard: true } };
  ents[`r_${cr}`]        = { Resource: { id: cr, current: 0, min: 0, max: 99 } };
  card.tiers.forEach((t, k) => {                       // 每档一个 banded EventWhen→Effect（同 round-buff 写法）
    const sig = `${card.id}_t${k}`;
    ents[`when_${sig}`] = { EventWhen: { signal: sig, when: { kind: 'and', of: [combat, { kind: 'resource', id: cr, cmp: 'gte', value: t.at }] }, mode: 'edge', armed: false } };
    ents[`eff_${sig}`]  = { Effect: { onSignal: sig, kind: 'modify-resource', targetId: 'dmg_scale_a', op: 'add', value: t.bonus } };
  });
}
```

**为什么零引擎改动**:逐能力都在货架上 ——
- `GroupCount{countResource, requiredTag}`(REQ-022 done,= synergy-buff 同款)
- `EventWhen{when:and(combat, resource≥at), mode:edge}`(= round-buff 同款,只是把 `round_idx≤N` 换成 `deck_count≥at`)
- `Effect{add dmg_scale_a, value:bonus}`(banded,= round-buff 同款)
- 锁存 + dmg_scale_a 复位 = prep onEnter 既有纪律,不另管。

→ **`threshold-buff` = synergy-buff 的计数 + round-buff 的 banded 阈值,拼出来的,不发明能力。** 过宪法尺子(最弱 LLM 能产出 `{at,bonus}` 数组)。

---

## 三、(可选)五虎精确版 refinement —— 暂不做(YAGNI)

上面 `tagMask: FACT_SHU` 数的是**全蜀(含诸葛亮)**。若要严格「五虎(关张赵马黄,排除诸葛)」:给那 5 个英雄加一个 `WUHU` tag 位(`constants.ts` 加位 + `heroes.ts` 那 5 条 + `combat.ts` heroOverrides 的 `Tag.flags` OR 进去)。
**判定:暂不做。** 蜀连携用全蜀已够好玩、且零额外改动;严格五虎是风味精修,等真有平衡需要再加(YAGNI,守纪律)。

---

## 四、验收

1. CardSpec 加 `threshold-buff` + buildDeckRules 分支 + `HANSHI_DECK` 常量(约 12 行)。
2. 装 `HANSHI_DECK` → 备战买蜀将,上 3 个蜀 → 开战全队 +20%;上满 5 个 → +45%。
3. `decks.test.ts` 加一例(同 hubao 测法:数 count 资源 + 开战后 dmg_scale_a 值)。
4. tsc 0 + vitest 绿 + 确定性 hash 不变。

> 复诵:deck #2 贴现实改成蜀连携(roster 无刘备);唯一新东西 `threshold-buff` = 现成 GroupCount+EventWhen(edge,and)+Effect 拼装,零引擎改动;五虎精确版守 YAGNI 暂不做。**牌组系统就此证明能从虎豹(魏速攻)扩到蜀连携两种范式。**
