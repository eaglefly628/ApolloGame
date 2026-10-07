/** 策展候选图谱。这里的名称不是已核验实物、交易商品或价格。 */
export type AtlasBranch = {
  id: string;
  name: string;
  objects: readonly string[];
  note?: string;
  openHobby?: 'watch' | 'wine' | 'walnut' | 'woodwork' | 'sake' | 'cigar' | 'car';
};
export type AtlasGroup = {
  id: string;
  name: string;
  lens: string;
  branches: readonly AtlasBranch[];
};

export const ATLAS_GROUPS: readonly AtlasGroup[] = [
  { id: 'time', name: '岁月与风味', lens: '风土、熟成、保存与日常仪式', branches: [
    { id: 'wine', name: '葡萄酒与起泡酒', objects: ['波尔多左岸', '勃艮第村庄与园地', '香槟', '自然酒', '老年份酒标与酒具'], openHobby: 'wine' },
    { id: 'sake', name: '清酒与酒器文化', objects: ['纯米酒标', '吟酿与大吟酿标签', '酒藏工艺记录', '陶制酒器', '瓶封与包装'], note: '仅面向达到当地法定饮酒年龄的成年人；只展示分类与器物文化，不开放清酒交易。', openHobby: 'sake' },
    { id: 'spirits', name: '烈酒与陈酿', objects: ['单一麦芽威士忌', '干邑', '朗姆酒', '龙舌兰', '老白酒', '迷你酒版'] },
    { id: 'tea', name: '茶与茶器', objects: ['普洱茶', '岩茶', '老白茶', '单丛', '紫砂壶', '建盏与茶盘'] },
    { id: 'coffee', name: '精品咖啡', objects: ['产地生豆', '手摇磨豆机', '意式咖啡机', '手冲壶', '滤杯', '咖啡杯具'] },
    { id: 'cigar', name: '雪茄与配套器物', objects: ['古巴品牌与系列', '非古品牌与系列', '茄盒', '保湿盒', '雪茄剪与打火器'], note: '成人限定候选；先做历史、工艺与器物知识，不开放真实交易。', openHobby: 'cigar' },
    { id: 'food', name: '可溯源的风味珍藏', objects: ['陈年奶酪', '熟成火腿', '橄榄油', '蜂蜜', '香料', '巧克力模具与包装'] },
    { id: 'beer-cider', name: '精酿与果酒文化', objects: ['精酿啤酒罐标', '苹果酒瓶标', '酿造工具', '品饮杯', '啤酒杯垫'], note: '酒精相关内容只作为成人文化候选。' },
    { id: 'tableware', name: '餐桌器物', objects: ['手工餐刀叉', '老式醒酒器', '餐具套装', '餐巾环', '奶酪刀', '咖啡杯碟'] },
    { id: 'tobacco-pipe', name: '烟斗与打火器文化', objects: ['石楠木烟斗', '海泡石烟斗', '烟斗架', '打火机', '烟草罐'], note: '成人限定器物史，不做烟草消费引导。' },
    { id: 'fermentation', name: '发酵与保存器具', objects: ['陶制发酵罐', '玻璃密封罐', '酿造温度计', '老式压榨器', '食谱手稿'] },
  ] },
  { id: 'mechanics', name: '精密机械', lens: '结构、工艺、修复与年代', branches: [
    { id: 'watches', name: '腕表与钟表', objects: ['潜水表', '计时码表', '正装表', '怀表', '旅行钟', '表带与工具'], openHobby: 'watch' },
    { id: 'cameras', name: '摄影器材', objects: ['胶片旁轴', '机械单反', '中画幅', '数码旁轴', '定焦镜头', '测光表与闪光灯'] },
    { id: 'video', name: '影像与摄录', objects: ['电影摄影机', '8 毫米放映机', '摄像机', '电影镜头', '三脚架云台', '录音机'] },
    { id: 'audio-hardware', name: '音频器材', objects: ['黑胶唱机', '磁带机', '耳机', '胆机', '麦克风', '便携播放器'] },
    { id: 'automotive', name: '经典交通机械', objects: ['经典汽车', '老摩托车', '自行车车架', '车模', '徽章与车册'], openHobby: 'car' },
    { id: 'instruments', name: '机械仪器', objects: ['望远镜', '显微镜', '指南针', '老计算器', '机械打字机', '航海仪表'] },
    { id: 'radio', name: '收音机与无线电', objects: ['晶体管收音机', '短波收音机', '真空管', '老式天线', '电台徽章'] },
    { id: 'computing', name: '复古计算设备', objects: ['早期掌上电脑', '机械键盘', '计算尺', '老式游戏掌机', '磁盘盒'], note: '电池、电源及数据隐私须单独核查。' },
    { id: 'music-machines', name: '电子乐器与合成器', objects: ['模拟合成器', '鼓机', '效果器', '老式电子琴', '音序器'] },
    { id: 'lighting', name: '灯具与光学装置', objects: ['老式台灯', '投影机', '幻灯机', '透镜', '光学万花筒'] },
    { id: 'timekeeping', name: '计时与测量装置', objects: ['机械秒表', '老式气压计', '温湿度仪', '航海钟', '沙漏'] },
  ] },
  { id: 'craft', name: '手艺与器物', lens: '材料、制作、修复与手感', branches: [
    { id: 'wood', name: '木工与木作', objects: ['榫卯家具', '木工刨', '凿与锯', '木材样本', '微缩家具'], openHobby: 'woodwork' },
    { id: 'ceramics', name: '陶瓷与玻璃', objects: ['手作茶杯', '工作室陶器', '吹制玻璃', '花瓶', '玻璃纸镇'] },
    { id: 'metal', name: '金工与小型器物', objects: ['铜器', '银器', '珐琅', '打火机', '怀炉', '金属徽章'] },
    { id: 'writing', name: '书写工具', objects: ['钢笔', '墨水', '铅笔', '笔盒', '手工纸', '印章与蜡封'] },
    { id: 'leather-textile', name: '皮革与织物', objects: ['手工皮具', '皮具工具', '丝巾', '织毯', '古着纽扣', '缝纫机'] },
    { id: 'toys-models', name: '模型与微缩', objects: ['火车模型', '建筑模型', '拼装模型', '微缩家具', '积木限定套装'] },
    { id: 'incense-tools', name: '香道与香器', objects: ['香炉', '香插', '香盒', '香篆工具', '香材收纳器'], note: '涉及香材时须核查物种与来源；器物可先独立策展。' },
    { id: 'jewelry', name: '首饰工艺', objects: ['银饰', '珐琅胸针', '手作戒指', '宝石切割样本', '首饰盒'], note: '宝石及贵金属须核验材质，不以 AI 图做品质说明。' },
    { id: 'bookbinding', name: '装帧与纸艺', objects: ['手工装帧书', '纸雕', '木活字', '版画工具', '旧式书挡'] },
    { id: 'musical-instruments', name: '手工乐器', objects: ['手工吉他', '口琴', '尤克里里', '陶笛', '琴弓与琴盒'] },
    { id: 'restoration', name: '修复工具与材料', objects: ['钟表修理工具', '陶瓷修补器', '皮具护理工具', '木作修复夹具', '保存盒'] },
    { id: 'knives-tools', name: '刀具与手工具', objects: ['木工刻刀', '折叠工具', '厨师刀', '磨刀石', '皮具裁刀'], note: '只作工艺与器物知识；展示、邮寄和交易规则须按地区审核。' },
  ] },
  { id: 'nature', name: '微观自然', lens: '观察、培育、装置与生态知识', branches: [
    { id: 'plants', name: '植物与园艺器物', objects: ['盆景盆器', '兰花器具', '多肉栽培器', '苔藓微景观', '种子图鉴'] },
    { id: 'insects', name: '鸣虫与斗蟋蟀文化', objects: ['蟋蟀罐', '葫芦虫具', '鸣虫盒', '昆虫图鉴', '观察镜'], note: '斗蟋蟀作为文化史与器物方向；不设计下注、赌斗或活体交易。' },
    { id: 'aquatic', name: '水族与造景', objects: ['观赏鱼缸', '水草造景', '陶瓷躲避屋', '水质工具', '造景石材'] },
    { id: 'natural-history', name: '自然史物件', objects: ['矿物晶体', '陨石切片', '普通化石', '岩石标本盒', '显微切片'], note: '来源、物种与跨境流通须逐项核查；不纳入受保护物种。' },
    { id: 'terrarium', name: '微景观与生态瓶', objects: ['苔藓瓶', '微型蕨类盆器', '生态瓶工具', '造景木', '玻璃罩'] },
    { id: 'birdwatching', name: '观鸟器材与图鉴', objects: ['双筒望远镜', '鸟类图鉴', '观察笔记本', '录音设备', '观鸟徽章'], note: '只观察野生鸟类，不把野鸟或鸟巢作为藏品。' },
    { id: 'mushroom', name: '菌菇栽培器具', objects: ['培养瓶', '显微观察工具', '孢子图鉴', '栽培架', '温湿度记录器'], note: '物种与地区限制需逐项核查。' },
    { id: 'shells', name: '贝壳与海边拾趣', objects: ['合法来源贝壳', '潮间带图鉴', '海玻璃', '标本盒', '放大镜'], note: '保护物种与采集地点要核查；不鼓励非法采集。' },
  ] },
  { id: 'culture', name: '文化与感官', lens: '版别、图像、声音与记忆', branches: [
    { id: 'records', name: '唱片与实体音乐', objects: ['黑胶唱片', '磁带', 'CD 首版', '演出海报', '唱片封套'] },
    { id: 'books', name: '书刊与纸品', objects: ['摄影集', '绝版书', '漫画初版', '杂志创刊号', '藏书票'] },
    { id: 'ephemera', name: '邮币票证', objects: ['邮票', '明信片', '车票', '地图', '老广告', '纸币与纪念币'] },
    { id: 'games', name: '桌游与棋具', objects: ['国际象棋', '围棋棋具', '复古桌游', '集换式卡牌', '骰塔与收纳盒'] },
    { id: 'beauty', name: '香水与美妆藏品', objects: ['经典香水瓶', '限定香氛包装', '复古粉盒', '口红外壳', '美妆联名礼盒'], note: '收藏重点是包装、器物与设计；过期内容物不得宣传使用。' },
    { id: 'fashion', name: '服饰配件', objects: ['古着丝巾', '设计师眼镜', '胸针', '袖扣', '皮包', '球鞋限定配色'] },
    { id: 'walnuts', name: '文玩与把玩器', objects: ['文玩核桃', '核雕', '木珠', '扇子', '手把件'], openHobby: 'walnut' },
    { id: 'prints', name: '版画与摄影作品', objects: ['签名版画', '银盐照片', '摄影明信片', '展览图录', '相框'], note: '版权、版数与签名须由授权资料确认。' },
    { id: 'film-memory', name: '电影与舞台纪念物', objects: ['电影海报', '节目册', '电影票根', '道具复制品', '剧场徽章'] },
    { id: 'toys', name: '玩具与人物模型', objects: ['铁皮玩具', '设计师玩具', '人偶', '拼装手办', '玩具包装盒'] },
    { id: 'maps-travel', name: '地图与旅行纸本', objects: ['城市老地图', '旅行手册', '明信片册', '酒店行李牌', '船票'] },
    { id: 'advertising', name: '广告与包装设计', objects: ['老式铁盒', '品牌海报', '包装纸', '火柴盒', '百货目录'] },
  ] },
  { id: 'outdoor', name: '身手与户外', lens: '围绕爱好沉淀可收藏的工具', branches: [
    { id: 'fishing', name: '钓鱼与拟饵', objects: ['手作路亚饵', '卷线器', '竹竿', '飞蝇钓毛钩', '钓具盒'] },
    { id: 'golf', name: '高尔夫器具', objects: ['老式推杆', '球杆头', '球场纪念球', '球袋', '赛事出版物'] },
    { id: 'camping', name: '露营与行旅', objects: ['老式营灯', '手作刀具', '户外杯壶', '指南针', '背包'], note: '刀具展示与交易需按地区规则另审。' },
    { id: 'cycling', name: '骑行与机械零件', objects: ['钢架公路车', '复古变速器', '车灯', '骑行帽', '赛事海报'] },
    { id: 'sailing', name: '帆船与航海器物', objects: ['帆船模型', '航海罗盘', '船用灯', '航海图', '绳结工具'] },
    { id: 'equestrian', name: '马术器物', objects: ['马鞍工艺', '马具皮件', '赛事徽章', '马术服饰', '马匹摄影集'], note: '只收藏器物与资料，不将活体马匹纳入普通藏品交易。' },
    { id: 'archery', name: '射箭与靶具', objects: ['传统弓工艺', '护臂', '箭袋', '靶纸', '赛事纪念章'], note: '弓具展示及交易须按地区规则审核。' },
    { id: 'hiking', name: '徒步与山野装备', objects: ['老式登山杖', '地图与路书', '营地徽章', '背包', '便携炉具'] },
    { id: 'diving', name: '潜水与海洋器材', objects: ['复古潜水面镜', '潜水表', '水下相机', '潜水日志', '海洋图鉴'] },
  ] },
];

