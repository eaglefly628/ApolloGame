// ═══════════════════════════════════════════════════════════════
//  Game C ·《缝纫物语》(Stitch & Style) —— 主题内容数据 (纯 DATA)
//
//  这是「内容」层：消除元素、材料、缝纫店升级阶梯、换装外观、爱诗(AIGP)展示
//  提示词，全部是**可被任意弱 LLM 照填的数据**，不含任何游戏逻辑代码。
//  逻辑（三消棋盘 / 解锁判定 / 数值结算）由引擎 capability 承担：
//    - 解锁判定 = 现成 Condition→Event→Effect（见 blueprint.ts，纯数据装配）。
//    - 三消棋盘 = 引擎尚缺，已提需求 REQ-C-001（见 docs/workflow/requests.md）。
//  PC 只编辑数据，不写系统。
// ═══════════════════════════════════════════════════════════════

// ── 消除元素 / 缝纫材料 ──────────────────────────────────────────
// 棋盘上 6 种可消除的元素，主题=女孩子换装的「针线缝纫」原料。
// 消除一组 → 产出对应材料资源（Resource，按 id 全局路由）。
export interface Material {
  readonly id: string; // 资源 id（消除产出落到这个 Resource）
  readonly name: string; // 中文名
  readonly glyph: string; // 棋子显示字形（占位美术；真资产走 asset-flow TBF）
  readonly tint: number; // 棋子底色（0xRRGGBB）
  readonly blurb: string; // 一句话风味
}

export const MATERIALS: readonly Material[] = [
  { id: 'cloth', name: '布料', glyph: '🧶', tint: 0x6ea8fe, blurb: '一切衣裙的底子' },
  { id: 'thread', name: '丝线', glyph: '🧵', tint: 0xff9ec7, blurb: '把心意一针针缝进去' },
  { id: 'button', name: '纽扣', glyph: '🔘', tint: 0xffd56b, blurb: '收尾的小确幸' },
  { id: 'ribbon', name: '缎带', glyph: '🎀', tint: 0xff7aa2, blurb: '系一个甜甜的结' },
  { id: 'lace', name: '蕾丝', glyph: '🌸', tint: 0xd9b8ff, blurb: '裙摆上的细腻浪花' },
  { id: 'sequin', name: '亮片', glyph: '✨', tint: 0x7ef0d0, blurb: '灯下闪烁的高光' },
];

// 通用货币：消除任意元素都给一点「针线币」，用于（未来）主动缝制消费。
export const COIN_ID = 'coin';
export const COIN_NAME = '针线币';

// 每消除一颗元素的产出（数据，供未来 REQ-C-001 棋盘 capability 读取）。
export const AWARD_PER_TILE = 1; // 该种材料 +1
export const COIN_PER_TILE = 5; // 针线币 +5

// ── 缝纫店升级阶梯 / 换装外观 ────────────────────────────────────
// 「数据玩法」：攒够材料 → 解锁更高级的衣服（=升级服装店）。
// 每件衣服是一个里程碑：requires 满足 → 解锁 flag 置位 + 当前外观推进到 lookId。
// 解锁判定全部由现成 event-when + effect-apply 装配（blueprint.ts），零游戏代码。
export interface Garment {
  readonly id: string; // 衣服 id
  readonly name: string; // 中文名
  readonly tier: number; // 阶梯层级（1 起，越高越华丽）
  readonly lookId: string; // 解锁后女孩的「当前外观」状态值
  readonly icon: string; // 展示用字形（占位）
  readonly requires: ReadonlyArray<{ readonly material: string; readonly amount: number }>;
  readonly aishePrompt: string; // 爱诗(AIGP)视频生成提示词片段：穿上这件后女孩身上的样子
}

