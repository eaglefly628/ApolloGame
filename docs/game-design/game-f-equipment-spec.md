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

## 三、道具库(首批 36 件;数据,可直接填 `ITEMS`,可继续扩)

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

## 六、验收
1. `ITEMS` 扩到 36+ 件带品级;掉落 orb 染品级色。
2. hover 任意道具 → tooltip 显名/品级/属性/功效/描述。
3. 战利品栏拖道具 → 落武将 marker → 下次开战该武将属性按装备提升(≤3 件)。
4. 点武将装备 → 拆解退回栏。
5. tsc + vitest + build 全绿、零引擎、确定性 hash 不变(装备烘值在部署拍,不破回放)。

> 复诵:装备 = 数据(库+品级)+ 现成机制重组(drag-place/marker/heroOverrides/clickable);tooltip 表现层;"实时装备"= 拖上即显、下次开战生效(避活属性缺口);拆解=点击退栏。零引擎。
