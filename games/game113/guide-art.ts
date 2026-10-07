import { parseAssetIndex } from '../../src/assets/asset-index.js';
import rawAssetIndex from './real-assets.json';

const assets = parseAssetIndex(rawAssetIndex);

export type GuideArt = {
  variant?: 'route';
  assetId: string;
  alt: string;
  photoTitle: string;
  photoNote: string;
  teaser: string;
  diagramTitle: string;
  diagramHint: string;
  steps: readonly { title: string; detail: string }[];
  detailAssetId?: string;
  detailTitle?: string;
};

const sakeArt: Record<string, GuideArt> = {
  time: {
    assetId: 'sake.sugidama.kiku',
    alt: '盛冈菊之司酒造门前悬挂的杉玉实拍',
    photoTitle: '酒藏门前，杉玉标记了一个时节',
    photoNote: '实拍：菊之司酒造门前杉玉。它是习俗的图像，不是一瓶酒的年款证明。',
    teaser: '先看见一颗杉玉，再分辨一则传说与一份史证。',
    diagramTitle: '从好奇走向证据',
    diagramHint: '图示是导览编辑绘制，不是历史原图。',
    steps: [
      { title: '观察', detail: '门前杉玉' },
      { title: '追问', detail: '酒藏与时节' },
      { title: '分辨', detail: '传说 ≠ 史证' },
    ],
    detailAssetId: 'sake.bottle.museum',
    detailTitle: '延伸实物：东京食与农业博物馆陈列酒瓶；原档案未注明年代。',
  },
  koji: {
    assetId: 'sake.koji.rice',
    alt: '米粒表面生长麹菌的实拍特写',
    photoTitle: '把米变成另一种可能',
    photoNote: '实拍：米麹；不是本馆某一款酒的生产现场。',
    teaser: '一粒米里的淀粉，先要被“打开”，才走得进发酵。',
    diagramTitle: '一条酿造线索',
    diagramHint: '流程简图省略了酒母、压榨等环节；详细工艺见资料卷。',
    steps: [
      { title: '蒸米', detail: '留下米的结构' },
      { title: '麹', detail: '酶促糖化' },
      { title: '酵母', detail: '酒精发酵' },
    ],
  },
  label: {
    assetId: 'sake.bottle.museum',
    alt: '东京食与农业博物馆陈列酒瓶的实拍',
    photoTitle: '先看一只真实的酒瓶，再学会记录标签',
    photoNote: '实拍：博物馆陈列酒瓶。原资料未提供足够清晰的背标；右侧是通用读标示意，不对应这只瓶子的具体参数。',
    teaser: '先抄下标签写了什么，再决定自己理解了什么。',
    diagramTitle: '读标四格',
    diagramHint: '读标流程是编辑示意；没有清晰原标，就不替这只瓶子补写精米数字。',
    steps: [
      { title: '原文', detail: '如实保存' },
      { title: '数字', detail: '核对含义' },
      { title: '酒藏', detail: '查实际地点' },
      { title: '版本', detail: '比对批次' },
    ],
  },
  place: {
    variant: 'route',
    assetId: 'sake.koji.rice',
    alt: '米麹实拍；不对应 Brooklyn Kura 的生产现场或酒款',
    photoTitle: '认得品牌，还要认得这瓶从哪里来',
    photoNote: '实拍：米麹。它只是原料工艺的观察图，不是 Brooklyn Kura 的产品或酒藏照片；具体瓶身待授权。',
    teaser: '同一品牌的两条产线，也应写成两份独立档案。',
    diagramTitle: '一瓶酒的地点档案',
    diagramHint: '依据 Brooklyn Kura 的产品资料设计的信息关系图，并非官方地图。',
    steps: [
      { title: '酿造', detail: '纽约 · Brooklyn Kura' },
      { title: '核对', detail: '米种与酒款' },
      { title: '建档', detail: '批次与保存' },
    ],
  },
  care: {
    assetId: 'sake.cup.rengetsu',
    alt: '檀香山艺术博物馆藏大田垣莲月和歌铭酒盏实拍',
    photoTitle: '收藏可以从一只酒盏开始',
    photoNote: '实拍：大田垣莲月和歌铭酒盏；它是酒器，不是新政 No.6 酒瓶。',
    teaser: '一瓶酒、一只杯、一张标签；值得留下的记录各不相同。',
    diagramTitle: '一份藏品档案',
    diagramHint: '这是一套记录方法，不是估价或鉴定结论。',
    steps: [
      { title: '来源', detail: '谁、何时、何处' },
      { title: '版本', detail: '年款与标签' },
      { title: '保存', detail: '温度与变化' },
    ],
  },
};

export function guideArtFor(hobbyId: string, sceneId: string): GuideArt | undefined {
  return hobbyId === 'sake' ? sakeArt[sceneId] : undefined;
}

export function guidePhoto(assetId: string): { src: string; author: string; license: string; sourceUrl: string } | undefined {
  const entry = assets.assets.find((asset) => asset.id === assetId && asset.status === 'filled');
  if (!entry?.path || !entry.provenance) return undefined;
  const author = entry.provenance.author;
  const sourceUrl = entry.provenance.sourceUrl;
  if (typeof author !== 'string' || typeof sourceUrl !== 'string') return undefined;
  return { src: `/games/game113/real/${entry.path}`, author, license: entry.license ?? '许可待核', sourceUrl };
}
