// 商品的摆放与陪伴规则：纯数据，EventWhen / Effect / CraftRecipe / LayoutNode 消费。
import type { SceneRect, RelationKey } from './world-data.js';

export const ITEM_REQUEST = 'items.request';
export const ITEM_ACTIVITY = 'items.activity';
export const ITEM_ROOM = 'items.room';
export const useKey = (id: string): string => `item.use.${id}`;
export const respondKey = (id: string): string => `item.respond.${id}`;
export const removeKey = (id: string): string => `decor.remove.${id}`;
export const usesId = (id: string): string => `item.uses.${id}`;
export const ITEM_CANCEL = 'item.cancel';

export interface ItemExperience {
  readonly id: string;
  readonly spot: SceneRect;
  readonly labelSpot: SceneRect;
  readonly place: string;
  readonly invite: string;
  readonly response: string;
  readonly waiting: string;
  readonly finished: string;
  readonly trace: string;
  readonly benefit: RelationKey;
}

export const ITEM_EXPERIENCES: readonly ItemExperience[] = [
  { id: 'feather', spot: { x: 539, y: 459, w: 86, h: 111 }, labelSpot: { x: 535, y: 577, w: 108, h: 30 },
    place: '主厅 · 猫身旁', invite: '拿起羽毛杆', response: '把羽毛轻轻放低',
    waiting: '羽毛轻轻晃着，给雪团一点观察的时间。', finished: '这一轮停在它够得到的地方。尾尖轻摆，你们玩了一小会儿。',
    trace: '陪它玩过的羽毛杆，仍放在爪边。', benefit: 'closeness' },
  { id: 'paperbag', spot: { x: 243, y: 460, w: 101, h: 109 }, labelSpot: { x: 241, y: 577, w: 108, h: 30 },
    place: '主厅 · 地板左侧', invite: '打开纸袋', response: '轻轻敲一敲袋口',
    waiting: '袋口已经撑开。轻敲一下，邀雪团熟悉这个新角落。', finished: '纸袋微微晃了晃。停下来，给它一点慢慢熟悉的时间。',
    trace: '你们已经一起熟悉过这只纸袋。', benefit: 'ease' },
  { id: 'cushion', spot: { x: 351, y: 516, w: 184, h: 56 }, labelSpot: { x: 378, y: 577, w: 122, h: 30 },
    place: '主厅 · 雪团的坐处', invite: '一起歇一会儿', response: '轻轻摸摸胸前的毛',
    waiting: '软垫就在雪团身下，你可以在旁边安静陪一会儿。', finished: '胸前的毛轻轻起伏。软垫留住了这一小会儿的温暖。',
    trace: '这里留着你们一起歇过的痕迹。', benefit: 'heartlight' },
  { id: 'cardback-moon', spot: { x: 756, y: 421, w: 72, h: 49 }, labelSpot: { x: 758, y: 477, w: 104, h: 30 },
    place: '主厅 · 星牌桌面', invite: '看看月相牌', response: '为雪团翻开一张',
    waiting: '新牌背已经铺在桌上。先一起翻一张月亮。', finished: '今晚翻到一弯新月。把它留在桌上，等下次一起看。',
    trace: '桌上留着一张共同翻开的月亮。', benefit: 'closeness' },
];
export const experienceOf = (id: string): ItemExperience | undefined => ITEM_EXPERIENCES.find((it) => it.id === id);
export const itemAssetKey = (id: string): string => `game112/prop/${id}`;
