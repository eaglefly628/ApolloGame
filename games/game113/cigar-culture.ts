/** 雪茄馆的文化研究卷：谈劳动、印刷和证据，不介绍消费或交易。 */
export const CIGAR_CULTURE_TIMELINE = [
  { year: '1844', title: '一间工坊，也是一座城市的故事', thread: 'H. Upmann', assetId: 'cigar.box.auckland', imageNote: '图为奥克兰博物馆藏旧盒局部，不是 H. Upmann 实物。', story: 'Herman Upmann 在哈瓦那经营银行与雪茄工厂。品牌的历史不只是一张商标：它也连接着移民、商业、印刷与城市生活。', ask: '一段品牌自述能说明创立时间；若要研究某一只旧盒，还需要它自己的馆藏号与来源链。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/h-upmann-brand/' },
  { year: '1845', title: '门牌留下的工坊记忆', thread: 'Partagás', assetId: 'cigar.rolling.trinidad', imageNote: '图为特立尼达的通用工坊实拍，不是 Partagás 现场。', story: 'Don Jaime Partagás 创立的工坊与哈瓦那的城市记忆相连。品牌史里的“老厂”值得读，但厂址、生产地点与今天的产品不能混为一谈。', ask: '看到一张工坊照片时，先问：摄影地点、日期、档案提供者是谁？', source: 'https://www.habanos.com/en/the-habanos-brands-academia/partagas-brand/' },
  { year: '1865', title: '手在工作，耳朵听见文学', thread: '工坊朗读者', assetId: 'cigar.rolling.trinidad', imageNote: '图为卷制工序实拍；画面没有朗读者，不能当作朗读现场证据。', story: '古巴工坊的朗读者在工作时为卷制者读报纸与文学作品。这一传统至少可追溯到 1865 年。工艺因此不仅是手上的动作，也有共同聆听的文化生活。', ask: '照片可以让我们看见劳动；声音的历史仍须由文献、口述和档案去补足。', source: 'https://www.habanos.com/en/totally-hand-made/' },
  { year: '1935', title: '一本小说怎样成为名字', thread: 'Montecristo', assetId: 'cigar.bands.mares', imageNote: '图为博物馆历史纸环陈列，不指认为 Montecristo 纸环。', story: 'Habanos 的品牌史称，Montecristo 于 1935 年在 H. Upmann 工厂创立，名字来自当时工坊朗读的《基督山伯爵》。一个名称由文学进入劳动现场，又进入印刷设计。', ask: '品牌叙事是研究入口；图上的任一纸环仍需独立核对年代、版本与出处。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/montecristo-brand/' },
  { year: '1969', title: '公开以前的另一种流通', thread: 'Trinidad', assetId: 'cigar.boxlabel.opera', imageNote: '图为约 1905 年的 Opera 盒标样张，与 Trinidad 无关。', story: 'Habanos 将 Trinidad 的起点记在 1969 年，并记述它曾用于外交馈赠，到 1998 年才面向公众销售。流通方式会改变一个名字的社会含义，但不能由此推论今天的稀缺性或价值。', ask: '档案研究要分清“品牌创立”“特殊用途”“公开销售”三个时间节点。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/trinidad-brand/' },
] as const;

