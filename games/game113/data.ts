export type HobbyId = 'watch' | 'wine' | 'walnut' | 'woodwork' | 'sake' | 'cigar' | 'car';
export type ImageSource = {
  src: string;
  kind: 'ai-demo' | 'verified-photo';
  credit?: string;
  license?: string;
  originalRef?: string;
};
export type Hobby = {
  id: HobbyId;
  name: string;
  english: string;
  category: string;
  categoryLabel: string;
  tagline: string;
  intro: string;
  image: ImageSource;
  people: string;
  learning: string[];
};
export type Collectible = {
  id: string;
  hobbyId: HobbyId;
  name: string;
  subtitle: string;
  tier: string;
  price: number;
  change: number;
  image: ImageSource;
  description: string;
  details: [string, string][];
  spots: { x: number; y: number; title: string; body: string }[];
};

const demo = (file: string): ImageSource => ({ src: `/games/game113/demo/${file}.png`, kind: 'ai-demo' });

export const HOBBIES: Hobby[] = [
  { id: 'watch', name: '机械表', english: 'Mechanical Watches', category: 'precision', categoryLabel: '精密机械', tagline: '听见时间的手艺', intro: '从擒纵、摆轮到打磨，认识一枚机械表如何记录时间。', image: demo('watch-hero'), people: '2,384 位同好', learning: ['看懂机芯结构', '认识擒纵机构', '辨别表盘细节'] },
  { id: 'wine', name: '红酒', english: 'Fine Wine', category: 'time', categoryLabel: '岁月风味', tagline: '风土、年份与一杯时光', intro: '从产区、葡萄与酿造说起，慢慢读懂杯中的风味。', image: demo('wine'), people: '3,106 位同好', learning: ['认识产区', '理解年份', '品鉴基础香气'] },
  { id: 'walnut', name: '文玩核桃', english: 'Collectible Walnuts', category: 'time', categoryLabel: '岁月风味', tagline: '一对核桃，也有岁月的回响', intro: '从桩型、纹路、配对与包浆，看见手中器物的细微变化。', image: demo('walnut'), people: '1,628 位同好', learning: ['识别桩型与纹路', '观察配对', '认识自然包浆'] },
  { id: 'woodwork', name: '木工', english: 'Woodcraft', category: 'craft', categoryLabel: '匠心手作', tagline: '从一根木头，做出生活的温度', intro: '认识木材与榫卯，让手艺从书本走到工作台。', image: demo('woodwork'), people: '1,902 位同好', learning: ['认识木材纹理', '榫卯入门', '基础保养'] },
  { id: 'sake', name: '清酒', english: 'Sake Culture', category: 'time', categoryLabel: '岁月风味', tagline: '循着品牌与酒藏，认识清酒的多种面貌', intro: '从地域、酒藏与代表系列入门，再读酒标和器物背后的文化；仅面向达到当地法定饮酒年龄的成年人。', image: demo('sake-editorial-v1'), people: '本机演示兴趣圈', learning: ['认识酒藏与代表系列', '读懂特定名称与精米步合', '记录酒标与酒器的设计'] },
  { id: 'cigar', name: '雪茄', english: 'Cigar Culture', category: 'time', categoryLabel: '岁月风味', tagline: '从一片叶、一只木模、一张纸读懂手艺', intro: '面向符合所在地法定烟草年龄的成年人，从烟叶工艺、历史工具与纸本收藏入门；不提供吸食或购买引导。', image: demo('cigar'), people: '本机演示兴趣圈', learning: ['认识三层结构', '看田间与工艺', '读历史纸本'] },
  { id: 'car', name: '经典汽车', english: 'Classic Cars', category: 'precision', categoryLabel: '精密机械', tagline: '让旧时代的机械继续前行', intro: '从车身设计到机械修复，感受工业时代的审美与匠心。', image: demo('classic-car'), people: '1,148 位同好', learning: ['辨识车身设计', '认识机械结构', '维护基础'] },
];

export const CATEGORIES = [
  { id: 'all', name: '已开馆', count: '七座已开馆' },
  { id: 'time', name: '岁月风味', count: '红酒 · 清酒 · 核桃 · 雪茄' },
  { id: 'precision', name: '精密机械', count: '机械表 · 经典汽车' },
  { id: 'craft', name: '匠心手作', count: '木工与榫卯' },
] as const;