export type AtlasGuide = { id: string; title: string; intro: string; axes: readonly { name: string; values: string }[]; examples: readonly string[]; caution: string };
export const ATLAS_GUIDES: readonly AtlasGuide[] = [
  { id: 'watches', title: '腕表怎么逛？', intro: '先分产地与制表传统，再看品牌、系列、正式型号，最后才看表盘、表圈、年代与品相。', axes: [
    { name: '产地', values: '瑞士、日本、德国、中国等' }, { name: '类型', values: '潜水、计时、正装、飞行、怀表' }, { name: '品牌 / 系列', values: 'Rolex → Submariner；Omega → Speedmaster；Seiko → Prospex' }, { name: '型号 / 版本', values: '参考编号、表盘、表圈、机芯、年份、附件与维修记录' },
  ], examples: ['“黑水鬼”是玩家俗称；现行 Submariner Date 126610LN 为黑表圈、黑表盘。', '“绿水鬼”也不是正式型号名；现行 126610LV 为绿表圈、黑表盘。'], caution: '品牌、型号、配色与真假必须以官方资料及实物核验；AI 图绝不可充当具体表款照片。' },
  { id: 'cigar', title: '雪茄怎么分？', intro: '以产区 → 品牌 → 系列 / 商品名 → 茄型与尺寸 → 盒装版本组织资料，不把俗称当正式 SKU。', axes: [
    { name: '产区', values: '古巴、尼加拉瓜、多米尼加、洪都拉斯等' }, { name: '品牌', values: 'Cohiba、Montecristo、Partagás；以及非古品牌' }, { name: '具体系列', values: 'Montecristo Edmundo / Petit Edmundo；Partagás Serie D No. 4 / Serie P No. 2' }, { name: '规格与盒装', values: '茄型、长度、环径、盒装、年份与封签' },
  ], examples: ['同一品牌会有多个系列与茄型，不能把品牌当单一藏品。', '保湿盒、剪刀、打火器也可独立成为器物分支。'], caution: '成人门类：App 内先呈现历史与工艺知识；年龄、地区及广告/交易规则审查前不开放销售或主动推荐。' },
  { id: 'cameras', title: '摄影器材怎么分？', intro: '按成像介质和结构找方向，再用品牌、卡口、型号、镜头与配件构成可长期扩展的目录。', axes: [
    { name: '介质', values: '胶片、数码、即时成像' }, { name: '机身', values: '旁轴、单反、双反、中画幅、无反、摄像机' }, { name: '镜头', values: '卡口、焦段、最大光圈、版本与生产年代' }, { name: '配套', values: '测光表、闪光灯、取景器、三脚架、摄影包' },
  ], examples: ['胶片旁轴与定焦镜头是两个可独立收藏的分支。', '购买知识先看镜片状态、快门、测光、维修记录，而不是只看外观。'], caution: '后续上线真实物件时，须核对机身序列、功能与镜片实际状态。' },
  { id: 'insects', title: '斗蟋蟀文化怎么收？', intro: '把重点放在民俗、观察、器具和工艺，不将斗赛、下注或活体买卖做成玩法。', axes: [
    { name: '器具', values: '蟋蟀罐、过笼、葫芦、鸣虫盒' }, { name: '制作', values: '泥料、制式、工坊、年代与修复' }, { name: '知识', values: '鸣虫图鉴、地方习俗、声音记录' },
  ], examples: ['一只蟋蟀罐可以按材质、制作工艺、年代、品相建档。'], caution: '不接赌斗机制；活体与地方规则留待专项审查。' },
  { id: 'beauty', title: '香水与美妆能收什么？', intro: '从容器设计、限量包装、联名与历史版本切入，把“审美收藏”与“可继续使用的化妆品”分开。', axes: [
    { name: '香氛', values: '香水瓶型、限量瓶身、旅行装、老广告' }, { name: '彩妆', values: '复古粉盒、口红外壳、限定礼盒、设计师联名' }, { name: '档案', values: '品牌、系列、版本、批次、封装、保存状态' },
  ], examples: ['一只雕刻粉盒与其内容物应分别建档。', '限定包装可以作为设计物件讲故事，不等于里面的产品仍可使用。'], caution: '不推荐使用过期化妆品；旧瓶、包装和实物照片须取得授权并核验。' },
];

export const ATLAS_BRANCH_COUNT = ATLAS_GROUPS.reduce((n, group) => n + group.branches.length, 0);
export const ATLAS_OBJECT_COUNT = ATLAS_GROUPS.reduce((n, group) => n + group.branches.reduce((m, branch) => m + branch.objects.length, 0), 0);
