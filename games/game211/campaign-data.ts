// Game G · 战役 + 地煞 + 开场故事 + 天罡解锁数据（doc23 §八/§九·拆分自 blueprint.ts·自包含·无 blueprint 反向依赖）。


// ── T-G5 · 战役 / run 结构（design/11）──
// 一个 run = 5 场连战 + 3 命线：输一场扣 1 命，命尽=结束，打穿 5 场=通关。
// 战役曲线：敌方 favor 偏置逐场升，终局第 5 场=Boss 牌王座(更强 + 起手干预)。场间养成另在 mount。
export const RUN_BATTLES = 5;
export const RUN_LIVES = 3;
const BATTLE_LABELS = ['序战 · 杂兵', '前哨 · 偏师', '中军 · 名将', '精锐 · 机关', '终局 · 牌王座 BOSS'];
export interface BattleSpec { enemyBias: number; boss: boolean; label: string }
/** 第 i 场(0-based)的敌军强度/是否 Boss。敌 favor 偏置逐场升(-10,-5,0,5)，终局 Boss 额外 +8(=18,牌王座)。 */
export function battleSpec(i: number): BattleSpec {
  const boss = i >= RUN_BATTLES - 1;
  return { enemyBias: -10 + i * 5 + (boss ? 8 : 0), boss, label: BATTLE_LABELS[i] ?? `第 ${i + 1} 战` };
}