export const COLLECTIBLES: Collectible[] = [
  { id: 'watch-01', hobbyId: 'watch', name: '手动上链机械表', subtitle: '开放式机芯 · 入门藏品', tier: '普品', price: 680, change: 0.4, image: demo('watch-hero'), description: '从发条到擒纵，把时间一格一格交还给机械。此为应用流程示例，不对应真实交易物件。', details: [['门类', '机械表'], ['结构', '手动上链'], ['关注点', '机芯状态 · 表壳保存'], ['图像', 'AI 示意图']], spots: [{ x: 64, y: 45, title: '摆轮', body: '摆轮往复振荡，和擒纵机构一道控制齿轮释放的节奏。' }, { x: 78, y: 64, title: '齿轮系', body: '齿轮系将发条储存的能量一步步传递到指针。' }] },
  { id: 'wine-01', hobbyId: 'wine', name: '波尔多左岸红酒', subtitle: '产区入门 · 酒标阅读', tier: '精品', price: 420, change: -0.2, image: demo('wine'), description: '从产区与年份入手，学习如何阅读一瓶酒背后的风土故事。', details: [['门类', '红酒'], ['主题', '波尔多左岸'], ['关注点', '产区 · 年份 · 保存'], ['图像', 'AI 示意图']], spots: [{ x: 48, y: 45, title: '瓶身信息', body: '正式藏品将使用可核验的实拍酒标，示意图不作为知识依据。' }] },
  { id: 'walnut-01', hobbyId: 'walnut', name: '狮子头文玩核桃', subtitle: '纹路与配对 · 待鉴示例', tier: '精品', price: 360, change: 0.6, image: demo('walnut'), description: '从两半核桃的对称、纹路和底部观察配对之美。', details: [['门类', '文玩核桃'], ['主题', '狮子头'], ['关注点', '配对 · 纹路 · 包浆'], ['图像', 'AI 示意图']], spots: [{ x: 35, y: 50, title: '纹路', body: '真实物件的纹路须以原始照片判读；此处只演示知识卡布局。' }, { x: 66, y: 54, title: '配对', body: '看两枚核桃的形制、尺寸和纹路节奏是否相称。' }] },
  { id: 'woodwork-01', hobbyId: 'woodwork', name: '手作榫卯小椅', subtitle: '木作入门 · 工艺观察', tier: '普品', price: 290, change: 0.1, image: demo('woodwork'), description: '一张小椅背后的结构与手艺，适合从榫卯开始认识木工。', details: [['门类', '木工'], ['结构', '榫卯连接'], ['关注点', '木材 · 接合 · 修整'], ['图像', 'AI 示意图']], spots: [{ x: 58, y: 47, title: '榫卯连接', body: '让木件依靠自身结构相互咬合，是传统木作的重要语言。' }] },
  { id: 'car-01', hobbyId: 'car', name: '绿色经典旅行车', subtitle: '机械时代 · 造型收藏', tier: '精品', price: 920, change: 0.3, image: demo('classic-car'), description: '由流线车身开始，探索经典汽车的设计语言与修复知识。', details: [['门类', '经典汽车'], ['主题', '车身与机械'], ['关注点', '造型 · 维护 · 来源'], ['图像', 'AI 示意图']], spots: [{ x: 36, y: 60, title: '前格栅', body: '格栅是车身设计的重要视觉线索；正式内容须以真实车辆照片为准。' }] },
];

export const DEMO_POSTS = [
  { id: 'post-1', author: '清风徐来', initials: '清', hobbyId: 'woodwork' as HobbyId, time: '2 小时前', title: '周末完成了第一把小椅子', text: '尺寸还有一点不齐，但坐上去的那一刻，特别有成就感。想请教大家，下一步该怎么处理边角？', image: demo('woodwork'), likes: 28, comments: 6 },
  { id: 'post-wood-2', author: '木纹笔记', initials: '木', hobbyId: 'woodwork' as HobbyId, time: '昨天', title: '一处榫接，先看结构还是先看纹理？', text: '整理了几张作品档案的拍摄清单：整体、接合处、端面与修补痕迹。真实作品的木种和年代仍需来源记录，不能凭一张图下结论。', image: demo('woodwork'), likes: 12, comments: 3 },
  { id: 'post-sake-1', author: '纸与酒标', initials: '纸', hobbyId: 'sake' as HobbyId, time: '昨天', title: '酒标上的“纯米吟酿”该怎么读？', text: '我在比较原料、精米步合和酒藏信息。大家会先记录哪一栏？这里只讨论标签与酿造文化，不分享购买渠道。', image: demo('sake-editorial-v1'), likes: 15, comments: 4 },
  { id: 'post-2', author: '表情漫游', initials: '表', hobbyId: 'watch' as HobbyId, time: '4 小时前', title: '第一次认真看机芯', text: '原来时间真的可以被“看见”。今天在爱好馆读懂了摆轮，也想听听大家初入门时最惊喜的发现。', image: demo('watch-hero'), likes: 41, comments: 12 },
  { id: 'post-3', author: '核桃老友', initials: '核', hobbyId: 'walnut' as HobbyId, time: '6 小时前', title: '这一对，纹路是不是很有趣？', text: '手感越来越温润了。欢迎大家来掌掌眼，也说说自己喜欢的纹路。', image: demo('walnut'), likes: 35, comments: 9 },
];

export const hobbyById = (id: string) => HOBBIES.find((h) => h.id === id);
export const itemById = (id: string) => COLLECTIBLES.find((item) => item.id === id);
export const ya = (n: number) => new Intl.NumberFormat('zh-CN').format(n);
export function dailyRecommendation(interests: HobbyId[], today: Date): Hobby {
  // 成人限制门类不做首页主动推荐；未来须有地区和年龄规则才能开放正式展示。
  const eligible = HOBBIES.filter((h) => !['wine', 'sake', 'cigar'].includes(h.id));
  const unseen = eligible.filter((h) => !interests.includes(h.id));
  const choices = unseen.length ? unseen : eligible;
  const dayKey = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000);
  return choices[dayKey % choices.length];
}
