# Game F · 装备系统 策划案(owner 2026-06-16;Designer F → Program F)

> owner 要:三国道具大库(武器/盔甲/名马/饰品,参考《力网三国》数量级)+ WoW 式品级 + 拾取 tooltip(全属性/功效/描述)+ **拖拽实时装备到武将** + **点击拆解卸除**。**今天落地,Program F 实现。**
> ⛔ 全纯游戏侧、**零引擎**(重组现有 drag-place / 席位 marker / heroOverrides 烘数值 / sumItem / 拾取栏)。引擎层不加能力。

---

## 〇、现状(已核代码,建在其上不重复)
- **有**:`ITEMS`(heroes.ts,3 件,仅 `{name,hp,atk}`,装配期 `sumItem` 静态加进 `finalHp/finalAtk`);敌将死掉装备 orb(📦,`EQUIP` tag)→ 主公拾取 `items` 资源 +1;HUD「装备·战利品 0/8」格。
- **缺(本案补)**:① 品级 ② tooltip ③ 拖拽装备到武将 ④ 拆解卸除 ⑤ 道具大库。
- **引擎**:无 item/equip/inventory 能力 → **全重组**(零引擎)。

## 一、Item schema(扩 `ITEMS`,纯数据)
```ts
type Slot = 'weapon' | 'armor' | 'mount' | 'trinket';
type Rarity = 'white' | 'green' | 'blue' | 'purple' | 'orange';
interface ItemDef {
  id: string; name: string; slot: Slot; rarity: Rarity;
  stats: { hp?: number; atk?: number; atkSpd?: number; crit?: number; move?: number }; // 加成(装备烘进武将)
  effect?: string; // 功效(特效文案;v1 数值为主,特效后续接锦囊式 caster)
  desc: string;    // 描述(flavor,tooltip 显示)
  icon?: string;   // 美术 key(缺省占位)
}
```
> 「加道具 = 加一行数据」,最弱 LLM 可产 → 过宪法尺子。下方 §三是首批库,**可无限扩**。

## 二、品级(WoW 色阶 + 数值倍率)
| 品级 | 色 | 数值倍率(基准×) | 掉率(太阁越深越好) |
|---|---|---|---|
| 白 white | ⚪ 灰白 | 1.0 | 高 |
| 绿 green | 🟢 | 1.6 | 中 |
| 蓝 blue | 🔵 | 2.4 | 低 |
| 紫 purple | 🟣 | 3.4 | 稀有 |
| 橙 orange | 🟠 | 5.0 + 特效 | 极稀(终盘 Boss) |
> tooltip 边框/名字按品级上色;掉落 orb 按品级染色(一眼识好货)。

## 三、道具库:程序化生成(目标 600+ 件)

> owner 要 **600+ 件**。手写 600 行不现实——用**「基底 × 品级 × 词缀」程序化展开**(力网三国/暗黑同制式)+ 命名传说。
> **合规**:基底/词缀/传说 = **扁平数据**;展开器 = **薄确定性函数**(= Lead 已允的 `makeRoundFlow/templatesFor` 同款「扁平数据+薄展开」,"数据驱动≠零函数")。生成的 600+ 件**进 `ITEMS` 表/或运行时展开,皆可**。

### 3.1 基底 bases(~46,每槽一批;含基础 stats + 三国名)
- **武器(18)**:古锭刀/环首刀/长枪/钢枪/宝剑/长剑/画戟/方天戟/战斧/开山斧/铁锤/流星锤/长弓/强弩/铁鞭/双锏/蛇矛/三尖两刃刀 —— 基底 `atk` 8~18(按基底强弱)。
- **盔甲(10)**:皮甲/锦战袍/锁子甲/连环铠/镔铁铠/鳞甲/兽面铠/重铠/软猬甲/藤甲 —— 基底 `hp` 60~200。
- **名马(8)**:西凉马/大宛马/乌骓/黄骠马/白龙驹/踏雪乌/青骢马/银鬃马 —— 基底 `move` 0.1~0.25(+少量 hp/atkSpd)。
- **饰品(10)**:印绶/督军令牌/调兵虎符/兵书/战鼓/帅旗/护心镜/玉佩/锦囊/符箓 —— 基底混合小属性。

### 3.2 品级变体(×5)
每个基底 × {白/绿/蓝/紫/橙},stats × 品级倍率(§二:1.0/1.6/2.4/3.4/5.0),名前缀「破损的/精良的/卓越的/史诗的/传说的」或直接色边。**46 基底 × 5 = 230 件纯净变体。**

