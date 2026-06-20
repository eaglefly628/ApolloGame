// 程序化英雄立绘（古风拟人 · 纯 SVG · 零外部资源 · 确定性）。
// 按 时代/文明(region) + 花色(色) + 军衔(rank·冠羽) 自动拼盔甲半身像；缺数据也优雅出像。
// 非写实绘制（无图像生成工具），是风格化矢量剪影立绘——配 doc23 §一「缺立绘则剪影占位」升级版。

export type Suit = '♠' | '♥' | '♦' | '♣';
type Region = 'cn' | 'classical' | 'steppe' | 'euro' | 'mideast' | 'jp';

const SUIT_HEX: Record<Suit, string> = { '♠': '#6b8fc4', '♥': '#e0635f', '♦': '#e6a24a', '♣': '#56be84' };

// 从 era/civ 文案推断地域风格（关键字匹配·缺则古典）。
function regionOf(era: string): Region {
  const s = era || '';
  if (/日本/.test(s)) return 'jp';
  if (/蒙古|匈|中亚|突厥|祖鲁/.test(s)) return 'steppe';
  if (/阿拉伯|波斯|奥斯曼|阿尤布|莫卧儿|迦太基/.test(s)) return 'mideast';
  if (/齐|吴|秦|汉|楚|蜀|魏|唐|宋|明|周|越/.test(s)) return 'cn';
  if (/罗马|马其顿|希腊|拜占庭|底比斯|斯巴达|伊庇鲁斯|高卢/.test(s)) return 'classical';
  if (/法国|英国|英格兰|普鲁士|俄国|法兰克|瑞典|波希米亚|美国/.test(s)) return 'euro';
  return 'classical';
}

// 各地域：头盔 + 背后兵器（stylized·currentColor 用 accent 染）。坐标系 viewBox 0 0 120 150，头中心约 (60,52)。
function helmet(r: Region, accent: string, plume: string): string {
  switch (r) {
    case 'cn': // 兜鍪 + 红缨
      return `<path d="M40 50a20 20 0 0 1 40 0l-2 6H42z" fill="${accent}"/><rect x="56" y="20" width="8" height="16" rx="3" fill="${plume}"/><circle cx="60" cy="20" r="5" fill="${plume}"/><path d="M38 48h44v5H38z" fill="${accent}" opacity=".8"/>`;
    case 'classical': // 罗马盔 + 横向冠饰
      return `<path d="M42 52a18 18 0 0 1 36 0v3H42z" fill="${accent}"/><path d="M40 30q20 -12 40 0l-2 8q-18 -8 -36 0z" fill="${plume}"/><rect x="42" y="54" width="36" height="4" fill="${accent}" opacity=".7"/>`;
    case 'steppe': // 毛皮尖帽
      return `<path d="M44 52q-2 -30 16 -36q18 6 16 36z" fill="${accent}"/><path d="M44 50h32l-2 6H46z" fill="#3a2c1e"/><circle cx="60" cy="16" r="4" fill="${plume}"/>`;
    case 'euro': // 骑士大盔 + 顶羽
      return `<path d="M42 44h36v14a18 18 0 0 1-36 0z" fill="${accent}"/><rect x="44" y="48" width="32" height="3" fill="#0c0f14"/><rect x="58" y="56" width="4" height="8" fill="#0c0f14"/><path d="M60 24l5 16h-10z" fill="${plume}"/>`;
    case 'mideast': // 头巾 + 尖盔顶 + 护鼻
      return `<path d="M40 52q0 -22 20 -24q20 2 20 24z" fill="${accent}"/><path d="M58 26l4-12 4 12z" fill="${plume}"/><rect x="58" y="50" width="4" height="12" rx="2" fill="${accent}"/><path d="M40 50h40l-3 6H43z" fill="#d9c79a" opacity=".85"/>`;
    case 'jp': // 兜 + 前立月牙
      return `<path d="M42 52a18 18 0 0 1 36 0l-3 5H45z" fill="${accent}"/><path d="M48 36q12-8 24 0" stroke="${plume}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M36 50q8 4 8 10M84 50q-8 4-8 10" stroke="${accent}" stroke-width="3" fill="none"/>`;
  }
}

function weapon(r: Region, accent: string): string {
  // 背后斜插兵器（剪影·暗色描边 + accent）
  const shaft = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2a2018" stroke-width="3" stroke-linecap="round"/>`;
  switch (r) {
    case 'cn': return shaft(92, 18, 70, 96) + `<path d="M92 18l6-8-1 10z" fill="${accent}"/>`; // 矛
    case 'steppe': return `<path d="M86 22q14 22 0 44" stroke="#2a2018" stroke-width="3" fill="none"/><line x1="86" y1="22" x2="86" y2="66" stroke="${accent}" stroke-width="1.5"/>`; // 弓
    case 'mideast': return `<path d="M92 24q12 30 -16 70" stroke="#2a2018" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M92 24l7-3-3 8z" fill="${accent}"/>`; // 弯刀
    case 'jp': return `<path d="M88 20 q-2 36-18 76" stroke="#2a2018" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M88 20l6-6-3 10z" fill="${accent}"/><rect x="64" y="70" width="12" height="3" rx="1.5" fill="${accent}" opacity=".85" transform="rotate(-15,70,71)"/>`; // 太刀
    default: return shaft(90, 22, 72, 92) + `<rect x="85" y="16" width="10" height="3" rx="1" fill="${accent}"/><path d="M89 18v6" stroke="${accent}" stroke-width="2"/>`; // 直剑
  }
}

/** 生成一张英雄立绘 SVG（自包含·可直接塞进 innerHTML）。size 由 CSS/外层控制（width/height 100%）。 */
export function heroPortrait(suit: Suit, era: string, rank: string, rar = 'white'): string {
  const accent = SUIT_HEX[suit] ?? '#9ca3af';
  const region = regionOf(era);
  const isRoyal = rank === 'A' || rank === 'K';
  const plume = isRoyal ? '#e8cd82' : rar === 'orange' ? '#e8cd82' : accent;
  const SUIT_LETTER: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
  const id = `hp${SUIT_LETTER[suit] ?? 'x'}${rank}${region}`;
  return `<svg viewBox="0 0 120 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="${id}bg" cx="50%" cy="34%" r="72%"><stop offset="0%" stop-color="${accent}" stop-opacity=".34"/><stop offset="62%" stop-color="${accent}" stop-opacity=".10"/><stop offset="100%" stop-color="#0c0f14" stop-opacity="0"/></radialGradient>
    </defs>
    <rect x="0" y="0" width="120" height="150" rx="10" fill="url(#${id}bg)"/>
    ${weapon(region, accent)}
    <path d="M30 150v-18q0-26 30-30q30 4 30 30v18z" fill="${accent}" opacity=".22"/>
    <path d="M40 150v-14q0-18 20-22q20 4 20 22v14z" fill="${accent}" opacity=".45"/>
    <ellipse cx="60" cy="58" rx="13" ry="15" fill="#caa985"/>
    <rect x="54" y="68" width="12" height="10" fill="#b8966f"/>
    ${helmet(region, accent, plume)}
    <ellipse cx="55" cy="58" rx="2" ry="2.4" fill="#2a2018" opacity=".85"/><ellipse cx="65" cy="58" rx="2" ry="2.4" fill="#2a2018" opacity=".85"/>
    ${isRoyal ? `<path d="M48 150v-2h24v2z" fill="${plume}" opacity=".6"/>` : ''}
  </svg>`;
}
