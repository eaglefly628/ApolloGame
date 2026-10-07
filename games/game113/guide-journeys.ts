import type { Hobby } from './data.js';

export type GuideScene = {
  id: string;
  chapter: string;
  place: string;
  opening: string;
  question: string;
  choices: readonly [{ label: string; insight: string }, { label: string; insight: string }];
  discovery: string;
  deeper: string;
  evidence: string;
  archive: { label: string; tab: string };
};

export type GuideJourney = {
  guideName: string;
  guideMark: string;
  guideRole: string;
  invitation: string;
  scenes: readonly GuideScene[];
};

const sake: GuideJourney = {
  guideName: '杉翁', guideMark: '杉', guideRole: '虚构的清酒引路师傅',
  invitation: '先别背酒名。跟我在门前、酿造间和酒标桌各看几处；过了出门小考，我们再往里走。',
  scenes: [
    {
      id: 'time', chapter: '时间的门', place: '酒藏门前 · 一颗杉玉',
      opening: '门前挂着杉枝结成的球。有人说它在讲新酒的消息，也有人立刻讲起古老的神话。我们先分清：故事与史证，各自能告诉我们什么？',
      question: '你想先拾起哪条线索？',
      choices: [
        { label: '听杉玉的故事', insight: '杉玉是酒藏传递新酒消息的一种传统符号。它让一座酒藏有了季节感，却不能替一瓶具体酒证明年份或品相。' },
        { label: '翻开历史年表', insight: '清酒的做法历经漫长变化。古代记载、寺社酿造、近代研究是不同阶段，不能把古代的酒直接叫作今天的清酒。' },
      ],
      discovery: '传说可以唤起好奇，史实要留下证据。两者都值得读，但绝不混为一谈。',
      deeper: '八岐大蛇故事里的酒，是神话中的酒；它不是现代清酒起源的证据。2024 年列入联合国教科文组织非遗名录的是“使用麹菌的日本传统酒造知识与技艺”，也不是某个品牌的认证。',
      evidence: '依据：馆内「历史与传说」与「资料索引」；神话标记为非史证。',
      archive: { label: '去看历史与传说', tab: 'culture' },
    },
    {
      id: 'koji', chapter: '米的另一种命运', place: '酿造间 · 米与麹',
      opening: '同样是一粒米，磨去外层、蒸熟，再让麹菌在米上生长。接下来发生的事，决定了为什么清酒的工艺如此特别。',
      question: '你要先观察哪一处？',
      choices: [
        { label: '看麹怎样工作', insight: '麹菌产生的酶把米中的淀粉分解为糖；酒母则为酵母建立合适环境。它们做的并不是同一件事。' },
        { label: '看精米的数字', insight: '精米步合说的是精米后白米重量相对糙米的比例。写着 45%，不是“品质得了 45 分”。' },
      ],
      discovery: '麹的糖化与酵母的酒精发酵在醪中同时进行；一个数字不足以讲完酿造。',
      deeper: '从精米、洗米、蒸米与制麹，到酒母、醪、压榨与火入，每一步都可能改变作品。若两款酒的米种和精米都不同，就不能把风味差异全部归因于“磨得更少”。',
      evidence: '依据：馆内「酿造与酒标」；日本酒造组合中央会酿造资料收于馆内索引。',
      archive: { label: '进入酿造间', tab: 'path' },
    },
    {
      id: 'label', chapter: '读懂一张酒标', place: '纸本桌 · 正标与背标',
      opening: '桌上有一张酒标。它写着“纯米大吟酿”，旁边还有精米步合。先别猜价格，也别急着给它排等级。',
      question: '你会先记录哪一栏？',
      choices: [
        { label: '抄下分类词', insight: '纯米、吟酿、本酿造涉及原料与工艺要求；它们不是从低到高的一条品味阶梯。先保存标签原文，再写解释。' },
        { label: '寻找酒藏与产地', insight: '酒藏名称、实际酿造地、原料来源可能不是同一个地点。尤其跨国酒藏，不能只凭品牌国籍填写产地。' },
      ],
      discovery: '好档案先忠实记录：标签原文、酒藏、地点、容量、版本；解释另起一栏。',
      deeper: '以风之森「露叶风 507」与「露叶风 807」为例，同一酒米可以进入不同精米设置。数字是追问工艺的线索，不是品味或价值的自动排行榜。',
      evidence: '依据：馆内「酿造与酒标」「风之森名酒深读」及油长酒造产品资料索引。',
      archive: { label: '细读名酒档案', tab: 'cellar' },
    },
    {
      id: 'place', chapter: '名字之外的土地', place: '地图桌 · 米与酒藏',
      opening: '一瓶在纽约酿的清酒，酒米可能来自另一个地方。若只认品牌，会错过一个重要问题：这瓶究竟在哪里酿造、用了什么米？',
      question: '你的档案先留哪条证据？',
      choices: [
        { label: '核对实际酿造地', insight: 'Brooklyn Kura 在纽约酿造；产地不能只按酒米的来源填写。' },
        { label: '核对酒米与酒标', insight: 'Blue Door 官方资料列出 Calrose 与山田锦；先记产品名、米种、版本，再核对批次。' },
      ],
      discovery: '品牌是入口，产地和版本才让具体作品成为可核对的对象。',
      deeper: 'Brooklyn Kura 的 Blue Door 是生酒，Tidal 是调和的纯米酒；同一酒藏也有不同保存线索。记录酿造地、米来源、容量、批次和具体酒款，比只记一个品牌更有意义。',
      evidence: '依据：馆内「世界酒藏」；Brooklyn Kura 的具体产品资料收于馆内索引。',
      archive: { label: '展开世界酒藏', tab: 'world' },
    },
    {
      id: 'care', chapter: '时间会留下什么', place: '收藏室 · 两份记录',
      opening: '一边是新政 No.6 生酒，一边是适合研究时间与熟成主题的作品。它们都令人好奇，却不能用同一套“越久越值钱”的逻辑。',
      question: '你先为藏品补上什么？',
      choices: [
        { label: '保存与冷链记录', insight: '新政官方将 No.6 列为未火入的生酒，提示持续冷藏与尽早饮用；讨论度不能改变保存要求。' },
        { label: '年份与批次记录', insight: '同名酒款也会随年度改变。记录酿造年度、出荷月份和标签版本，才能知道自己说的是哪一瓶。' },
      ],
      discovery: '收藏不只是拥有，更是把来源、版本、保存和变化诚实地记录下来。',
      deeper: '酒液、空瓶、酒标、酒器与纸本文献是不同藏品。实物判断需要原始多角度照片、来源和人工核验；AI 氛围图不能作为真伪或品相证据。',
      evidence: '依据：馆内「鉴赏与收藏」「新政名酒深读」及资料索引；这里不提供饮用或交易建议。',
      archive: { label: '去看鉴赏与收藏', tab: 'appreciation' },
    },
  ],
};

