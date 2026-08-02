// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— UITheme 令牌（一份数据换皮·对齐 Designer bundle 调色板）
//
//  黄昏紫房间 + 琥珀磷光 + 奶油 UI + 珊瑚暖橙。三套像素字体经 font 槽接入：
//    DotGothic16(正文 fontUi/fontPixel) · VT323(数码管时钟 fontDisplay) · Silkscreen(全大写微标)。
//  红线不变：游戏只填令牌值（颜色/字体字符串），不写 CSS/DOM。
// ════════════════════════════════════════════════════════════════════════

import type { UITheme } from '@zerocraft/engine/ui/components/index.js';

export const ZANKYOU: UITheme = {
  bg0: '#0a0810', // 设备外框/最深
  bg1: '#15101f', // 设备内屏（黄昏紫）
  bg2: '#1c1726', // 卡片底
  bg3: '#241f2e',
  pageBg: '#0a0810',
  line: '#2a2036',
  text: '#e8dcc8', // 奶油
  sub: '#9a8da2',
  dim: '#5a4f66',
  jade: '#ff9b6b', // 主强调=珊瑚暖橙（UITheme jade 槽即"主 accent"）
  jadeWash: 'rgba(255,155,107,.16)',
  jadeLine: 'rgba(255,155,107,.42)',
  gold: '#ffb000', // 琥珀磷光（时钟）
  ok: '#7ec47a',
  okWash: 'rgba(126,196,122,.16)',
  warn: '#ffd27f',
  warnWash: 'rgba(255,210,127,.16)',
  danger: '#ff6b6b',
  fontUi: "'DotGothic16', ui-monospace, monospace",
  fontMono: "'VT323', ui-monospace, monospace",
  fontPixel: "'Silkscreen', 'DotGothic16', monospace",
  fontDisplay: "'VT323', ui-monospace, monospace",
  inputBg: 'rgba(0,0,0,0.4)',
};