export const CIGAR_CULTURE_LENSES = [
  { role: '材料研究者', mark: '叶', question: '叶片在什么条件下长成，又经过什么处理？', method: '把拍摄地、叶位、栽培方式与后续处理分成四栏；一张田野照只能填写其中一部分。', assetId: 'cigar.field.pennsylvania', imageNote: '实拍：宾夕法尼亚烟田。不是古巴品牌原料证明。', source: 'https://www.habanos.com/en/the-perfect-leaf/' },
  { role: '劳动史读者', mark: '手', question: '谁做了这件物，工坊里还有怎样的声音？', method: '用工序照片找动作，用历史文献找朗读者；不要把两种证据伪装成同一现场。', assetId: 'cigar.rolling.trinidad', imageNote: '实拍：特立尼达工坊卷制现场；未拍到朗读者。', source: 'https://www.habanos.com/en/totally-hand-made/' },
  { role: '印刷收藏者', mark: '纸', question: '字体、徽记与版式如何随年代变化？', method: '留正反面、尺寸、纸张与来源；同名图案不等于同一印次。', assetId: 'cigar.bands.mares', imageNote: '实拍：巴塞罗那博物馆历史纸环陈列。', source: 'https://www.habanos.com/en/applying-bands/' },
  { role: '公共健康研究者', mark: '界', question: '文化叙事的边界在哪里？', method: '欣赏农业、设计和劳动史，不等于推荐使用烟草；任何形式烟草使用都有害。', assetId: 'cigar.tools.wisconsin', imageNote: '实拍：威斯康星历史博物馆工具，不是健康或安全证据。', source: 'https://www.who.int/news-room/fact-sheets/detail/tobacco' },
] as const;

export const CIGAR_BRAND_FILES = [
  { name: 'H. Upmann', founded: '1844', signature: '商业、城市与印刷', note: '从创办者与哈瓦那工厂出发，比较老包装上的文字与奖章图案；奖章是历史图像，不是当前品质认证。', verify: '具体纸环或木盒：馆藏编号、正反面、尺寸、版本。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/h-upmann-brand/' },
  { name: 'Partagás', founded: '1845', signature: '工坊与街道记忆', note: '由创办者和历史厂址读城市工坊史。历史厂址、后来的生产地点与单件器物来源应分栏记。', verify: '具体工坊照片：地点、年代、拍摄者、档案出处。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/partagas-brand/' },
  { name: 'Montecristo', founded: '1935', signature: '文学进入工坊', note: '名字牵出朗读者与《基督山伯爵》的故事。研究纸本时还可追问：一个文学题材怎样被转译成视觉标识？', verify: '具体纸环：字体、色版、背面和可核对的版本资料。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/montecristo-brand/' },
  { name: 'Trinidad', founded: '1969', signature: '馈赠与公开流通', note: '把品牌起点、外交馈赠时期和 1998 年公开销售分开看。它反映一种历史流通方式，不构成稀有度或价格判断。', verify: '具体物件：制作时间、公开流通版本与可信来源链。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/trinidad-brand/' },
  { name: 'Romeo y Julieta', founded: '1875', signature: '莎士比亚走进纸环', note: '名字来自莎士比亚的同名悲剧。文学角色进入商业印刷后，研究者可以追问不同年代的文字、人物与图案如何变化。', verify: '具体纸环：正反面、文字版本、印法和可核对的年代证据。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/romeo-y-julieta-brand/' },
  { name: 'Punch', founded: '19 世纪中叶', signature: '英国讽刺刊物与跨海市场', note: 'Habanos 记述这个名字与英国同名幽默刊物有关。把纸盒上的角色当作跨国视觉文化来读，比只把它当成一个商标更有意思。', verify: '具体盒面：人物图像、文字符号、版次及馆藏来源。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/punch-brand/' },
  { name: 'Bolívar', founded: '1902', signature: '历史人物成为商标', note: '名字取自西蒙·玻利瓦尔。一个独立运动人物进入包装图像，值得问的是：当年的商业设计选择了怎样的肖像与叙事？', verify: '具体图像：肖像版本、印刷载体、制作年代与馆藏记录。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/bolivar-brand/' },
  { name: 'Cohiba', founded: '1966', signature: '政治馈赠与公开发行', note: '品牌方记载它起初用于政治与外交馈赠，1982 年开始在多国公开销售。把政治语境与商业语境分开写，才能看清一个名字如何变义。', verify: '具体纸本：用途时期、版本与可靠的档案出处。', source: 'https://www.habanos.com/en/the-habanos-brands-academia/cohiba-brand/' },
] as const;