### 3.3 词缀 affixes(~12;蓝及以上可挂 1 条,改名+加一维属性)
`锋锐(+atk) · 破军(+crit) · 疾风(+atkSpd) · 奔雷(+move) · 玄武(+hp) · 坚壁(+hp大) · 精钢(+hp+atk) · 饕餮(+吸血/回血) · 赤焰(灼烧) · 寒霜(命中减速) · 百炼(+全属性小) · 无双(高阶混合)`
- 词缀挂在名前:如「破军·青釭剑(蓝)」。**蓝/紫/橙 基底变体 × 可选词缀 ≈ 46×3×~3 = 400+ 件。**
- 特效类词缀(饕餮/赤焰/寒霜)= 走锦囊式 caster/hitbox(后续片;v1 先纯数值词缀)。

### 3.4 命名传说 uniques(固定,~50;橙/紫高光,带专属特效)
**3.5 总量** = 230(品级变体)+ 400+(词缀变体)+ 50(传说)≈ **680 件 ≥ 600。**

> 以下是 **命名传说/样板**(可直接填的 ItemDef,也作展开器的 stats 标尺):

### 武器(weapon,主 +atk/crit/atkSpd)
| id | 名 | 品 | stats | 描述 |
|---|---|---|---|---|
| `w_gudao` | 古锭刀 | 白 | atk+8 | 寻常军刀,聊胜于无 |
| `w_zhanjiang` | 斩将刀 | 绿 | atk+14 | 阵前斩将,见血封侯 |
| `w_qinggang` | 青釭剑 | 蓝 | atk+22, crit+0.1 | 削铁如泥,曹操佩剑 |
| `w_gudingdao` | 七星宝刀 | 紫 | atk+30, crit+0.15 | 王允所赠,孟德献刀 |
| `w_zhangba` | 丈八蛇矛 | 紫 | atk+28, atkSpd+0.1 | 燕人张飞,当阳怒吼 |
| `w_fangtian` | 方天画戟 | 橙 | atk+40, crit+0.2 | 人中吕布,戟指天下(效果:暴击溅射) |
| `w_qinglong` | 青龙偃月刀 | 橙 | atk+44, atkSpd+0.1 | 关云长,温酒斩华雄(效果:斩杀残血) |
| `w_cixiong` | 雌雄双股剑 | 蓝 | atk+18, atkSpd+0.15 | 刘备双剑,攻守兼备 |
| `w_dafu` | 开山大斧 | 绿 | atk+16 | 力士之兵,势大力沉 |
| `w_liuxing` | 流星锤 | 蓝 | atk+20, move+0.1 | 王双绝技,出其不意 |

### 盔甲(armor,主 +hp/减伤)
| id | 名 | 品 | stats | 描述 |
|---|---|---|---|---|
| `a_pijia` | 皮甲 | 白 | hp+60 | 寻常皮护,薄有遮挡 |
| `a_zhanpao` | 锦战袍 | 绿 | hp+110 | 御赐战袍,亦护亦威 |
| `a_huanjia` | 连环铠 | 蓝 | hp+180 | 环环相扣,刀箭难入 |
| `a_bintie` | 镔铁铠 | 蓝 | hp+170, atk+6 | 镔铁锻打,攻守兼备 |
| `a_baiyin` | 白银狮蛮铠 | 紫 | hp+260 | 银光夺目,马超之甲 |
| `a_huangjin` | 黄金锁子甲 | 橙 | hp+360, atk+10 | 黄金织甲,刀枪不入(效果:开战 3s 免控) |
| `a_shoumian` | 兽面吞头铠 | 紫 | hp+240, move+0.05 | 兽面狰狞,慑敌夺魄 |
| `a_tongque` | 铜雀重铠 | 蓝 | hp+200 | 铜雀台造,厚重沉稳 |

### 名马(mount,主 +move/atkSpd)
| id | 名 | 品 | stats | 描述 |
|---|---|---|---|---|
| `m_liangju` | 西凉骏马 | 白 | move+0.1 | 西凉良驹,脚力尚可 |
| `m_dawan` | 大宛宝马 | 绿 | move+0.15, hp+40 | 汗血宝马,日行千里 |
| `m_jueying` | 绝影 | 蓝 | move+0.2, atkSpd+0.05 | 曹操坐骑,快如绝影 |
| `m_zhuahuang` | 爪黄飞电 | 蓝 | move+0.2, hp+60 | 通体雪白,蹄黄如电 |
| `m_dilu` | 的卢 | 紫 | move+0.25, hp+80 | 妨主之马,檀溪一跃 |
| `m_chitu` | 赤兔马 | 橙 | move+0.3, atk+12, atkSpd+0.1 | 人中吕布马中赤兔(效果:冲锋首击暴击) |