const cigar: GuideJourney = {
  guideName: '叶伯', guideMark: '叶', guideRole: '虚构的雪茄工艺与纸本引路师傅',
  invitation: '你不需要懂品牌，也不需要接触或使用烟草。跟我看五章实物与史料：认层次、看烟叶、读手艺、赏纸本、留档案。仅限达到所在地法定烟草年龄的成年人。',
  scenes: [
    { id: 'anatomy', chapter: '一支雪茄的内外', place: '观察桌 · 一个真实切面', opening: '先别问哪支贵。看见外层、内部，再把一圈印刷纸环从叶片中分开。', question: '先看什么？', choices: [{ label: '看切面', insight: '三层先分开。' }, { label: '看纸环', insight: '纸环不是烟叶。' }], discovery: '结构与包装是两类证据。', deeper: '具体配方不能凭切面猜。', evidence: '依据：馆内证据簿与 Habanos 官方资料。', archive: { label: '写下第一条手记', tab: 'notes' } },
    { id: 'leaf', chapter: '一片叶的来处', place: '田间 · 烟叶与晾叶棚', opening: '叶片从田里来，但一张烟田照片并不自动说明它属于哪一款雪茄。', question: '先看什么？', choices: [{ label: '看田地', insight: '记录真实拍摄地点。' }, { label: '看晾叶', insight: '分清采收后的工序。' }], discovery: '产地、栽培与分选分别记录。', deeper: '不把通用烟田冒充品牌供应链。', evidence: '依据：馆内证据簿与 Habanos 官方资料。', archive: { label: '进入田间与工艺', tab: 'path' } },
    { id: 'craft', chapter: '工匠与木模', place: '工坊 · 手、叶与工具', opening: '手工不是一句赞美词。先看工匠实际在做什么，再看木模和工具留下的历史。', question: '先看什么？', choices: [{ label: '看卷制者', insight: '照片只记录一个工序瞬间。' }, { label: '看历史木模', insight: '工具也有自己的年代。' }], discovery: '工艺要落在动作和器物上。', deeper: '历史工具不是现代品质证明。', evidence: '依据：馆内证据簿与博物馆器物资料。', archive: { label: '听一段工坊文化', tab: 'culture' } },
    { id: 'paper', chapter: '一圈纸上的世界', place: '纸本室 · 纸环与盒标', opening: '没有接触烟草，也可以从印刷物读到一段设计与商业史。', question: '先看什么？', choices: [{ label: '看纸环', insight: '文字与图案可独立建档。' }, { label: '看历史盒标', insight: '设计稿不是生产记录。' }], discovery: '纸本是藏品，不是品牌保证。', deeper: '同名图案未必来自同一件物。', evidence: '依据：馆内证据簿与博物馆藏品记录。', archive: { label: '打开纸本与器具档案', tab: 'objects' } },
    { id: 'archive', chapter: '留下可信的卷', place: '档案桌 · 来源与边界', opening: '最后一章，学会说“我知道什么，也不知道什么”。', question: '先留什么？', choices: [{ label: '记录对象', insight: '纸本、木盒与工具分开建档。' }, { label: '记录边界', insight: '学习不等于消费倡议。' }], discovery: '证据让好奇心走得更远。', deeper: '健康风险不因文化兴趣而消失。', evidence: '依据：馆内证据簿、WHO 与 Apple 官方资料。', archive: { label: '继续深读器物档案', tab: 'objects' } },
  ],
};

