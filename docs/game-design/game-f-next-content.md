# Game F · 下一步实装需求(主策划提推 · 2026-06-14)

> 由 2 分钟轮询触发:程序员上一段(F-061 斩杀接入)已完成、空闲 ≥74min → 提推下一个内容里程碑。
> ⛔ 全程 game=数据;Boss 招牌**全用现成能力**(group-count / self-rule spawn / over-time / hitbox `executeBelow`),**零引擎改动**。与去腐(blueprint.ts→manifest)**解耦**——本需求只动 `taikou.ts`/`stages.ts`/`combat.ts` 工厂,不碰 blueprint。

## 为什么是这个
现状:太阁只实装了 **4 滩头杂兵(W1–W2)**,没有国人众/Boss/降将 → "攻岛"名不副实、一局太短。F-061 斩杀刚落地 → **谦信/立花/半藏的 Boss 斩杀现可接**。数据**已备**:`game-f-taikou-roster.md` §六(Prefab master 表)+ §七(九州 W1–W6 关卡表)。

## 任务(drop-in,照 roster §六/§七)
1. **`taikou.ts`**:加国人众(`saito/mori/hojo/imagawa/akechi/ishida`)+ ✅类天守 Boss(`nobunaga/hideyoshi/ieyasu/honganji`)的 `TaikouUnit`(code/name/sprite/atkType)。
2. **`stages.ts`**:`PVE_WAVES` 扩 **W3–W6**(国人众 ×3 + 天守 Boss 波;数值见 roster §七)。
3. **`combat.ts`(mob/boss 模板,纯数据装配)**:Boss 招牌映射现成能力——
   - 信长·天下布武 = 全局 buff 资源 + `scaleByResource`;
   - 秀吉·一夜城 / 本愿寺·一揆 = `self-rule spawn` 周期召援军/人海;
   - 家康·忍耐 = `over-time` 自回复 + 反击 hitbox;
   - **谦信/立花/半藏 = strike `execBelow`(F-061 已 done)** 斩杀残血。
4. **降将收编(可选,本里程碑次要)**:Boss `Mortal.dropTemplate:'recruit_<码>'` → 主公拾取入席(roster §四)。
5. **验收**:打到 W6 天守 Boss → 岛陷落通关;贡献度累加全程;`tsc 0 + vitest 绿 + 确定性 hash 不变`。

## 守的纪律
- Boss 招牌**全是现成能力的数据组合**,撞缺口的只有斩杀(F-061 已 done)→ 零新引擎能力。
- 🔴 政宗狙击/岛津绕后(F-062 索敌策略)**本里程碑不做**(Lead 已暂缓);先上 ✅/斩杀类 Boss。
- 真田·决死(自身残血加伤)= self-hp 系数、非 F-061 → **本里程碑跳过**,待单独评估。

> 下一个(本里程碑后):吴 faction 6 英雄入 roster(`game-f-wu-faction-seed.md`,启用白衣渡江)/ 更多牌组。