### 饰品/宝物(trinket,主 特效/混合)
| id | 名 | 品 | stats | 描述 |
|---|---|---|---|---|
| `t_yinshou` | 印绶 | 白 | hp+30, atk+4 | 微末官印,聊壮声势 |
| `t_lingpai` | 督军令牌 | 绿 | atk+10, atkSpd+0.05 | 督军之令,鼓行而进 |
| `t_bingfu` | 调兵虎符 | 蓝 | hp+90, atk+8 | 虎符在手,兵从将令 |
| `t_bingshu` | 孟德新书 | 蓝 | atk+12, crit+0.1 | 兵法韬略,临阵生智 |
| `t_qimen` | 奇门遁甲 | 紫 | crit+0.2, atkSpd+0.1 | 卧龙所授,鬼神莫测 |
| `t_yuxi` | 传国玉玺 | 橙 | hp+150, atk+15 | 受命于天,既寿永昌(效果:全队 +5% 攻光环) |
| `t_qixing` | 七星灯 | 紫 | hp+120 | 续命禳星,五丈原夜 |
| `t_jinnang` | 锦囊妙计 | 绿 | atkSpd+0.1 | 拆之有计,临危不乱 |
| `t_taiping` | 太平要术 | 橙 | hp+100, atk+12 | 南华老仙,呼风唤雨(效果:开战回血) |
| `t_zhumage` | 诸葛连弩图 | 紫 | atk+20, atkSpd+0.15 | 一弩十矢,机巧无双 |
| `t_huxinjing` | 护心镜 | 绿 | hp+80 | 护住要害,临阵心安 |
| `t_hujiu` | 虎贲腰牌 | 蓝 | hp+100, atk+6 | 虎贲卫士,以一当十 |

> 36 件覆盖 4 槽 × 5 品。**橙装带特效**(暴击溅射/斩杀/免控/光环/回血)——v1 先做**数值**,特效文案先挂、机制走锦囊式 caster 后续接。数值首版待 owner 真机调。

## 四、机制(派 Program F;全重组,零引擎)

### 4.1 拾取 + tooltip(必做)
- 掉落 orb 按**品级染色**;拾取入「装备·战利品」栏(现成,扩成显品级色 + 图标)。
- **hover tooltip**:鼠标移到道具(栏内 or 武将身上)→ DOM 浮层显 **名(品级色)+ 槽位 + 全属性 + 功效 + 描述**。纯前端读 `ItemDef`。

### 4.2 拖拽实时装备到武将(金铲铲核心)
- **从战利品栏拖道具 → 落到场上/备战席的武将 marker** → 该 marker 的 `equipped:[itemId…]`(≤3 件,金铲铲制)+= 此道具。
- **生效**:武将**部署进战斗时**,把 equipped 的 stats **烘进单位**(扩 `heroOverrides`:`finalHp/finalAtk += Σ装备`,= 现有 star 倍率同管道)。"实时"= 拖上即显在 marker、**下次开战即生效**(金铲铲就是这样;避开"战斗中改活属性"的引擎缺口)。
- 复用:`drag-place`(已有拖拽)+ 席位 marker(REQ-F-049)+ heroOverrides 烘值(star 同款)。

### 4.3 拆解/卸除(owner:不做专门物件,点击剥离)
- **点击武将身上的某件装备**(或武将的装备槽)→ **拆解**:该装备从 marker `equipped` 移除 → 退回战利品栏(或化材料/金,owner 定;v1 先**退回栏**)。
- 复用:`clickable` + state(同卖出/`@signal-source` 链)。

