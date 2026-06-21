// Game G · 地支牌数据（十二生肖镶嵌养成 doc20 §三 + 牌背传说 doc23 §五·拆分自 blueprint.ts·纯数据叶子）。

// === 地支牌：十二生肖镶嵌养成（doc20 §三 效果 · doc23 §五 牌背传说 · 美术 assets/curated/zodiac.json） ===
// 一张地支牌 = 1 生肖 · 铜/银/金三档（越高越强·金档带额外词条）；镶到战斗卡 ≤3 槽，3 颗凑三合/六合连携（甲战斗侧 apply·契约④）。
// 此处 = 养成数据 + 牌背传说 + 美术图标路径（菜单 codex 展示）；镶嵌/揉获取/连携 gameplay 待契约④实装。
export interface DizhiZodiac { branch: string; animal: string; symbol: string; png: string; legend: string; bronze: string; silver: string; gold: string; }
export const DIZHI_ZODIACS: DizhiZodiac[] = [
  { branch:'子',animal:'鼠',symbol:'投机',png:'assets/emoji/1f400.png',legend:'渡河赛跑，鼠藏于牛背，临岸纵身一跃抢得头名——机变投机，遂为生肖之首。',
    bronze:'败北重掷 15%：掷命输了概率重掷一次',silver:'败北重掷 25%',gold:'败北重掷 40% + 每局 1 次保底重掷' },
  { branch:'丑',animal:'牛',symbol:'续航',png:'assets/emoji/1f402.png',legend:'牛负重蹚河，本可夺魁，却被背上的鼠抢先一步，屈居第二——任劳任怨、厚重致远。',
    bronze:'续航 20%：概率多扛一场遭遇',silver:'续航 40%',gold:'续航 50%' },
  { branch:'寅',animal:'虎',symbol:'猛攻',png:'assets/emoji/1f405.png',legend:'山林之王，涉水而渡、威震百兽，名列第三——刚猛凛冽，民间奉为辟邪镇宅之神。',
    bronze:'战力 P_eff +2（被动）',silver:'战力 +4',gold:'战力 +6' },
  { branch:'卯',animal:'兔',symbol:'疾速',png:'assets/emoji/1f407.png',legend:'兔轻捷踏石过河，得居第四——灵巧迅捷；月中有玉兔捣药，又主长寿。',
    bronze:'行军速 +15%（被动）',silver:'行军速 +25%',gold:'行军速 +40% + 起步抢线' },
  { branch:'辰',animal:'龙',symbol:'帝王',png:'assets/emoji/1f409.png',legend:'龙本可先至，因途中行云布雨、济度苍生而误了时辰，居第五——唯一神兽，人间帝王之象。',
    bronze:'主将光环：全路友军战力 +3%',silver:'主将光环 +5%',gold:'主将光环 +8%（死则光环灭·全路士气短崩）' },
  { branch:'巳',animal:'蛇',symbol:'封印',png:'assets/emoji/1f40d.png',legend:'蛇隐于草丛、悄然渡河得第六——深沉智谋；蜕皮重生、缠绕噬人，俗谓「小龙」。',
    bronze:'封印 30%：败时概率封住战胜它的敌牌',silver:'封印 60%',gold:'封印 100% 必封' },
  { branch:'午',animal:'马',symbol:'冲锋',png:'assets/emoji/1f40e.png',legend:'马奔腾千里、欲争前列，却被草中之蛇惊退，居第七——豪迈奔放、驰骋不羁。',
    bronze:'突破推进 +20%：赢对决后本路加速',silver:'突破推进 +35%',gold:'突破推进 +50% + 连推' },
  { branch:'未',animal:'羊',symbol:'群护',png:'assets/emoji/1f410.png',legend:'羊与猴、鸡同心共乘一筏渡河，列第八——温良群居、跪乳知孝。',
    bronze:'替罪羊 50%：替相邻主将挡一次死',silver:'替罪羊 75%',gold:'替罪羊 100%' },
  { branch:'申',animal:'猴',symbol:'奇袭',png:'assets/emoji/1f412.png',legend:'猴机灵撑篙、协力划筏过河，居第九——机变百出；后世化为齐天大圣，神通无双。',
    bronze:'戏耍 30%：对决概率削当面敌战力',silver:'戏耍 50%',gold:'戏耍 70%' },
  { branch:'酉',animal:'鸡',symbol:'号令',png:'assets/emoji/1f413.png',legend:'鸡同筏而渡、司晨报晓，得第十——守信报时、唤醒光明。',
    bronze:'返点 50%：打出时概率返 1 召唤源泉',silver:'返点 75%',gold:'返点 100%' },
  { branch:'戌',animal:'狗',symbol:'守家',png:'assets/emoji/1f415.png',legend:'狗本善泳，却贪戏水而误了时辰，居十一——忠诚护主、看家守户。',
    bronze:'守家 +3 战力（被动）',silver:'守家 +5',gold:'守家 +8 + 该路敌推进减速' },
  { branch:'亥',animal:'猪',symbol:'财富',png:'assets/emoji/1f416.png',legend:'猪贪食酣睡、最后方至，敬陪末座——憨厚有福、丰足安乐。',
    bronze:'滚雪球 30%：击杀概率返材料',silver:'滚雪球 50%',gold:'滚雪球 70%' },
];

// 连携（doc20 §三 · 一卡 3 槽凑成组合 → 连携 bonus · 展示用；检测/apply 在甲战斗侧）。
export const DIZHI_TRINES: { name: string; members: string; effect: string }[] = [
  { name:'🌊 水·灵动不败', members:'申猴+子鼠+辰龙', effect:'整局 1 次必重掷（用掉即消失）——一局一张保命符' },
  { name:'🔥 火·燎原', members:'寅虎+午马+戌狗', effect:'赢对决后连推 1 次 + 破大本营时少量额外伤害' },
  { name:'⚔️ 金·肃杀', members:'巳蛇+酉鸡+丑牛', effect:'每场对决返 1 召唤源泉 + 击败的敌人限时不能再上场' },
  { name:'🌿 木·生生', members:'亥猪+卯兔+未羊', effect:'阵亡回手牌可重新派遣 + 击杀返材料' },
];
// 六合（二合连携 · 两生肖凑成 · 门槛比三合低、效果较轻）。镶嵌战斗 apply 待契约④（甲）。
export const DIZHI_PAIRS: { name: string; members: string; effect: string }[] = [
  { name:'土 · 子丑合', members:'子鼠 + 丑牛', effect:'大本营 +1 血（更耐打）' },
  { name:'木 · 寅亥合', members:'寅虎 + 亥猪', effect:'起手多摸 1 张牌' },
  { name:'火 · 卯戌合', members:'卯兔 + 戌狗', effect:'赢对决偶尔额外推进 1 格' },
  { name:'金 · 辰酉合', members:'辰龙 + 酉鸡', effect:'全军 +少量战力' },
  { name:'水 · 巳申合', members:'巳蛇 + 申猴', effect:'每回合首次抽牌返 1 召唤源泉' },
  { name:'日月 · 午未合', members:'午马 + 未羊', effect:'濒死兵 1 次免死' },
];