// === 战役·关 1-5 新手区（doc23 §八 定稿 · owner 2026-06-19「人物名气>战役名气」· 头三关简单） ===
// 每关 = 一位名将困在其命运之战；打赢=破诅咒、解封其魂。Boss 牌库=12 随机天罡 + 3 专属地煞(招牌历史战术·明牌可破)。
// 节奏：关1-3 简单(地煞弱/少触发) → 关4-5 放威力；每关通关解锁 1 张天罡。sim 基准胜率 关1~80%→关5~55%。
export interface StageFiend { name: string; desc: string } // 地煞=Boss 招牌历史战术（明牌介绍）
export interface StageBossLines { open: string; mid: string; lose: string } // Boss 对白：开场/劣势/败北（doc27 §五）
// 明牌 counter-pick 情报（boss-config-1-5 §五·五·「核心乐趣」）：Boss 牌组主题 + ≤5 明牌天罡(克制靶·张数随关爬 2/3/3/4/5) + 克制提示。
export interface StageCampaign { stage: number; boss: string; battle: string; oneLiner: string; stars: number; fiends: StageFiend[]; unlock: string; intro?: string; bossLines?: StageBossLines; deckTheme?: string; bossTiangang?: string[]; counterTip?: string }
export const STAGE_CAMPAIGN: StageCampaign[] = [
  { stage: 1, boss: '列奥尼达', battle: '温泉关', oneLiner: '三百斯巴达·死战波斯', stars: 1, unlock: '虎符',
    intro: '公元前 480 年，波斯王薛西斯一世亲率号称百万的大军西征希腊，志在踏平这片小小的城邦之地。希腊联军退守温泉关——一道左倚高山、右临大海的狭窄隘口，宽仅容数人并行。斯巴达王列奥尼达只带三百精锐死士扼守此处：地形抵消了波斯的兵力优势，狭路之上人数再多也施展不开。波斯人连攻两日不得寸进，连薛西斯的精锐「不死军」也折戟于此。直到叛徒以法尔特斯献出山间小道，波斯军绕到背后，列奥尼达令大军撤退，自己与三百勇士留下死战，全数殉国——却为希腊集结争取了宝贵时间，终在萨拉米斯与普拉提亚反败为胜。「过客啊，去告诉斯巴达人，我们遵从命令长眠于此。」而你，要翻动这场死战的结局。',
    bossLines: { open: '波斯人！来取我的长矛吧——如果你们能。', mid: '斯巴达人，早餐尽情吃——晚餐我们在冥府享用！', lose: '……斯巴达的荣耀，今日终结于你手。' },
    deckTheme: '300 斯巴达同质重步兵·同点抱团 + 黑桃同花墙', bossTiangang: ['旗手', '不屈'], counterTip: '铺场快攻绕开耐久；点数压过士气',
    fiends: [
    { name: '温泉关死守', desc: '隘口窄·守军贴家越战越勇(+战力)' }, { name: '斯巴达方阵', desc: '兵相邻越多·互 +战力' }, { name: '死战不退', desc: '濒死不溃·战至最后一人' } ] },
  { stage: 2, boss: '亚历山大', battle: '高加米拉', oneLiner: '以少击溃大流士·灭波斯', stars: 1, unlock: '旗手',
    intro: '公元前 331 年十月，美索不达米亚的高加米拉平原。波斯王大流士三世记取了伊苏斯之败，特意选了一片开阔地，平整土地以便战车冲锋，集结起包括战象、刀轮战车与各族骑兵的二十万大军，要一举碾碎来犯的马其顿人。亚历山大只有四万步骑，却毫不退缩。他以著名的「斜击阵」应对：右翼骑兵故意向侧方斜行，引诱波斯左翼追击、拉开缺口；当波斯阵线裂开一道楔形空隙的那一刻，亚历山大亲率「伙伴骑兵」如一柄尖锥直插中军、径取大流士王旗。大流士胆寒先逃，波斯全军随之崩溃。此战之后，绵延两百年的波斯帝国土崩瓦解，亚历山大的兵锋一直推进到印度河畔。「我不窃取胜利」——而这一战的命，今日握在你手。',
    bossLines: { open: '我不窃取胜利。来吧，让命运在阳光下见分晓。', mid: '看我的伙伴骑兵，如何凿穿你的中军！', lose: '……连我，也有马失前蹄之日。了不起。' },
    deckTheme: '高点尖兵·锋矢突击（红桃骑兵）', bossTiangang: ['虎符', '旗手', '磐石'], counterTip: '擒王斩其主将断光环；灌铅骰拉差距',
    fiends: [
    { name: '伙伴骑兵', desc: '一记突击·直插你主将/后排' }, { name: '锤砧', desc: '正面顶+侧翼砸·夹你减战力' }, { name: '长枪方阵', desc: '前排先手出击' } ] },
  { stage: 3, boss: '曹操', battle: '赤壁（翻命）', oneLiner: '挟天子·连环船·火攻可破', stars: 2, unlock: '不屈',
    intro: '东汉建安十三年（公元 208 年），曹操已扫平北方、挟天子以令诸侯，挥师南下，号称八十万众，要一举荡平江东、混一天下。孙权、刘备被迫联手，以五万兵力对抗于长江赤壁。曹军多为北方人，不习水战，晕船呕吐，曹操便下令用铁索将战船首尾连锁、铺板其上如履平地——却也埋下致命隐患。东吴老将黄盖诈降，趁东南风起，驱十艘满载油薪的火船直冲曹军连环船阵。烈焰借风势蔓延，铁索相连的舰队无法散开，顷刻间火光烛天、江水尽赤。曹操败走华容道，北方势力退回中原，天下三分之势就此奠定。这一回，你，就是那把火。',
    bossLines: { open: '孤提百万雄师，踏平江东，弹指间耳。', mid: '区区火攻，也敢撼我连环巨舰？', lose: '……华容道上，孤竟败于这一炬。' },
    deckTheme: '铺三路·梅花连环同花·中低点多', bossTiangang: ['虎符', '川流', '双锋'], counterTip: '舍车集中一路；同花/三条压连环',
    fiends: [
    { name: '大军压境', desc: '兵海·额外铺兵' }, { name: '连环船', desc: '他兵串联共享战力·你可「火攻」一并烧' }, { name: '挟天子', desc: '全军士气 +' } ] },
  { stage: 4, boss: '拿破仑', battle: '滑铁卢', oneLiner: '大炮兵·近卫军·机动突破', stars: 2, unlock: '疾行',
    intro: '1815 年 6 月，比利时滑铁卢。一年前兵败退位、被流放厄尔巴岛的拿破仑，戏剧性地逃回法国、重登帝位，史称「百日王朝」。整个欧洲为之震动，第七次反法同盟集结而来。拿破仑深知必须趁英、普两军会合之前各个击破。他先在林尼击退普鲁士的布吕歇尔，随后回身在滑铁卢与威灵顿的英荷联军决战。然而连日大雨使地面泥泞，拿破仑被迫推迟炮击与冲锋数小时——正是这几个小时，让以为已被击溃的普军得以重整、赶来增援。当布吕歇尔的普鲁士军出现在法军右翼时，战局逆转；拿破仑倾其精锐「老近卫军」做最后一搏，却首次也是最后一次被击退。法军崩溃，拿破仑彻底退出历史舞台，欧洲迎来数十年和平。「近卫军可死，绝不投降」——而这一局命，等你来翻。',
    bossLines: { open: '近卫军从未后退。今日，让世界再记住我的名字。', mid: '大炮是我最忠诚的女儿——听她歌唱吧。', lose: '……普鲁士人来得太快。命运，终弃我而去。' },
    deckTheme: '中高点·方块炮兵·集中突破', bossTiangang: ['锋矢', '鼎立', '虎符', '薪火'], counterTip: '疾行抢攻；铁骰防大炮爆冷路',
    fiends: [
    { name: '大炮兵', desc: '开局炮轰一路·全路减战力' }, { name: '近卫军', desc: '一记精锐·中央突破' }, { name: '机动调度', desc: '额外迁路/多动一次' } ] },
  { stage: 5, boss: '项羽', battle: '霸王别姬', oneLiner: '破釜沉舟·霸王之勇·不退', stars: 3, unlock: '擒王',
    intro: '公元前 202 年，垓下。曾经分封天下、不可一世的西楚霸王项羽，在长达四年的楚汉相争后渐落下风。韩信以三十万汉军布下十面埋伏，将项羽的十万楚军重重围困于垓下。粮尽援绝之夜，汉军令楚地降卒四面唱起楚歌——项羽惊起，以为楚地尽失、大势已去，悲愤之下与爱姬虞姬饮酒悲歌：「力拔山兮气盖世，时不利兮骓不逝。骓不逝兮可奈何，虞兮虞兮奈若何！」虞姬自刎相别。项羽率八百骑趁夜突围，一路血战至乌江畔，仅剩二十八骑，犹自斩将夺旗、无人能挡。乌江亭长劝他渡江东山再起，项羽却笑言「无颜见江东父老」，赠马步战，杀汉军数百后自刎，年仅三十一。一代战神，就此落幕。而你，能否为霸王翻这一局命？',
    bossLines: { open: '力拔山兮气盖世！纵八千子弟散尽，此身亦战至最后一人！', mid: '此天亡我，非战之罪也！', lose: '……无颜见江东父老。罢了，就让你来翻这命吧。' },
    deckTheme: '全高点·黑红双花霸王军·莽一波', bossTiangang: ['擎天', '灌铅骰', '铁骰', '虎符', '锋矢'], counterTip: '擒王断霸王之勇+擎天；磐石抬下限抗碾压',
    fiends: [
    { name: '破釜沉舟', desc: '全军战力暴涨·绝不退' }, { name: '霸王之勇', desc: '主将无双·战力恐怖' }, { name: '九战九捷', desc: '每胜叠加战力' } ] },
];
/** 当前关战役（stage 1..N → 关卡；越界取末关）。纯数据·HOME 展示用。 */
export function campaignFor(stage: number): StageCampaign {
  return STAGE_CAMPAIGN[Math.max(0, Math.min(STAGE_CAMPAIGN.length - 1, stage - 1))];
}

