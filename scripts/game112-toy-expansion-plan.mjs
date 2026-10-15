// Game112 扩充到 1000 件的本机创作计划：只写提示词与数据，不调用图像 API、不改现有商店。
// 4 件原有可互动物件 + T001–T996 = 1000 件；T101–T996 按春夏秋冬轮转，每季 224 件。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const localRoot = resolve(root, 'art-local/game112/cat-toys');
const shop = JSON.parse(await readFile(resolve(root, 'games/game112/shop-catalog.v1.json'), 'utf8'));
const existing = new Map(shop.items.map((item) => [item.id, item]));

const seasons = [
  { id: 'spring', name: '春芽', palette: 'pale bamboo, sage, warm cream, soft coral', motif: 'new leaves and dew', categories: ['ball', 'wand', 'kicker', 'plush', 'track', 'hide', 'rest', 'puzzle'] },
  { id: 'summer', name: '夏荫', palette: 'muted teal, sun-faded linen, sandy cream, restrained coral', motif: 'breeze and shade', categories: ['kicker', 'ball', 'wand', 'track', 'hide', 'scratch', 'rest', 'puzzle'] },
  { id: 'autumn', name: '秋橡', palette: 'russet, ochre, old oak, moss sage, cream', motif: 'fallen leaves and seed pods', categories: ['track', 'wand', 'ball', 'kicker', 'plush', 'hide', 'scratch', 'puzzle'] },
  { id: 'winter', name: '冬夜', palette: 'midnight blue, cream, muted gold, warm walnut', motif: 'stars, quiet snow and lantern light', categories: ['rest', 'plush', 'kicker', 'ball', 'hide', 'scratch', 'wand', 'puzzle'] },
];

const forms = {
  ball: { kind: 'toy', price: 18, names: ['铃球', '滚星球', '短尾球', '双层球', '藤环球', '窝纹球', '谷粒球'],
    materials: [['竹编', 'bamboo weave and enclosed wood rattle'], ['藤编', 'rattan weave and enclosed cork core'], ['软木', 'solid cork and inset linen patches'], ['橡胶', 'natural rubber with inset cotton texture']] },
  wand: { kind: 'toy', price: 20, names: ['短杆', '弯枝杆', '布蝶杆', '叶影杆', '小星杆', '鱼尾杆', '双结杆'],
    materials: [['柳木', 'smooth willow wood and tightly stitched felt'], ['白桦', 'pale birch and short cotton canvas tip'], ['竹节', 'rounded bamboo and enclosed linen lure'], ['橡木', 'old oak and short securely tied fabric lure']] },
  kicker: { kind: 'toy', price: 26, names: ['抱踢鱼', '弯月枕', '布叶枕', '短尾鲸', '云朵枕', '豆荚枕', '小舟枕'],
    materials: [['棉麻', 'cotton-linen with short reinforced stitching'], ['帆布', 'soft canvas and enclosed rattan insert'], ['灯芯绒', 'fine corduroy and cotton fill'], ['厚毡', 'dense felt and linen fill']] },
  plush: { kind: 'toy', price: 23, names: ['布鼠', '小蛾', '绒叶', '布雀', '短尾狐', '布蘑菇', '圆耳兔'],
    materials: [['亚麻', 'linen and reinforced cotton stitching'], ['棉布', 'brushed cotton and enclosed fill'], ['软毡', 'dense felt and enclosed fill'], ['灯芯绒', 'fine corduroy and enclosed fill']] },
  track: { kind: 'toy', price: 40, names: ['滚木环', '双弯轨', '小桥轨', '月牙轨', '波纹轨', '圆窗轨', '短坡轨'],
    materials: [['橡木', 'rounded old-oak rails and enclosed wooden ball'], ['竹片', 'smooth bamboo rails and enclosed cork ball'], ['软木', 'cork rails and enclosed felt ball'], ['纸板', 'reinforced cardboard rails and enclosed wood ball']] },
  hide: { kind: 'decor', price: 44, names: ['月洞', '短隧道', '折角屋', '圆窗箱', '叶檐洞', '双口窝', '低拱门'],
    materials: [['瓦楞纸', 'thick corrugated cardboard with neatly finished edges'], ['藤编', 'rounded rattan weave with linen lining'], ['竹片', 'smooth bamboo ribs and cotton canvas canopy'], ['软木', 'cork frame and reinforced felt lining']] },
  rest: { kind: 'decor', price: 58, names: ['星窝', '浅睡垫', '低沿篮', '窗边床', '圆月窝', '云边垫', '小台窝'],
    materials: [['软毡', 'dense felt outer rim and brushed cotton cushion'], ['棉麻', 'cotton-linen cover and enclosed padded fill'], ['藤编', 'rounded rattan frame and linen cushion'], ['帆布', 'soft canvas shell and reinforced cotton piping']] },
  scratch: { kind: 'decor', price: 48, names: ['矮抓柱', '弯抓板', '月牙板', '圆角坡', '小桥板', '低踏台', '双面板'],
    materials: [['剑麻', 'tightly fixed sisal surface on rounded wood'], ['瓦楞纸', 'dense corrugated cardboard in a smooth wood frame'], ['软木', 'textured cork surface on rounded oak'], ['麻布', 'securely wrapped hemp canvas on smooth bamboo']] },
  puzzle: { kind: 'toy', price: 35, names: ['藏粮盒', '拨片盘', '转叶盘', '嗅闻卷', '滑窗盒', '星孔盒', '双槽盘'],
    materials: [['橡木', 'rounded oak with enclosed sliding parts'], ['竹片', 'smooth bamboo with enclosed sliding parts'], ['软木', 'cork with sewn linen scent pockets'], ['瓦楞纸', 'reinforced cardboard with folded scent compartments']] },
};