## 五、数据驱动/重组分析(零引擎,先重组纪律)
| 件 | 怎么做 | 引擎? |
|---|---|---|
| 道具库 + 品级 | 扩 `ITEMS` 数据(§一 schema + §三库) | 纯数据 |
| tooltip | DOM 浮层读 ItemDef | 表现层 |
| 拖拽装备 | `drag-place` 落到 marker → marker.equipped 数据 | 重组 |
| 装备生效 | heroOverrides 烘 Σ装备 stats(star 同管道) | 重组 |
| 拆解 | clickable + `@signal-source` 退回栏 | 重组 |
| 橙装特效(暴击溅射/斩杀/光环…) | 走锦囊式 caster/hitbox(F-061 斩杀已 done)**后续片** | 重组 |
> **全程零引擎、零新 capability。** 真撞表达不了的(如"装备实时改战斗中活属性")→ 走"烘进下次部署"绕过(金铲铲语义),不拓引擎。

## 七、★ 可誊写数据清单(Program F 直接落库,零设计决策)

> owner 锁:**命名传说 = 50**(够记忆点;其余靠程序化凑 600+)。下表把 §三的"范围/名字"钉成**确定数值 + 确定算法**,Program F 誊写即可,不必再设计。

### 7.1 基底表 BASES(46;每行 = `{id, name, slot, base}`)
> `base` = 白品(×1.0)裸数值;品级倍率在 7.3 统一乘。

**weapon(18,主 atk;少量 atkSpd/crit)**
```
wb_gudingdao 古锭刀   atk8     | wb_huanshou 环首刀  atk9
wb_changqiang 长枪    atk11    | wb_gangqiang 钢枪   atk12
wb_baojian 宝剑       atk10    | wb_changjian 长剑   atk11
wb_huaji 画戟         atk13    | wb_fangtianji 方天戟 atk15,crit0.05
wb_zhanfu 战斧        atk14    | wb_kaishanfu 开山斧 atk16
wb_tiechui 铁锤       atk15    | wb_liuxingchui 流星锤 atk13,move0.05
wb_changgong 长弓     atk10,atkSpd0.05 | wb_qiangnu 强弩 atk12,atkSpd0.08
wb_tiebian 铁鞭       atk11    | wb_shuangjian 双锏  atk12,atkSpd0.05
wb_shemao 蛇矛        atk14,atkSpd0.05 | wb_sanjian 三尖两刃刀 atk15
```
**armor(10,主 hp)**
```
ab_pijia 皮甲 hp60 | ab_zhanpao 锦战袍 hp90 | ab_suozi 锁子甲 hp120
ab_lianhuan 连环铠 hp150 | ab_bintie 镔铁铠 hp140,atk4 | ab_linjia 鳞甲 hp130
ab_shoumian 兽面铠 hp160 | ab_zhongkai 重铠 hp200 | ab_ruanwei 软猬甲 hp110,crit0.05 | ab_tengjia 藤甲 hp170
```
**mount(8,主 move;少量 hp/atkSpd)**
```
mb_xiliang 西凉马 move0.10 | mb_dawan 大宛马 move0.12,hp40
mb_wuzhui 乌骓 move0.14 | mb_huangbiao 黄骠马 move0.13,hp50
mb_bailong 白龙驹 move0.15 | mb_taxue 踏雪乌 move0.14,atkSpd0.05
mb_qingcong 青骢马 move0.12 | mb_yinzong 银鬃马 move0.13
```
**trinket(10,混合小属性)**
```
tb_yinshou 印绶 hp30,atk4 | tb_lingpai 督军令牌 atk8,atkSpd0.05
tb_hufu 调兵虎符 hp80,atk6 | tb_bingshu 兵书 atk10,crit0.08
tb_zhangu 战鼓 atk8,atkSpd0.05 | tb_shuaiqi 帅旗 hp60,atk6
tb_huxinjing 护心镜 hp80 | tb_yupei 玉佩 hp50,atkSpd0.05
tb_jinnang 锦囊 atkSpd0.08 | tb_fulu 符箓 hp40,crit0.08
```

### 7.2 品级前缀 + 倍率
```
white  破损的  ×1.0   | green 精良的 ×1.6 | blue 卓越的 ×2.4
purple 史诗的 ×3.4   | orange 传说的 ×5.0(+特效位)
```
> 命名:程序化件 = `前缀 + 基底名`(白品免前缀)。如 `卓越的·画戟(蓝)`。数值 = `round(base.stat × 倍率)`(move/crit/atkSpd 保留 2 位小数)。