// 一条由朴素到华丽的换装线（数据；阈值递增 → 越晚解锁）。
export const GARMENTS: readonly Garment[] = [
  {
    id: 'apron',
    name: '初心围裙',
    tier: 1,
    lookId: 'look_apron',
    icon: '👚',
    requires: [{ material: 'cloth', amount: 10 }, { material: 'thread', amount: 6 }],
    aishePrompt: 'a cheerful girl in a simple linen apron dress, soft morning light, cozy tailor atelier',
  },
  {
    id: 'blouse',
    name: '碎花衬衫',
    tier: 2,
    lookId: 'look_blouse',
    icon: '👕',
    requires: [{ material: 'cloth', amount: 24 }, { material: 'button', amount: 12 }],
    aishePrompt: 'a girl in a floral buttoned blouse and pleated skirt, pastel palette, gentle breeze',
  },
  {
    id: 'sundress',
    name: '缎带连衣裙',
    tier: 3,
    lookId: 'look_sundress',
    icon: '👗',
    requires: [{ material: 'cloth', amount: 40 }, { material: 'ribbon', amount: 18 }, { material: 'thread', amount: 20 }],
    aishePrompt: 'a girl twirling in a ribbon-tied summer sundress, satin bow at the waist, warm sunset',
  },
  {
    id: 'lace_gown',
    name: '蕾丝礼裙',
    tier: 4,
    lookId: 'look_lace_gown',
    icon: '👰',
    requires: [{ material: 'lace', amount: 30 }, { material: 'cloth', amount: 60 }, { material: 'thread', amount: 36 }],
    aishePrompt: 'a girl in an elegant white lace gown with layered hem, delicate embroidery, candlelit ballroom',
  },
  {
    id: 'gala_gown',
    name: '星夜晚礼服',
    tier: 5,
    lookId: 'look_gala_gown',
    icon: '💃',
    requires: [
      { material: 'sequin', amount: 50 },
      { material: 'lace', amount: 40 },
      { material: 'ribbon', amount: 30 },
      { material: 'button', amount: 24 },
    ],
    aishePrompt: 'a girl in a shimmering sequin evening gown under a starry sky, glamorous runway, cinematic bokeh',
  },
];

// 基础外观（未解锁任何衣服时）。
export const BASE_LOOK = 'look_base';
export const BASE_LOOK_PROMPT = 'a girl in plain practice clothes standing in a small tailor shop, neutral pose';
export const LOOK_FSM = 'look';

// 解锁 flag 命名（blueprint 装配 + UI 读取共用，单一真相）。
export const garmentFlagId = (g: Garment | string): string =>
  `unlocked_${typeof g === 'string' ? g : g.id}`;
export const garmentSignal = (g: Garment | string): string =>
  `sig_${typeof g === 'string' ? g : g.id}`;

// ── 爱诗 (AIGP) 展示提示词组装表 ─────────────────────────────────
// 「输出点」：把女孩当前外观 → 一段视频生成提示词（爱诗视频）。
// 对应周期表「扩展 C: AIGP 旁路」(X4 ShadowDictionary / X5 SemanticMaterial)：
// 这张表就是 ShadowDictionary 的数据形态——世界状态(lookId) → prompt 片段。
// 真正的视频后端属表现层(不进确定性 sim)，已提需求 REQ-C-004。
export const LOOK_PROMPTS: Readonly<Record<string, string>> = {
  [BASE_LOOK]: BASE_LOOK_PROMPT,
  ...Object.fromEntries(GARMENTS.map((g) => [g.lookId, g.aishePrompt])),
};

// 镜头/风格的固定修饰（SemanticMaterial 的 basePrompt 侧，数据）。
export const AISHE_STYLE_SUFFIX =
  'anime aesthetic, 9:16 vertical short video, smooth camera dolly-in, gentle particle sparkles';
export const AISHE_NEGATIVE = 'lowres, extra fingers, watermark, text artifacts';

// 给定当前 lookId，拼出完整爱诗视频提示词（纯函数、仅字符串拼接 = 表现层数据装配，不是 sim 逻辑）。
export function composeAishePrompt(lookId: string): string {
  const base = LOOK_PROMPTS[lookId] ?? BASE_LOOK_PROMPT;
  return `${base}, ${AISHE_STYLE_SUFFIX}`;
}