const promptFor = (item, season, material) => [
  'Use case: stylized-concept. Asset type: one reusable Game112 Star Tail House cat-scale inventory cutout.',
  `Subject: ONE ${item.shape} named ${item.name}; ${material[1]}.`,
  `Seasonal visual language: ${season.motif}; palette ${season.palette}. Material surfaces remain unmistakable and specific.`,
  'Cozy handmade storybook gouache and colored-pencil texture, gently imperfect assembly and stitching, warm neutral soft light, cohesive with existing Game112 cat toy collection.',
  'Three-quarter product view; entire assembled object centered with readable silhouette and safe margin. All small parts are securely enclosed or attached; no hazardous loose string.',
  'Genuinely transparent PNG alpha. No floor, background, vignette, halo, scene, cat, person, words, logo, watermark, packaging, duplicate or detached parts.',
].join(' ');

const items = [];
for (let slot = 0; slot < 224; slot++) {
  const familyIndex = Math.floor(slot / 28);
  const variant = slot % 28;
  const shapeIndex = Math.floor(variant / 4);
  const materialIndex = variant % 4;
  for (let seasonIndex = 0; seasonIndex < 4; seasonIndex++) {
    const season = seasons[seasonIndex];
    const id = `T${String(101 + slot * 4 + seasonIndex).padStart(3, '0')}`;
    const category = season.categories[familyIndex];
    const form = forms[category];
    const material = form.materials[materialIndex];
    const approved = existing.get(id);
    const item = approved ?? {
      id, name: `${season.name}${material[0]}${form.names[shapeIndex]}`,
      price: form.price + materialIndex * 3 + shapeIndex,
      kind: form.kind, category, season: season.id,
      materials: material[1].split(' and '),
      blurb: `${season.name}手作：${material[0]}${form.names[shapeIndex]}。先收进篮子。`,
    };
    items.push({ ...item, shape: form.names[shapeIndex], status: approved ? 'generated' : 'planned',
      prompt: promptFor(item, season, material) });
  }
}

if (items.length !== 896 || new Set(items.map((item) => item.id)).size !== 896 ||
    new Set(items.map((item) => item.name)).size !== 896 || items.at(-1).id !== 'T996') {
  throw new Error('Game112 expansion IDs or names are not unique');
}
await mkdir(localRoot, { recursive: true });
await writeFile(resolve(localRoot, 'expansion-plan.v2.json'), `${JSON.stringify({ version: 2,
  targetShopCount: 1000, existingCoreItems: 4, existingFirstCollectionItems: 100,
  seasons: seasons.map(({ id, name, palette }) => ({ id, name, palette })), items }, null, 2)}\n`);
await writeFile(resolve(localRoot, 'prompts-T105-T996.jsonl'), items.filter((item) => item.status === 'planned')
  .map((item) => JSON.stringify({ prompt: item.prompt, use_case: 'stylized-concept', model: 'gpt-image-2.5-flare',
    size: '1024x1024', quality: 'medium', background: 'transparent', output_format: 'png',
    out: `game112-cat-toy-${item.id.slice(1)}.png` })).join('\n') + '\n');
console.log(`Planned ${items.length} seasonal items: ${items.filter((item) => item.status === 'generated').length} generated, ${items.filter((item) => item.status === 'planned').length} pending image generation.`);