const woodwork: GuideJourney = {
  guideName: '木知', guideMark: '木', guideRole: '木作馆的引路精灵',
  invitation: '一件作品先不问价格。从纹理、接合与修补的线索里，慢慢看见手艺。',
  scenes: [
    { id: 'grain', chapter: '纹理不是答案', place: '木作台 · 一块端面木样', opening: '只看正面纹理，很容易把木种猜得太快。我们先为这块木头建立观察记录。', question: '先看哪一处？', choices: [{ label: '观察端面', insight: '把端面、径面、弦面分开记录；木种结论要有来源与可核验的材质资料。' }, { label: '询问材料来源', insight: '一段可追溯的采样记录，比凭照片猜一个昂贵木种更有用。' }], discovery: '描述证据，比抢着给物件命名更接近手艺。', deeper: '照片里的色彩会受光线和处理影响。完整的材料档案要有原图、尺寸、采样位置与后续核验。', evidence: '依据：馆内「入门路径」「器物档案」；这只是观察练习。', archive: { label: '看木作入门路径', tab: 'path' } },
    { id: 'join', chapter: '两块木如何相遇', place: '工作台 · 一处榫接', opening: '漂亮的接合不只是一道花纹，它还回答受力与使用的问题。', question: '你先留下什么线索？', choices: [{ label: '拍接合处的侧面', insight: '肩线、榫头与榫眼的关系，需要多角度才能看清。' }, { label: '问制作者为何这样做', insight: '制作人的取舍与使用情境，可以让结构记录不止停在“好看”。' }], discovery: '先看结构，再听创作选择，最后才讨论风格。', deeper: '一张示意图不足以判断接合是否牢固，也不能据此断定一件作品“纯手工”。', evidence: '依据：馆内「入门路径」「器物档案」；真实物件尚待实拍。', archive: { label: '打开器物档案', tab: 'objects' } },
    { id: 'trace', chapter: '给时间留一个位置', place: '手记桌 · 一处旧修补', opening: '一道修补痕迹，是缺点，也是一个值得问清楚的经历。', question: '你会先做哪件事？', choices: [{ label: '保存修补前原图', insight: '原貌与修复后的照片要分开存，标注日期、位置与所用材料。' }, { label: '向同好请教做法', insight: '具体问题与多角度证据能让交流更有质量；别人也不必凭一张图猜结论。' }], discovery: '收藏成长，是把物件的来处与变化认真留下来。', deeper: '档案可以记录修补者、处理过程与使用状态；年代、木种和价值仍需实物与专业审校。', evidence: '依据：馆内「器物档案」「同好议题」；非实物鉴定。', archive: { label: '与同好聊观察', tab: 'people' } },
  ],
};

/** 同一套引路机制覆盖每座爱好馆；深读馆使用逐章审校的专属脚本。 */
export function guideJourneyFor(hobby: Hobby): GuideJourney {
  if (hobby.id === 'sake') return sake;
  if (hobby.id === 'cigar') return cigar;
  if (hobby.id === 'woodwork') return woodwork;
  return {
    guideName: `${hobby.name}引路人`, guideMark: hobby.name.slice(0, 1), guideRole: `${hobby.name}馆的引路精灵`,
    invitation: `先跟我走三个观察点，认识${hobby.name}的门道。这是导览样章，具体物件仍需真实资料核验。`,
    scenes: hobby.learning.map((lesson, index) => ({
      id: `intro-${index}`, chapter: lesson, place: `${hobby.name}馆 · 观察桌`,
      opening: `今天只看一件事：${lesson}。先留一个问题，再去读具体作品，不急着凭示意图下结论。`,
      question: '你想怎样开始？',
      choices: [
        { label: '先观察物件', insight: '记下自己真正看见的细节；目前馆内物件图片是 AI 示意，不是鉴定依据。' },
        { label: '先提出问题', insight: '把想知道的来源、工艺或状态写成具体问题，再去核对资料。' },
      ],
      discovery: '有了观察与问题，下一页资料才会真正和你有关。',
      deeper: '这一馆的深层资料仍在策展与核验中；不把尚未查证的故事、价格或品相写成事实。',
      evidence: '导览样章 · 待补经审校的专属资料与真实图片。',
      archive: { label: '自由浏览爱好馆', tab: 'overview' },
    })),
  };
}