// 首启开场故事（doc28 §一 · 逐屏旁白·可跳过）。数据驱动·叙事层·纯文案。
export interface StoryBeat { scene: string; text: string }
export const STORY_OPENING: StoryBeat[] = [
  { scene: '夜 · 赌场', text: '传说，世上最伟大的将军，从未真正死去——他们只是，在等一个执牌的人。' },
  { scene: '开关', text: '一只手无意间拨动了牌桌下一枚古旧的黄铜开关。咔哒。' },
  { scene: '异变', text: '灯火骤灭，整副扑克腾空、光芒大作。远古以来，五十二位最负盛名的名将，魂魄被尽数封入这副牌中。' },
  { scene: '群像', text: '孙武、成吉思汗、亚历山大、项羽……剪影在牌面一一闪现。他们困在各自一生最关键的那场战役里，命运永远定格在那一刻。' },
  { scene: '庄家', text: '牌桌尽头，大王与小王缓缓浮现——执掌这副命运之牌的两位庄家。' },
  { scene: '召唤', text: '你，无意间成了执掌命运之人。重打这五十二场命运之战、翻动他们的命——最终，掀翻这庄家的牌桌。' },
];

// === 天罡解锁表（doc25 §二 · 9 关 × 4 张 = 36 · 简单被动 → 复杂主动 → 流派印记） ===
// 打通关 N → 解锁该关 4 张「可购」（花金币·或钻石速购）；前 5 关可刷攒币；通关 1-9 = 全 36 解锁。
export const TIANGANG_UNLOCK: { stage: number; ids: string[] }[] = [
  { stage: 1, ids: ['tigertally', 'widehand', 'veteran', 'bannerman'] },
  { stage: 2, ids: ['unyield', 'bedrock', 'laststand', 'twinblade'] },
  { stage: 3, ids: ['fewtroops', 'grieve', 'deathwatch', 'flow'] },
  { stage: 4, ids: ['arrowhead', 'tripod', 'relay', 'ram'] },
  { stage: 5, ids: ['atlas', 'irondice', 'leaddice', 'swiftmarch'] },
  { stage: 6, ids: ['mire', 'beachhead', 'rush'] }, // 城门令(gateorder)随机关门退役·本关 3 张（owner 2026-07-03·REQ-G-退役机关门）
  { stage: 7, ids: ['ghosthand', 'ironchain', 'discard2', 'lurefoe'] },
  { stage: 8, ids: ['capturektg', 'tidewave', 'markdecap', 'markmorale'] },
  { stage: 9, ids: ['markswarm', 'marktianji', 'marksamerank', 'markodds'] },
];
const UNLOCK_STAGE_BY_ID: ReadonlyMap<string, number> = new Map(TIANGANG_UNLOCK.flatMap((u) => u.ids.map((id) => [id, u.stage] as [string, number])));
/** 某天罡在第几关解锁（未列出 → 1）。 */
export function unlockStageOf(id: string): number { return UNLOCK_STAGE_BY_ID.get(id) ?? 1; }