### 7.3 词缀表 AFFIXES(12;蓝及以上挂 ≤1 条,改名+加一维)
```
锋锐 +atk(×0.5基底atk) | 破军 +crit0.08 | 疾风 +atkSpd0.08 | 奔雷 +move0.06
玄武 +hp(×0.4基底hp或+60) | 坚壁 +hp(×0.8基底hp或+120) | 精钢 +hp40+atk5
百炼 +全维各×0.2 | 无双 +atk8+crit0.08+atkSpd0.05(仅紫/橙)
饕餮[特效:吸血] | 赤焰[特效:灼烧] | 寒霜[特效:减速]   // 特效类 v1 仅挂文案,机制后续锦囊式 caster
```
> 命名:`词缀 + · + 品级件名`,如 `破军·卓越的画戟(蓝)`。词缀只加在 blue/purple/orange 变体上。

### 7.4 展开器算法 expandItems()(薄确定性函数,合规同 makeRoundFlow)
```
按固定顺序(BASES 数组序 × RARITIES 序 × AFFIXES 序)遍历,纯映射,无随机:
1) for base in BASES, for rarity in RARITIES:
     纯净变体 id=`${base.id}_${rarity}`  stats=round(base.base × mul[rarity])
     → 230 件
2) for base in BASES where rarity∈{blue,purple,orange}, for affix in AFFIXES(数值类9条):
     词缀变体 id=`${base.id}_${rarity}_${affix.id}`  stats=纯净 + affix.delta
     → 46×3×9 ≈ 已超 600,取前 ~400 落库(或全展开运行时,二者皆合规)
3) UNIQUES(7.5,50 件固定)直接并入。
合计 230 + 400+ + 50 ≈ 680 ≥ 600。✅
```
> 掉落 roll:`pickRarity(太阁深度) → pickBase(slot) → maybeAffix(rarity)` 拼 id 取件。展开是**纯函数**,确定性 hash 不破(同 seed 同结果)。

### 7.5 命名传说 UNIQUES(50,固定;§三已列 36,补足 14)
> §三 表内 36 件为前 36;下面补 14 件凑满 50(均带专属特效文案,机制后续接):
```
w_yitian 倚天剑 橙 atk46,crit0.18  曹操配剑,镇军威(效果:开战全队+atk)
w_gulou 古锭巨阙 紫 atk32           越王遗兵,断金切玉
w_sanjian 三尖刀 蓝 atk24,atkSpd0.08 二郎遗制,刃开三锋
a_lianhuanma 连环马铠 紫 hp250,move-0.0 铁骑连环,势不可当
a_jinsuo 黄金锁子 橙 hp340,atk8    刀枪不入,马超之甲(效果:开战免控3s)
a_tengjiawang 藤甲王 紫 hp230      刀箭难入畏火(效果:受火伤+,余减伤)
m_dawanwang 千里大宛 紫 move0.26,hp70 汗血神驹,日行千里
m_zhaoyemulan 照夜玉狮子 橙 move0.30,atk10 赵云白马,长坂七进出(效果:冲锋暴击)
t_chuanguo 传国玉玺 橙 hp150,atk15 受命于天(效果:全队+5%攻光环)
t_taipingyaoshu 太平要术 橙 hp100,atk12 南华老仙(效果:开战回血)
t_dunjia 奇门遁甲 紫 crit0.20,atkSpd0.10 卧龙所授,鬼神莫测
t_liannu 诸葛连弩图 紫 atk20,atkSpd0.15 一弩十矢,机巧无双
t_qixingdeng 七星灯 紫 hp120       续命禳星,五丈原夜
t_dujiang 督将虎贲 蓝 hp100,atk6   虎贲卫士,以一当十
```
> ⚠️ id 与 §三 已有件去重(上表为新增,§三的 `w_qinglong/m_chitu/w_fangtian` 等保留)。最终 UNIQUES = §三 36 + 上 14 = 50。橙紫特效 v1 仅文案,数值生效;特效机制走 §五「后续片」锦囊式 caster。

## 六、验收
1. 道具库经 §七 展开器达 **600+ 件**带品级(50 命名传说 + 程序化变体);掉落 orb 染品级色。
2. hover 任意道具 → tooltip 显名/品级/属性/功效/描述。
3. 战利品栏拖道具 → 落武将 marker → 下次开战该武将属性按装备提升(≤3 件)。
4. 点武将装备 → 拆解退回栏。
5. tsc + vitest + build 全绿、零引擎、确定性 hash 不变(装备烘值在部署拍,不破回放)。

> 复诵:装备 = 数据(库+品级)+ 现成机制重组(drag-place/marker/heroOverrides/clickable);tooltip 表现层;"实时装备"= 拖上即显、下次开战生效(避活属性缺口);拆解=点击退栏。零引擎。