// === 地煞全集（doc23 §八 关1-5 + §九 余 47 · 52 Boss × 3 = 156 · Boss 招牌历史战术·明牌可破） ===
// 每关开局明牌介绍 Boss 地煞（公平可破）。kind 借天罡词汇·「+」=多维。codex 展示用；战斗 apply 在甲侧。
export interface EarthFiend { name: string; effect: string; kind: string; counter: string }
export interface BossFiends { boss: string; fiends: EarthFiend[] }
export const EARTH_FIENDS: BossFiends[] = [
  { boss: '孙武', fiends: [{ name: '兵形如水', effect: '每回合开始随机把一路兵悄悄换到你防守最空的一路（避实击虚）', kind: 'lane', counter: '三路都留人·让他无虚可击' }, { name: '奇正相生', effect: '每路藏一张暗兵·遭遇时才翻面（看不到真实战力）', kind: 'odds', counter: '多带兵摊牌·用稳胜率招少赌' }, { name: '长驱入郢', effect: '攻破你大本营时多扣 1 血（五战入郢·势不可挡）', kind: 'siege', counter: '守前排别让他贴脸·破家代价翻倍' }] },
  { boss: '成吉思汗', fiends: [{ name: '骑射', effect: '遭遇前先放箭·敌兵未接战先掉一截战力', kind: 'power', counter: '高续航人头牌顶前排·扛过头轮箭' }, { name: '怯薛铁骑', effect: '全军行军提速·比你早一步抢线压境', kind: 'tempo', counter: '泥沼/铁索拖速·或抢滩占中线' }, { name: '诈败诱杀', effect: '一路假溃·你追上反咬·那场胜率倒给他', kind: 'odds', counter: '别贪追残兵·逼他回头硬碰' }] },
  { boss: '凯撒', fiends: [{ name: '内外双壕', effect: '大本营前两格变天堑·你的兵在那推进减半', kind: 'siege', counter: '集中一路凿穿·别处佯攻分兵' }, { name: '围点打援', effect: '你新部署的援兵入场即减战力（半道截杀）', kind: 'power', counter: '攒齐一波再压·或绕开封锁路' }, { name: '降维钦托利', effect: '打掉你某路主将·该路全体溃散', kind: 'morale', counter: '主将靠后藏·配督战不溃' }] },
  { boss: '汉尼拔', fiends: [{ name: '两翼包抄', effect: '上下两路向中路夹击·被夹的你兵减战力', kind: 'power', counter: '守中路别突进·反吃他抽空的两翼' }, { name: '新月薄阵', effect: '中路示弱诱你深入·越推两翼夹得越狠', kind: 'odds', counter: '别中路冒进·从两翼先啃' }, { name: '一日聚歼', effect: '被两翼合围的你兵当回合直接出局', kind: 'siege', counter: '别孤军深入·保阵线相连' }] },
  { boss: '韩信', fiends: [{ name: '背水列阵', effect: '他全军绝不溃散·死战到底', kind: 'morale', counter: '拼续航耗死·或擒主将一锅端' }, { name: '置死后生', effect: '他兵越濒死战力越高', kind: 'power', counter: '速杀别留活口·撑不到爆发就清' }, { name: '拔旗易帜', effect: '奇兵偷袭你一处大本营·拔旗换帜（偷 1 血）', kind: 'siege', counter: '留兵守家·堵偷袭空门' }] },
  { boss: '白起', fiends: [{ name: '佯北诱敌', effect: '前排假败引你出·追进他阵就被反包', kind: 'odds', counter: '见败不追·逼他来攻' }, { name: '断粮绝道', effect: '截你后路·全军续航 −1', kind: 'stamina', counter: '带续航/多铺轮换·速战别消耗' }, { name: '长平坑杀', effect: '被围的你兵不死也残·且无法接棒续战', kind: 'siege', counter: '别被合围·留迁路撤出' }] },
  { boss: '哈立德', fiends: [{ name: '机动近卫', effect: '留精骑预备队·每回合补到你打最凶的一路', kind: 'lane', counter: '多路同时压·分散其预备队' }, { name: '六日鏖战', effect: '每多打一回合·全军战力再涨一截', kind: 'combo', counter: '速攻别拖·前几回合就破家' }, { name: '侧翼决荡', effect: '预备骑兵一记重击·撕开你一路侧翼全员减战力', kind: 'power', counter: '该路堆厚兵/留防反' }] },
  { boss: '居鲁士', fiends: [{ name: '涸河潜行', effect: '兵从干涸河道绕过前排·直现你后排', kind: 'tempo', counter: '后排也留兵把守' }, { name: '引水改道', effect: '改一路河道·把你那路兵冲去隔壁·阵型大乱', kind: 'lane', counter: '三路均衡·用迁路扳回' }, { name: '不战入城', effect: '趁你一路空虚·长驱直入大本营扣 1 血', kind: 'siege', counter: '别留空路·每路摆兵堵门' }] },
  { boss: '帖木儿', fiends: [{ name: '断其水源', effect: '截水源·全军续航 −1·士气下滑', kind: 'stamina', counter: '速决·或带续航扛干渴' }, { name: '阵前倒戈', effect: '策反你一路最前的兵·当场反水帮他', kind: 'morale', counter: '最强兵别孤放最前·留援镇场' }, { name: '生擒苏丹', effect: '锁定直取你主将·擒下后该路全崩', kind: 'morale', counter: '主将藏后·配护卫' }] },
  { boss: '速不台', fiends: [{ name: '一夜架桥', effect: '偷架浮桥·一路兵开局直杀到中线', kind: 'tempo', counter: '该路开局就摆兵守中线' }, { name: '砲清滩头', effect: '巨砲先轰你一路前排·开打就减战力', kind: 'siege', counter: '前排别堆密·分散站位' }, { name: '合围歼灭', effect: '正面佯攻+奇兵抄后·一路前后夹死全路溃散', kind: 'morale', counter: '留机动兵防抄后·配督战' }] },
  { boss: '腓特烈大帝', fiends: [{ name: '斜击列阵', effect: '选一路全员战力翻倍、另两路减半（集中一翼·赌侧翼）', kind: 'power', counter: '两弱路顶住，强翼之外处处空虚' }, { name: '卷击侧翼', effect: '最强一路斜插敌侧翼命中+1推进格', kind: 'tempo', counter: '摆满中路、不留侧翼空档' }, { name: '普鲁士操典', effect: '每回合首张部署免召唤源泉', kind: 'draw', counter: '拖长局·操典优势随兵海摊薄' }] },
  { boss: '西庇阿', fiends: [{ name: '让阵纳象', effect: '敌冲来的兵不被阻挡直穿、但穿过后该路本回合不推进', kind: 'lane', counter: '别往他敞开的路硬冲' }, { name: '回身夹歼', effect: '穿过我阵的敌兵下回合遭两侧合击·胜率大降', kind: 'odds', counter: '单路集结·别孤身突入' }, { name: '罗马轮替', effect: '前锋续航打光即后排顶上·不留空格', kind: 'stamina', counter: '抢轮替补位的空窗突破' }] },
  { boss: '苏沃洛夫', fiends: [{ name: '急行奔袭', effect: '开局全军额外预推一格·抢先接敌', kind: 'tempo', counter: '首回合稳守·待其锐气过' }, { name: '白刃突贯', effect: '接敌即冲·跳过对峙直接掷命·首击胜率更高', kind: 'odds', counter: '接敌前用远程/法术先削战力' }, { name: '不败之威', effect: '主将在场·全军濒死不溃·续航不减', kind: 'morale', counter: '集火先斩其主将' }] },
  { boss: '李靖', fiends: [{ name: '阴山奇袭', effect: '部署的兵直接现身敌方区·贴脸突袭', kind: 'lane', counter: '我方区后排留预备队堵漏' }, { name: '一战灭国', effect: '任一路兵抵敌大本营·直接 −2 血', kind: 'siege', counter: '严防任一路被推穿' }] },
  { boss: '萨拉丁', fiends: [{ name: '断敌水源', effect: '敌全军续航每回合多耗 1·渴战速衰', kind: 'stamina', counter: '低续航杂兵换血·速战' }, { name: '诱敌焦土', effect: '敌推进越深·其兵战力越低', kind: 'power', counter: '别贪进·中线决战' }, { name: '哈丁合围', effect: '两翼之兵向中路敌军合拢夹击·战力大增', kind: 'combo', counter: '别挤中路·分散三路' }] },
  { boss: '古斯塔夫二世', fiends: [{ name: '团属轻炮', effect: '每路开火先制·接敌前先削敌前锋战力', kind: 'power', counter: '高续航厚兵扛过头轮炮' }, { name: '诸兵协同', effect: '同路兵将法皆备则该路胜率大涨', kind: 'combo', counter: '点杀其将/兵·破搭配' }, { name: '线列轮射', effect: '前锋掷命后退队尾·后排即补射·火力不停', kind: 'stamina', counter: '抢轮射换位的空隙' }] },
  { boss: '霍去病', fiends: [{ name: '长途奔袭', effect: '骑兵越空格连推两格·长驱直入', kind: 'tempo', counter: '层层设兵·不给连推空当' }, { name: '因粮于敌', effect: '每击溃一敌即回满续航·越战越强', kind: 'stamina', counter: '避免送兵·坚壁清野' }, { name: '封狼居胥', effect: '一路推穿到底·永久+全军战力且挫敌士气', kind: 'siege', counter: '必须守住·不让其建功' }] },
  { boss: '李世民', fiends: [{ name: '以逸待劳', effect: '敌先动回合按兵蓄力·之后全军战力翻倍', kind: 'power', counter: '速攻·别陪他耗满' }, { name: '玄甲突阵', effect: '主将率精骑无视前排·径取后排/大本营', kind: 'lane', counter: '后排与大本营间布重兵' }, { name: '一举双擒', effect: '一回合击溃敌两路前锋·敌弃一张手牌', kind: 'morale', counter: '别让两路同时陷劣势' }] },
  { boss: '朱可夫', fiends: [{ name: '钳形合围', effect: '左右两路绕中线·向敌后包抄夹击', kind: 'lane', counter: '厚守两翼·逼其正面' }, { name: '攻其薄弱', effect: '专挑敌最弱一路猛攻·该路推进翻倍', kind: 'tempo', counter: '三路均摊·无明显弱路' }, { name: '瓮中聚歼', effect: '被两路夹住的敌兵无法推进·续航急耗', kind: 'stamina', counter: '别让兵被夹·留退路' }] },
  { boss: '隆美尔', fiends: [{ name: '装甲迂回', effect: '主力一路本回合横移到另一路·出其不意', kind: 'lane', counter: '处处留防·别赌主攻路' }, { name: '反斜诱杀', effect: '诈败后撤一格·敌追兵入我区遭伏战力大减', kind: 'odds', counter: '他后撤别追·稳守' }, { name: '长驱补给', effect: '推进越深·全军推进速越快', kind: 'tempo', counter: '首回合便顶死·不让立足' }] },
  { boss: '贝利撒留', fiends: [{ name: '掘壕拒马', effect: '敌推进入我方区即减一格速·寸步难行', kind: 'tempo', counter: '高推进精兵硬趟' }, { name: '两翼伏骑', effect: '敌前锋一接战即遭侧击战力骤降', kind: 'power', counter: '集中一路·压制侧翼' }, { name: '以寡制众', effect: '我方兵越少·全军胜率越高', kind: 'odds', counter: '别铺太多兵·以势压' }] },
  { boss: '阿提拉', fiends: [{ name: '上帝之鞭', effect: '全军推进翻倍·踏过格留劫掠(敌补兵多花一回合)', kind: 'tempo+lane', counter: '守路口·不让骑兵入纵深' }, { name: '万骑环射', effect: '不接阵直接对一路最前三格各掷命', kind: 'odds', counter: '收成密集团块·减暴露前排' }, { name: '来去如风', effect: '兵每回合可后撤再扑·永远在你够不到处掷命', kind: 'tempo', counter: '用骑兵/远程拉平射程' }] },
  { boss: '穆罕默德二世', fiends: [{ name: '乌尔班巨炮', effect: '蓄力两回合·一击轰大本营 −2 血·无视前排', kind: 'siege', counter: '两回合内打掉炮位兵' }, { name: '陆上行舟', effect: '凭空在你后方空格生一队兵·绕过防线', kind: 'lane+draw', counter: '后排留预备队堵' }, { name: '车轮围攻', effect: '三路同时压·你挡一波他补一波·耗你续航', kind: 'stamina', counter: '集中守一路·弃次路保体力' }] },
  { boss: '曼施坦因', fiends: [{ name: '阿登奇径', effect: '从你判"天险无人"的中路迷雾杀出主力装甲', kind: 'lane+siege', counter: '别空着隘口·留侦察' }, { name: '镰刀合围', effect: '突破某路后反包抄两翼·相邻两路战力暴跌', kind: 'power', counter: '突破口立刻弃守收线' }, { name: '闪击不停', effect: '每打赢一格立即免费再推一格·连锁前冲', kind: 'tempo+combo', counter: '一次硬胜打断连锁' }] },
  { boss: '岳飞', fiends: [{ name: '砍马腿', effect: '你战力越高的兵·被他砍翻胜率反而越大', kind: 'odds', counter: '改用轻装散兵' }, { name: '铁浮屠', effect: '三骑相连共享战力且濒死不溃', kind: 'power+morale', counter: '断中间一骑破连环' }, { name: '拐子马', effect: '两翼轻骑包抄·你每路两侧格开战即减胜率', kind: 'odds+lane', counter: '兵靠边贴墙·缩受袭面' }] },
  { boss: '威灵顿', fiends: [{ name: '反斜固守', effect: '后排兵藏坡背迷雾·你看不见算不准虚实', kind: 'siege', counter: '强攻试探逼他亮兵' }, { name: '步兵方阵', effect: '结阵兵被骑兵冲不溃反弹·越冲越稳', kind: 'morale', counter: '用步兵/炮火磨·别骑兵撞' }, { name: '坚守待援', effect: '撑过若干回合援军至·全军续航回满战力翻新', kind: 'stamina', counter: '援军到位前速破本营' }] },
  { boss: '纳尔逊', fiends: [{ name: '破阵纵贯', effect: '纵队插进战线中段·把一路从中切两段', kind: 'lane', counter: '战线留纵深·别拉薄线' }, { name: '抢占上风', effect: '开战先手·本回合掷命多一次重掷取优', kind: 'odds', counter: '先占路口夺回先手' }, { name: '各个击破', effect: '被切断的孤兵失相邻加成·逐格碾过叠连胜', kind: 'combo', counter: '及时回援断兵' }] },
  { boss: '戚继光', fiends: [{ name: '鸳鸯阵', effect: '长短兵相邻成对·短兵扛长兵反刺·极难拔', kind: 'power+morale', counter: '引他散阵到孤格' }, { name: '长短相济', effect: '对相邻格和隔一格同时掷命施压', kind: 'odds', counter: '拉开两格以上间距' }, { name: '荡寇连捷', effect: '每清你一格·全军士气续航各涨·越打越猛', kind: 'morale+stamina', counter: '别送兵·断其连捷节奏' }] },
  { boss: '诸葛亮', fiends: [{ name: '八阵图', effect: '三路连环·攻任一路被相邻两路夹击减胜率', kind: 'odds+lane', counter: '一次啃一路·守侧翼' }, { name: '木牛流马', effect: '全军续航不衰·补兵不要额外回合', kind: 'stamina+draw', counter: '断后路格阻补给' }, { name: '稳扎稳打', effect: '每回合只推一格·所推之格转难破营垒', kind: 'siege+tempo', counter: '趁推进慢·侧路抢攻' }] },
  { boss: '扬·杰士卡', fiends: [{ name: '战车环堡', effect: '一路围成环堡·圈内防御极高·骑兵冲反受损', kind: 'siege+power', counter: '炮火/火攻破·别骑兵撞' }, { name: '车阵火铳', effect: '环堡内隔车墙向外掷命·自己几乎不挨打', kind: 'odds', counter: '贴近逼出堡/绕背面' }, { name: '独眼不败', effect: '缺兵少粮·大本营每回合自回士气·久攻不溃', kind: 'morale', counter: '速战速决·别消耗' }] },
  { boss: '马尔伯勒', fiends: [{ name: '中央破阵', effect: '佯攻两翼诱你分兵·再集主力凿穿中路', kind: 'power+lane', counter: '中路常留厚兵' }, { name: '步骑协同', effect: '步兵咬正面·骑兵同回合突侧后同格夹击叠胜率', kind: 'combo+odds', counter: '拆步骑配合·先解决一种' }, { name: '千里奔袭', effect: '开局抢先·全军起手推进速大增', kind: 'tempo', counter: '前压布防抢路口' }] },
  { boss: '织田信长', fiends: [{ name: '暴雨奇袭', effect: '召迷雾遮场·借雾突袭你看不见的一路', kind: 'siege+lane', counter: '留侦察驱雾' }, { name: '直取本阵', effect: '不理两翼·全军越路直插大本营斩首', kind: 'siege+tempo', counter: '本营前留死守阵' }, { name: '以寡击众', effect: '兵越少战力越凶·被以多打少反而胜率暴涨', kind: 'odds+morale', counter: '稳步压·别浪推' }] },
  { boss: '卫青', fiends: [{ name: '奇袭龙城', effect: '绕正面·直掷命突袭你大本营格·无视前排', kind: 'siege+lane', counter: '大本营格留重兵' }, { name: '长驱直入', effect: '起手主力直铺你半场·跳过沿路遭遇', kind: 'tempo+lane', counter: '中场设伏堵截' }, { name: '首胜破神', effect: '本场第一次掷命必胜·首胜后全军士气战力升', kind: 'odds+morale', counter: '首战避其锋' }] },
  { boss: '查理曼', fiends: [{ name: '铁骑灭国', effect: '选一路重骑推进翻倍·撞敌连撞两格', kind: 'tempo+power', counter: '该路留1兵设障·诱其孤军' }, { name: '圣战旌旗', effect: '全军本回合掷命胜率+15%', kind: 'morale+odds', counter: '攻其本营旗帜·士气清零' }, { name: '马尔克边屯', effect: '三路最前格各凭空铺1守兵·永久占位', kind: 'draw+lane', counter: '范围伤害一次扫掉' }] },
  { boss: '图拉真', fiends: [{ name: '多瑙浮桥', effect: '两路间架桥·我方兵横向迁路一次绕开正面', kind: 'lane', counter: '桥头格放重兵' }, { name: '龟甲攻城', effect: '一路抱团免疫一次拦截·直推大本营再扣1血', kind: 'siege', counter: '高胜率单位正面破龟甲' }, { name: '工程军团', effect: '我方已出的兵各+1续航', kind: 'stamina', counter: '迁路/铺兵拖延磨光' }] },
  { boss: '苏莱曼大帝', fiends: [{ name: '两时破阵', effect: '本回合连掷三次命·敌前排三格各judge', kind: 'odds', counter: '前排让空·三连打空格' }, { name: '耶尼切里', effect: '召精锐近卫·战力极高·不受士气波动', kind: 'power+morale', counter: '集火·连撞两次即除' }, { name: '火炮齐鸣', effect: '锁我方一整路·远程削全路战力·未战先掉', kind: 'power', counter: '贴脸推进至本营躲炮' }] },
  { boss: '埃帕米农达斯', fiends: [{ name: '斜阵压顶', effect: '兵力全压一路叠战力·其余两路放空', kind: 'power+lane', counter: '攻空着两路直取本营' }, { name: '五十纵深', effect: '选一格加厚·连胜三次才打得动', kind: 'stamina+odds', counter: '绕路走相邻' }, { name: '斩首精锐', effect: '直冲敌最强路本营守军·先点杀核心', kind: 'combo', counter: '核心后撤·杂兵当肉盾' }] },
  { boss: '皮洛士', fiends: [{ name: '巨象冲阵', effect: '战象踏入一路·敌兵推进归零并后退一格', kind: 'tempo+power', counter: '让出通道·象冲乱其后排' }, { name: '惨胜之刃', effect: '本回合胜率+25%·但战后我方全军各扣1续航', kind: 'odds+stamina', counter: '拖持久战·避战待其虚' }, { name: '王者亲征', effect: '皮洛士亲入一路·该路全员战力大涨至他被击退', kind: 'power+morale', counter: '集火逼退主将本人' }] },
  { boss: '武田信玄', fiends: [{ name: '啄木鸟', effect: '分兵两路夹中路·两侧推进时中路敌胜率−20%', kind: 'combo+odds', counter: '趁两翼空虚先破一翼' }, { name: '风林火山', effect: '本回合选「疾如风」推进翻倍 或「不动如山」续航翻倍', kind: 'tempo+stamina', counter: '打它没切的那一面' }, { name: '骑马武者', effect: '一路骑兵突击·撞击附带额外一次掷命·连破前两格', kind: 'tempo+power', counter: '前两格摆高续航重步' }] },
  { boss: '吴起', fiends: [{ name: '魏武卒', effect: '召重装精锐·战力高续航高·以一当十不易溃', kind: 'power+stamina', counter: '多路同时压·分其身' }, { name: '同甘共苦', effect: '全军永久士气不可削·掷命永不溃败', kind: 'morale', counter: '拼纯战力差掀翻' }, { name: '严明号令', effect: '锁场两回合·双方不能迁路/铺兵·只能正面硬碰', kind: 'lane+draw', counter: '锁前先铺好兵占位' }] },
  { boss: '罗伯特·李', fiends: [{ name: '分进合击', effect: '本回合可同时在两路各发起一次推进', kind: 'tempo+lane', counter: '缠死主力·各个击破偏师' }, { name: '杰克逊侧击', effect: '奇兵绕敌最弱路侧后突袭·无视该路前排', kind: 'combo', counter: '侧翼留守兵·一探即现' }, { name: '以寡敌众', effect: '我方兵越少·每兵战力越高', kind: 'power+morale', counter: '围而不歼·兵满时强攻' }] },
  { boss: '孙膑', fiends: [{ name: '减灶诱敌', effect: '主动后撤一路示弱·敌追入则触发设伏', kind: 'tempo', counter: '不追击·按兵不动' }, { name: '马陵设伏', effect: '一路指定格预埋伏兵·敌踏入即双面围杀', kind: 'combo+odds', counter: '迷雾/侦察点亮·绕格而行' }, { name: '万弩齐发', effect: '对踏入伏击圈的敌兵·本路每格各受一次远程掷命', kind: 'odds+power', counter: '单兵快冲过·减停留' }] },
  { boss: '巴布尔', fiends: [{ name: '车垒环营', effect: '车阵围一路·敌撞墙推进归零·需先破车阵', kind: 'siege+tempo', counter: '绕侧翼过道·不正撞' }, { name: '回回炮轰', effect: '越车垒远程轰敌一路后两格·未战先掉战力', kind: 'power', counter: '兵贴近车阵死角避轰' }, { name: '两翼包抄', effect: '中军顶住时两翼骑兵绕出·对敌侧路各加夹击', kind: 'combo', counter: '拉宽正面·让两翼无空' }] },
  { boss: '斯巴达克斯', fiends: [{ name: '藤蔓夜袭', effect: '一队兵凭空现敌后方格(悬崖垂降)·绕过前排', kind: 'lane+combo', counter: '后方留守兵巡夜' }, { name: '奴隶怒涌', effect: '每死1兵·下回合凭空补1新兵入场', kind: 'draw+morale', counter: '范围清场·断补兵' }, { name: '困兽反扑', effect: '大本营血越低·全军胜率越高', kind: 'odds+morale', counter: '速攻别留尾' }] },
  { boss: '维钦托利', fiends: [{ name: '高地坚守', effect: '占一路高地格·守此格胜率+25%·难克', kind: 'odds', counter: '绕路直插本营逼下高地' }, { name: '焦土游击', effect: '烧一路补给·该路敌续航−2·禁铺新兵', kind: 'stamina+draw', counter: '补给烧尽前速决' }, { name: '全境举义', effect: '三路同时骚扰·每路敌推进速−1', kind: 'tempo', counter: '弃两路·集中突破一路' }] },
  { boss: '沙卡·祖鲁', fiends: [{ name: '水牛角', effect: '中路顶·左右两路推进翻倍包抄合围', kind: 'tempo+combo', counter: '击溃中军「胸膛」' }, { name: '短矛贴身', effect: '进入贴身格·近战胜率+20%·敌不许后撤脱离', kind: 'odds+power', counter: '远程/法术先手削·不让近身' }, { name: '跑步突袭', effect: '全军本回合推进速+2·闪电压上不给布阵', kind: 'tempo', counter: '预设纵深·突快反耗锐气' }] },
  { boss: '狮心王理查', fiends: [{ name: '严整纵队', effect: '全军免疫一切「迫推/惊扰」·稳步前进', kind: 'morale+stamina', counter: '别诱·直攻其薄弱一翼' }, { name: '后发制人', effect: '本回合放弃主动·敌推进后我方反击胜率+30%', kind: 'odds', counter: '也按兵不动比耐心' }, { name: '重骑反冲', effect: '蓄力一回合·一路重骑反冲连破敌该路全部前排', kind: 'tempo+power', counter: '趁蓄力未发抢先突破' }] },
  { boss: '列奥尼达', fiends: [{ name: '温泉关死守', effect: '隘口窄·大本营/前排极难破', kind: 'siege', counter: '凿穿一点' }, { name: '斯巴达方阵', effect: '兵相邻越多·互+战力', kind: 'combo', counter: '拆散其密集' }, { name: '死战不退', effect: '濒死不溃·战至最后一人', kind: 'morale', counter: '耗续航' }] },
  { boss: '亚历山大', fiends: [{ name: '伙伴骑兵', effect: '一记突击·直插你主将/后排', kind: 'power', counter: '主将藏后' }, { name: '锤砧', effect: '正面顶+侧翼砸·夹你减战力', kind: 'power', counter: '别被夹中' }, { name: '长枪方阵', effect: '前排先手出击', kind: 'tempo', counter: '远程先削' }] },
  { boss: '曹操', fiends: [{ name: '大军压境', effect: '兵海·额外铺兵', kind: 'draw', counter: '以质胜量' }, { name: '连环船', effect: '他兵串联共享战力·你可火攻一并烧', kind: 'combo', counter: '火攻一锅端' }, { name: '挟天子', effect: '全军士气+', kind: 'morale', counter: '擒贼擒王' }] },
  { boss: '拿破仑', fiends: [{ name: '大炮兵', effect: '开局炮轰一路·全路减战力', kind: 'siege', counter: '分散站位' }, { name: '近卫军', effect: '一记精锐·中央突破', kind: 'power', counter: '中路堆厚' }, { name: '机动调度', effect: '额外迁路/多动一次', kind: 'tempo', counter: '锁门限其机动' }] },
  { boss: '项羽', fiends: [{ name: '破釜沉舟', effect: '全军战力暴涨·绝不退', kind: 'power', counter: '拖到锐气尽' }, { name: '霸王之勇', effect: '主将无双·战力恐怖', kind: 'morale', counter: '擒王破之' }, { name: '九战九捷', effect: '每胜叠加战力', kind: 'combo', counter: '别送人头' }] },
];
