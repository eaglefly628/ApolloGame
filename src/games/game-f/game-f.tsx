import { AURORA, ONYX, PHOENIX_URI } from '../../ui/themes/sanguo/theme.js';
import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '../../renderer/index.js';
import { PointerInputSource, KeyboardInputSource, QueuedInputSource } from '../../net/index.js';
import type { InputSource } from '../../net/commands.js';
import { AssetManager, ImageAssetLoader } from '@assets/index.js';
import { getComponentById } from '@engine/core/query.js';
import type { World } from '@engine/core/world.js';
import { buildGameFBlueprint, gameFEnemyPreview, GAME_F_ASSETS } from './index.js';

// Game F 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 壳层 UI = design_handoff_game_f 的「锦霞 Aurora」皮肤（用户钦定女性向风格）：
//   · ThemeTokens = CSS 变量（README §Design Tokens 锦霞列，逐值照抄）；换肤=换 token（玄铁备份在 ONYX）。
//   · 页标签：对局 | 商城（商城=README §4 五分页 hifi 复刻，占位数据，交互态按 §交互态规范）。
//   · 对局内 HUD/文字/提示走引擎数据实体（blueprint 已染锦霞 palette + 三字体槽），壳层只包 chrome——
//     纯表现层，不碰 world/hash（manifesto + handoff 约束）。
// 字体：Google Fonts（README §Typography）；canvas 内文字按 fontFamily 数据取已加载字体。
const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;
const CAM_ZOOM = 1.8; // 与 blueprint camera.zoom 一致（静态相机）


const SHELL_CSS = `
.gfx-root{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;overflow:auto;
  color:var(--ink);font:14px/1.6 var(--font-body);background:var(--texture),var(--app-bg);}
.gfx-top{width:${VIEWPORT_W}px;display:flex;align-items:center;gap:14px;padding:12px 4px 8px;}
.gfx-title{font:30px var(--font-display);color:var(--accent);letter-spacing:2px;text-shadow:0 1px 0 #fff8;}
.gfx-tabs{display:flex;gap:6px;margin-left:8px;}
.gfx-tab{padding:7px 22px;border-radius:999px;border:1px solid var(--btn-edge);background:var(--btn-bg);
  color:var(--btn-text);font:15px var(--font-heading);letter-spacing:3px;cursor:pointer;
  transition:.16s cubic-bezier(.2,.7,.3,1);}
.gfx-tab:hover{transform:translateY(-2px);filter:brightness(1.06);}
.gfx-tab:active{transform:translateY(1px) scale(.97);filter:brightness(.93);}
.gfx-tab.on{background:var(--accent-grad);color:var(--accent-ink);border-color:transparent;
  box-shadow:0 4px 14px var(--accent-soft);}
.gfx-cur{margin-left:auto;display:flex;gap:8px;}
.gfx-chip{display:flex;align-items:center;gap:6px;background:var(--chip-bg);border:1px solid var(--panel-border);
  border-radius:999px;padding:4px 12px;font:13px var(--font-num);color:var(--ink);}
.gfx-chip b{color:var(--gold);}
.gfx-skin{font:12px var(--font-body);color:var(--ink-dim);background:none;border:1px dashed var(--panel-border);
  border-radius:999px;padding:4px 12px;cursor:pointer;}
/* —— 分段控件（设计稿顶栏：皮肤 玄铁/锦霞）—— */
.gfx-seg{display:flex;align-items:center;gap:7px;}
.gfx-seg>.lbl{font:10px var(--font-body);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-dim);}
.gfx-segbox{display:flex;background:var(--seg-track);border:1px solid var(--seg-edge);border-radius:11px;padding:3px;}
.gfx-segbtn{padding:7px 15px;border:none;background:transparent;color:var(--ink-dim);font:13px var(--font-heading);
  font-weight:700;letter-spacing:1px;white-space:nowrap;border-radius:8px;cursor:pointer;
  transition:.15s ease;}
.gfx-segbtn:not(.on):hover{color:var(--ink);}
.gfx-segbtn.on{background:var(--accent-grad);color:var(--accent-ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.3);}
.gfx-view{width:${VIEWPORT_W}px;}
.gfx-board-panel{position:relative;border:1px solid var(--panel-border);border-radius:var(--radius-lg);
  background:var(--panel-grad);box-shadow:0 0 0 1.5px var(--hairline) inset,0 14px 34px rgba(120,70,60,.16);
  overflow:hidden;}
.gfx-board-panel canvas{display:block;}
/* —— 单人对局 DOM 设计 chrome（顶/左/右覆盖层；接真实世界数值；中间棋盘+下方备战席露出可玩）—— */
.gfx-hud{position:absolute;inset:0;pointer-events:none;z-index:6;font-family:var(--font-body);color:var(--ink);}
.gfx-hud .pe{pointer-events:auto;}
.gfx-hud .syn{display:flex;align-items:center;gap:10px;padding:8px 11px;border-radius:var(--radius);}
.gfx-hud .syn .ic{width:30px;height:30px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-cjk);font-weight:900;font-size:15px;}
.gfx-hud [data-rune],.gfx-hud [data-buy]{transition:.16s cubic-bezier(.2,.7,.3,1);}
.gfx-hud [data-rune]:hover,.gfx-hud [data-buy]:hover{transform:translateY(-6px);filter:brightness(1.07);}
.gfx-hud button{transition:.15s ease;}
.gfx-hud button:hover{filter:brightness(1.08);}
.gfx-hud button:active{transform:translateY(1px) scale(.97);}
/* —— 商城 —— */
.mall{padding-bottom:30px;}
.mall-tabs{display:flex;gap:6px;margin:4px 0 14px;}
.mall-panel{position:relative;border:1px solid var(--panel-border);border-radius:var(--radius-lg);
  background:var(--panel-grad);box-shadow:0 0 0 1.5px var(--hairline) inset;padding:18px;}
.corners::before,.corners::after,.corners>i::before,.corners>i::after{content:'';position:absolute;width:46px;height:46px;
  background:${'${PHX}'} center/contain no-repeat;pointer-events:none;opacity:.9;}
.corners::before{left:6px;top:6px;}
.corners::after{right:6px;top:6px;transform:scaleX(-1);}
.corners>i::before{left:6px;bottom:6px;transform:scaleY(-1);}
.corners>i::after{right:6px;bottom:6px;transform:scale(-1);}
.mall-banner{display:flex;gap:22px;align-items:stretch;}
.mall-art{flex:1.2;min-height:218px;border-radius:var(--radius);background:
  linear-gradient(160deg,#e887a0 0%,#cf9a3f 55%,#8aa0e6 100%);opacity:.85;display:flex;align-items:flex-end;
  padding:14px;color:#fff;font:26px var(--font-display);text-shadow:0 2px 6px #0006;}
.mall-info{flex:1;display:flex;flex-direction:column;gap:10px;}
.seal{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;color:var(--accent);
  font:22px var(--font-display);background:var(--panel-grad);border:2px solid var(--seal-edge);
  box-shadow:inset 0 0 0 1.5px var(--seal-edge);clip-path:polygon(22% 0,78% 0,100% 22%,100% 78%,78% 100%,22% 100%,0 78%,0 22%);}
.pity{height:14px;border-radius:999px;background:var(--track);overflow:hidden;}
.pity>div{height:100%;width:62%;background:var(--accent-grad);border-radius:999px;}
.btnrow{display:flex;gap:10px;margin-top:auto;}
.gbtn{position:relative;padding:10px 26px;border-radius:var(--btn-radius);border:1px solid var(--btn-edge);
  background:var(--btn-bg);color:var(--btn-text);font:15px var(--font-heading);letter-spacing:2px;cursor:pointer;
  transition:.16s cubic-bezier(.2,.7,.3,1);}
.gbtn.primary{background:var(--accent-grad);color:var(--accent-ink);border-color:transparent;
  box-shadow:0 6px 16px var(--accent-soft);}
.gbtn:hover{transform:translateY(-2px);filter:brightness(1.07);}
.gbtn:active{transform:translateY(1px) scale(.96);filter:brightness(.93);}
.gbtn .tag{position:absolute;top:-9px;right:-8px;background:var(--danger);color:#fff;font:10px var(--font-body);
  border-radius:999px;padding:2px 8px;}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.card{position:relative;border:1px solid var(--panel-border);border-radius:var(--radius);background:var(--panel-grad);
  box-shadow:0 0 0 1.5px var(--hairline) inset;padding:12px;display:flex;flex-direction:column;gap:8px;
  transition:.16s cubic-bezier(.2,.7,.3,1);}
.card:hover{transform:translateY(-3px);box-shadow:0 10px 22px rgba(120,70,60,.18),0 0 0 1.5px var(--hairline) inset;}
.card .art{height:120px;border-radius:10px;opacity:.85;}
.card .nm{font:17px var(--font-heading);color:var(--ink);}
.card .pr{font:14px var(--font-num);color:var(--gold);}
.card .tag{position:absolute;top:8px;right:8px;background:var(--accent);color:#fff;font:10px var(--font-body);
  border-radius:999px;padding:2px 8px;}
.strike{color:var(--ink-dim);text-decoration:line-through;font-size:11px;margin-right:6px;}
.pass-track{display:flex;gap:8px;margin-top:14px;}
.pass-seg{flex:1;border-radius:10px;border:1px solid var(--panel-border);background:var(--chip-bg);padding:8px 6px;
  text-align:center;font:11px var(--font-body);color:var(--ink-dim);}
.pass-seg.cur{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft);color:var(--ink);}
.pass-seg .lv{font:13px var(--font-num);color:var(--accent);}
.pass-seg .free{color:var(--success);}
.pass-seg .elite{color:var(--xp);}
.grid6{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.mall h3{margin:18px 0 10px;font:20px var(--font-display);color:var(--accent);}
.mall .sub{color:var(--ink-dim);font-size:12px;}
@media (prefers-reduced-motion: reduce){.gfx-root *{transition:none!important;animation:none!important;}}
`.replace('${PHX}', PHOENIX_URI);

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Zhi+Mang+Xing&family=Noto+Serif+SC:wght@500;700&family=Noto+Sans+SC:wght@400;700&family=Cormorant+Garamond:wght@600&family=Rajdhani:wght@600&family=Silkscreen&display=swap';

function el(tag: string, cls: string, html?: string): HTMLElement {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

// —— 商城（README §4 五分页，占位数据 hifi 复刻；购买=敬请期待 toast）——
function buildMall(): HTMLElement {
  const root = el('div', 'mall gfx-view');
  const tabs = ['抽卡', '皮肤', '通行证', '钻石', '礼包'];
  const bar = el('div', 'mall-tabs');
  const body = el('div', '');
  const pages: Record<string, () => HTMLElement> = {
    抽卡: () => {
      const p = el('div', 'mall-panel corners');
      p.appendChild(el('i', ''));
      p.appendChild(el('div', 'mall-banner', `
        <div class="mall-art">赤壁 · 火凤临世</div>
        <div class="mall-info">
          <div style="display:flex;gap:10px;align-items:center"><span class="seal">凤</span>
            <div><div style="font:22px var(--font-display);color:var(--ink)">限定卡池 · 周瑜</div>
            <div class="sub">UP！火烧赤壁皮肤 & 三星直升符 ｜ 剩余 2 天 14 时</div></div></div>
          <div class="sub">保底进度 62 / 100</div><div class="pity"><div></div></div>
          <div class="btnrow"><button class="gbtn">单抽 ×1 <span style="color:var(--gold)">💎160</span></button>
          <button class="gbtn primary">十连 ×10 <span>💎1600</span><span class="tag">送1次</span></button></div>
        </div>`));
      const side = el('div', 'grid3', `
        <div class="card"><div class="art" style="background:linear-gradient(150deg,#d8504e,#e887a0)"></div><div class="nm">蜀魂常驻池</div><div class="pr">💎160 / 抽</div></div>
        <div class="card"><div class="art" style="background:linear-gradient(150deg,#3fae6e,#8fd0b0)"></div><div class="nm">吴风常驻池</div><div class="pr">💎160 / 抽</div></div>
        <div class="card"><div class="art" style="background:linear-gradient(150deg,#3a86d4,#9db8e8)"></div><div class="nm">魏武常驻池</div><div class="pr">💎160 / 抽</div></div>`);
      const w = el('div', '');
      w.appendChild(p);
      w.appendChild(el('h3', '', '常驻卡池'));
      w.appendChild(side);
      return w;
    },
    皮肤: () => el('div', 'grid3', `
      <div class="card"><span class="tag">限时</span><div class="art" style="background:linear-gradient(150deg,#d8504e,#f2b8a0)"></div><div class="nm">关羽 · 青龙凯</div><div class="pr">💎880</div></div>
      <div class="card"><div class="art" style="background:linear-gradient(150deg,#3fae6e,#c8e8c0)"></div><div class="nm">周瑜 · 锦帆夜宴</div><div class="pr"><span class="strike">💎1280</span>💎960</div></div>
      <div class="card"><span class="tag" style="background:var(--gold)">新品</span><div class="art" style="background:linear-gradient(150deg,#8aa0e6,#d8c4f0)"></div><div class="nm">诸葛 · 八阵星图</div><div class="pr">💎1080</div></div>`),
    通行证: () => {
      const w = el('div', 'mall-panel');
      w.appendChild(el('div', 'mall-banner', `
        <div class="mall-info" style="flex:1.4"><div style="font:24px var(--font-display);color:var(--ink)">桃园令 · 第 3 赛季</div>
          <div class="sub">等级 4 ｜ 剩余 23 天</div>
          <div class="btnrow"><button class="gbtn primary">解锁精英 💎980</button><button class="gbtn">领取全部</button></div></div>
        <div class="mall-art" style="flex:1;min-height:130px">桃园结义</div>`));
      const seg = Array.from({ length: 8 }, (_, i) =>
        `<div class="pass-seg${i === 3 ? ' cur' : ''}"><div class="lv">Lv.${i + 1}</div><div class="free">🪙${(i + 1) * 100}</div><div class="elite">💎${(i + 1) * 20}</div></div>`).join('');
      w.appendChild(el('div', 'pass-track', seg));
      return w;
    },
    钻石: () => el('div', 'grid6', [60, 300, 980, 1980, 3280, 6480].map((n, i) =>
      `<div class="card">${i === 0 ? '<span class="tag">首充2倍</span>' : i === 2 ? '<span class="tag" style="background:var(--gold)">热卖</span>' : ''}
       <div class="art" style="background:linear-gradient(150deg,#e887a0,#cf9a3f);display:flex;align-items:center;justify-content:center;font-size:34px">💎</div>
       <div class="nm">💎${n}${i > 0 ? ` <span class="sub">+送${Math.round(n * 0.1)}</span>` : ''}</div><div class="pr">¥${[6, 30, 98, 198, 328, 648][i]}</div></div>`).join('')),
    礼包: () => el('div', 'grid3', `
      <div class="card"><span class="tag">限购1次</span><div class="art" style="background:linear-gradient(150deg,#d8504e,#cf9a3f)"></div><div class="nm">开局豪礼</div><div class="sub">💎300 + 🪙2000 + 随机二星符</div><div class="pr"><span class="strike">¥30</span>¥6</div></div>
      <div class="card"><span class="tag" style="background:var(--gold)">热卖</span><div class="art" style="background:linear-gradient(150deg,#3fae6e,#cf9a3f)"></div><div class="nm">连胜战礼</div><div class="sub">💎980 + 连胜旗装饰</div><div class="pr">¥68</div></div>
      <div class="card"><div class="art" style="background:linear-gradient(150deg,#8aa0e6,#e887a0)"></div><div class="nm">谋士周卡</div><div class="sub">每日💎60 ×7 天</div><div class="pr">¥18</div></div>`),
  };
  let cur = '抽卡';
  const render = (): void => {
    bar.innerHTML = '';
    tabs.forEach((t) => {
      const b = el('button', `gfx-tab${t === cur ? ' on' : ''}`, t) as HTMLButtonElement;
      b.onclick = () => { cur = t; render(); };
      bar.appendChild(b);
    });
    body.innerHTML = '';
    body.appendChild(pages[cur]());
  };
  render();
  root.appendChild(bar);
  root.appendChild(body);
  return root;
}

// —— 单人对局 DOM 设计 chrome（README 对战.dc.html solo 布局 + Apollo UI Kit 控件；接真实世界状态）——
// 顶 HUD（STAGE/相位/倒计时/主公血/连胜）+ 左羁绊栏 + 右状态·装备栏 + 武将台发光框。
// 三边覆盖盖掉 canvas 旧 HUD；中间棋盘 + 下方备战席/商店露出，仍走 canvas 数据实体交互（不破坏可玩）。
function buildSoloHud(click: (x: number, y: number) => void, play: (i: number) => void): { root: HTMLElement; update: (w: World) => void } {
  const FAC: Record<string, string> = { 蜀: '#d8504e', 吴: '#3fae6e', 魏: '#3a86d4', 群: '#9b6dd8' };
  // 玩家阵营英雄码（纯蜀；codesFor 按 TEAM_A 序）：1关羽 2赵云 3诸葛亮 4张飞 → [名,字,职业,DCSS像素图]。
  const HEROES: Record<number, [string, string, string, string]> = {
    1: ['关羽', '关', '武将', 'death_knight'], 2: ['赵云', '赵', '武将', 'deep_elf_knight_new'],
    3: ['诸葛亮', '诸', '谋士', 'deep_elf_mage'], 4: ['张飞', '张', '武将', 'orc_knight_new'],
    5: ['马超', '马', '武将', 'centaur_warrior'], 6: ['黄忠', '黄', '射手', 'deep_elf_master_archer'],
  };
  const SHU = '#d8504e';
  // 备战期在板 marker 名牌（用户：布局时看不到武将名字）——DOM 标签层读世界 marker 位置投影，避开 prefab 子实体
  // 干扰合成/卖出链；marker id → 将名（纯蜀 4 将）。
  const HERO_NAMES: Record<string, string> = { a_guanyu: '关羽', a_zhaoyun: '赵云', a_zhuge: '诸葛亮', a_zhouyu: '张飞', a_machao: '马超', a_huangzhong: '黄忠' };
  // 开局三选一 = 现成 rune_a/b/c（世界坐标 + 信号），DOM 卡接它们。
  const RUNES: [string, string, string, string, number, number][] = [
    ['a', '🌾', '屯粮 · 积谷', '即时 +5 金', -110, -100],
    ['b', '📖', '砺兵 · 练武', '+8 经验 · 助升级', 0, -100],
    ['c', '🏯', '广纳 · 扩营', '备战席容量 +2', 110, -100],
  ];
  const runeCards = RUNES.map(([k, g, n, d]) => `<div data-rune="${k}" style="position:relative;width:208px;padding:28px 20px 20px;border-radius:18px;cursor:pointer;background:var(--panel-grad);border:1px solid var(--accent);box-shadow:inset 0 0 0 1px var(--hairline),0 18px 42px rgba(0,0,0,.5)">
    <div style="width:64px;height:64px;margin:0 auto 14px;border-radius:16px;background:var(--accent-soft);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:32px">${g}</div>
    <div style="font-family:var(--font-display);font-size:22px;color:var(--ink);margin-bottom:6px">${n}</div>
    <div style="font-size:12px;color:var(--ink-dim);line-height:1.5;min-height:34px">${d}</div>
    <div style="margin-top:14px;padding:8px 0;border-radius:10px;background:var(--accent-grad);color:var(--accent-ink);font-family:var(--font-heading);font-weight:700;font-size:13px;letter-spacing:2px">选 择</div></div>`).join('');
  // 羁绊（接真实 group-count；纯蜀 vs 魏世界观）：蜀魂(count_shu) + 武将(count_warrior) + 谋士(count_tactician)。
  const synData = [
    { name: '蜀 · 桃园', fac: '蜀', tiers: [2, 4, 6], glyph: '蜀', res: 'count_shu' },
    { name: '武将 · 猛将', fac: '', tiers: [2, 4, 6], glyph: '武', res: 'count_warrior' },
    { name: '谋士 · 智囊', fac: '', tiers: [2, 4], glyph: '谋', res: 'count_tactician' },
  ];
  const synRowHtml = (s: { name: string; fac: string; tiers: number[]; glyph: string }, have: number): string => {
    const col = s.fac ? FAC[s.fac] : 'var(--accent)';
    const active = have >= s.tiers[0];
    const reached = s.tiers.filter((t) => have >= t).length;
    const ticks = s.tiers.map((_, i) => `<div style="flex:1;height:4px;border-radius:99px;background:${i < reached ? col : 'var(--track)'}"></div>`).join('');
    return `<div class="syn" style="border:1px solid ${active ? col : 'var(--panel-border)'};background:${active ? 'var(--chip-bg)' : 'transparent'};opacity:${active ? 1 : 0.5};box-shadow:${active ? 'inset 0 0 0 1px var(--hairline)' : 'none'}">
      <div class="ic" style="background:${active ? col : 'var(--track)'};color:${active ? '#fff' : 'var(--ink-dim)'}">${s.glyph}</div>
      <div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-family:var(--font-heading);font-weight:700;font-size:14px;color:var(--ink)">${s.name}</span>
        <span style="font-family:var(--font-num);font-size:11px;color:${active ? col : 'var(--ink-dim)'}">${have}/${s.tiers[s.tiers.length - 1]}</span></div>
      <div style="display:flex;gap:4px;margin-top:5px">${ticks}</div></div></div>`;
  };
  const synRows = synData.map((s) => synRowHtml(s, 0)).join('');
  // 右栏 buff（自设计：当前状态 + 增益；连胜激励接 win_streak）。
  const buffs = [
    { g: '🏵️', n: '桃园结义', d: '蜀阵容 +12% 攻击', ref: '' },
    { g: '🌾', n: '屯田积粮', d: '每回合 +3 金', ref: '' },
    { g: '🔥', n: '连胜激励', d: '连胜越高士气越旺', ref: 'buffStreak' },
  ].map((b) => `<div style="display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:9px;background:var(--chip-bg);border:1px solid var(--panel-border)">
    <span style="font-size:17px">${b.g}</span><div style="flex:1;min-width:0"><div style="font-family:var(--font-heading);font-weight:700;font-size:13px;color:var(--ink)">${b.n}</div><div ${b.ref ? `data-ref="${b.ref}"` : ''} style="font-size:10px;color:var(--ink-dim)">${b.d}</div></div></div>`).join('');
  // 装备栏（战利品）：开局空，战中敌死掉装备 → 主公拾取 → items 累加填充（update 读真实 items 资源）。
  const EQUIP_ICONS = ['🗡', '🛡', '👑', '📜', '🏹', '💍', '🔮', '⚔️'];

  const root = el('div', 'gfx-hud');
  root.innerHTML = `
    <!-- 在板 marker 名牌层 + 敌人预布阵幽灵层（备战期投影；pointer-events 透传）-->
    <div data-ref="namelayer" style="position:absolute;inset:0;pointer-events:none;z-index:1"></div>
    <div data-ref="ghostlayer" style="position:absolute;inset:0;pointer-events:none;z-index:1"></div>
    <!-- TOP HUD -->
    <div class="pe" style="position:absolute;top:0;left:0;right:0;height:58px;display:flex;align-items:center;gap:14px;padding:0 18px;background:var(--hud-bg);border-bottom:1px solid var(--panel-border)">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="display:flex;flex-direction:column;line-height:1"><span style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-dim)">STAGE</span><span data-ref="stage" style="font-family:var(--font-num);font-size:20px;color:var(--ink);margin-top:3px">1-1</span></div>
        <div data-ref="pips" style="display:flex;gap:5px;align-items:center"></div>
      </div>
      <!-- 居中的相位 + 开战倒计时（用户：倒计时画在顶栏且居中）-->
      <div style="position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:16px">
        <div data-ref="phase" style="padding:6px 18px;border-radius:99px;white-space:nowrap;font-family:var(--font-heading);font-weight:700;font-size:13px;letter-spacing:.06em;background:var(--accent-soft);color:var(--accent);border:1px solid var(--accent)">⚔ 备战 · 布阵</div>
        <div style="display:flex;flex-direction:column;align-items:center;line-height:1"><span style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-dim)">开战倒计时</span><span data-ref="timer" style="font-family:var(--font-num);font-size:22px;color:var(--accent);margin-top:3px">0:30</span></div>
      </div>
      <div style="flex:1"></div>
      <!-- 操作引导（用户：最上排状态栏告诉玩家此刻该干什么）-->
      <div style="display:flex;justify-content:flex-end"><div data-ref="guide" style="display:flex;align-items:center;gap:8px;max-width:400px;padding:7px 14px;border-radius:11px;background:var(--chip-bg);border:1px solid var(--panel-border);font-size:11.5px;line-height:1.4;color:var(--ink)"><span style="font-size:14px">🎯</span><span data-ref="guidetext">招募英雄 → 拖上棋盘布阵 → 点「开战」</span></div></div>
    </div>
    <!-- 玩家信息卡（左下角，合并全部主公状态+经济；UI Kit 控件 avatar-frame/bar/chip）-->
    <div style="position:absolute;left:10px;bottom:118px;width:194px;padding:13px;border-radius:var(--radius);background:var(--panel-grad);border:1px solid var(--panel-border);box-shadow:inset 0 0 0 1px var(--hairline),0 6px 16px rgba(0,0,0,.2);pointer-events:auto">
      <div style="display:flex;align-items:center;gap:11px">
        <div style="position:relative;width:50px;height:50px;flex:none;border-radius:50%;background:var(--accent-grad);padding:3px;box-shadow:0 0 14px var(--accent-soft)">
          <div style="width:100%;height:100%;border-radius:50%;background:var(--protag-bg);display:flex;align-items:center;justify-content:center;font-size:24px">🐢</div></div>
        <div style="flex:1;min-width:0"><div style="font-family:var(--font-heading);font-weight:700;font-size:15px;color:var(--ink)">主公 · 玄德</div><div style="font-size:10px;color:var(--ink-dim)">蜀 · 桃园结义</div></div>
        <div style="display:flex;align-items:center;padding:4px 9px;border-radius:9px;background:var(--accent-soft);border:1px solid var(--accent)"><span data-ref="streak" style="font-family:var(--font-heading);font-weight:700;font-size:11px;color:var(--accent)">0连胜</span></div>
      </div>
      <div style="margin-top:10px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:9px;letter-spacing:.1em;color:var(--ink-dim)">主公生命</span><span data-ref="hp" style="font-family:var(--font-num);font-size:10px;color:var(--hp)">100</span></div>
        <div style="height:10px;border-radius:99px;background:var(--track);overflow:hidden;border:1px solid var(--panel-border)"><div data-ref="hpfill" style="width:100%;height:100%;background:var(--hp);border-radius:99px"></div></div></div>
      <div style="margin-top:7px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:9px;letter-spacing:.1em;color:var(--ink-dim)">经验 · Lv<span data-ref="level">1</span></span><span data-ref="xp" style="font-family:var(--font-num);font-size:10px;color:var(--xp)">0/2</span></div>
        <div style="height:7px;border-radius:99px;background:var(--track);overflow:hidden;border:1px solid var(--panel-border)"><div data-ref="xpfill" style="width:0%;height:100%;background:var(--xp);border-radius:99px"></div></div></div>
      <div style="display:flex;gap:8px;margin-top:9px">
        <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:5px 9px;border-radius:9px;background:var(--gold-chip);border:1px solid var(--gold)"><span style="font-size:13px">🪙</span><span data-ref="gold" style="font-family:var(--font-num);font-size:14px;color:var(--gold)">0</span></div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:5px 9px;border-radius:9px;background:var(--chip-bg);border:1px solid var(--panel-border)"><span style="font-size:11px;color:var(--ink-dim)">空席</span><span data-ref="bench" style="font-family:var(--font-num);font-size:14px;color:var(--ink)">9</span></div>
      </div>
      <button data-act="xp" style="margin-top:9px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:8px;border-radius:10px;cursor:pointer;background:var(--btn-bg);border:1px solid var(--btn-edge);color:var(--btn-text);font-family:var(--font-cjk);font-weight:700;font-size:13px">📜 买经验 <span style="font-family:var(--font-num);font-size:11px;color:var(--gold)">4金</span></button>
    </div>
    <!-- 武将台发光框（围住棋盘区，pointer-events 透传不挡拖拽）-->
    <div style="position:absolute;left:350px;top:60px;width:580px;height:492px;border-radius:24px;border:1px solid var(--platform-edge);box-shadow:inset 0 0 0 1px var(--hairline),0 0 38px var(--accent-soft);background:var(--platform-glow);pointer-events:none"></div>
    <!-- LEFT · 羁绊（上）；玩家卡在左下（bottom 留够，避免与玩家卡重叠）-->
    <div style="position:absolute;left:10px;top:66px;width:186px;bottom:330px;display:flex;flex-direction:column;gap:6px;overflow:hidden;pointer-events:auto">
      <div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-dim);padding:2px 6px">羁绊 · Synergies</div>
      <div data-ref="synrows" style="display:flex;flex-direction:column;gap:6px">${synRows}</div></div>
    <!-- RIGHT · 状态/装备（自设计）-->
    <div style="position:absolute;right:10px;top:66px;width:186px;bottom:118px;display:flex;flex-direction:column;gap:10px;overflow:hidden;pointer-events:auto">
      <div style="background:var(--panel-grad);border:1px solid var(--panel-border);border-radius:var(--radius);box-shadow:inset 0 0 0 1px var(--hairline);padding:12px">
        <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-dim);margin-bottom:9px">当前状态 · Status</div>
        <div style="display:flex;flex-direction:column;gap:7px">${buffs}</div></div>
      <div style="background:var(--panel-grad);border:1px solid var(--panel-border);border-radius:var(--radius);box-shadow:inset 0 0 0 1px var(--hairline);padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px"><span style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-dim)">装备 · 战利品</span><span data-ref="equipcount" style="font-family:var(--font-num);font-size:11px;color:var(--gold)">0/8</span></div>
        <div data-ref="equipslots" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"></div></div></div>
    <!-- BOTTOM BAR · 经济 + 点将台 + 开战（覆盖 canvas 旧底部；按钮注入世界坐标点击）-->
    <div style="position:absolute;left:0;right:0;bottom:0;height:104px;display:flex;align-items:stretch;gap:14px;padding:14px 18px;background:var(--dock-bg);border-top:1px solid var(--panel-border);pointer-events:auto">
      <button data-act="shop-open" style="position:relative;overflow:hidden;flex:1;display:flex;align-items:center;justify-content:center;gap:12px;border-radius:16px;border:1px solid var(--accent);background:var(--accent-soft);color:var(--ink);cursor:pointer;box-shadow:inset 0 0 0 1px var(--hairline)">
        <span style="font-size:26px">🏯</span><div style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2"><span style="font-family:var(--font-heading);font-weight:700;font-size:21px;color:var(--accent);letter-spacing:.04em">点将台 · 招募</span><span style="font-size:11px;color:var(--ink-dim)">点击开启 · 招募英雄入备战席</span></div></button>
      <button data-act="ready" style="width:172px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:16px;border:none;background:var(--ready-bg);color:var(--ready-text);cursor:pointer;box-shadow:var(--ready-shadow)">
        <span style="font-family:var(--font-heading);font-weight:700;font-size:24px;letter-spacing:.12em">开 战</span><span style="font-size:10px;letter-spacing:.22em;opacity:.85;margin-top:2px">READY · SPACE</span></button>
    </div>
    <!-- 点将台招募弹窗 -->
    <div data-act="shop-backdrop" style="position:absolute;inset:0;z-index:40;display:none;align-items:flex-start;justify-content:center;padding-top:58px;background:transparent;pointer-events:auto">
      <div data-stop="1" style="position:relative;width:900px;background:var(--panel-grad);border:1px solid var(--accent);border-radius:22px;box-shadow:inset 0 0 0 1px var(--hairline),0 30px 70px rgba(0,0,0,.55);padding:30px 32px 26px">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div style="font-family:var(--font-display);font-size:38px;color:var(--ink);line-height:1">点将台</div>
          <div style="font-size:12px;color:var(--ink-dim)">招募英雄 · 每名 3 金 · 可刷新</div><div style="flex:1"></div>
          <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:12px;background:var(--gold-chip);border:1px solid var(--gold)"><span style="font-size:18px">🪙</span><span data-ref="gold" style="font-family:var(--font-num);font-size:20px;color:var(--gold)">0</span></div>
          <div data-act="shop-close" style="width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-dim);border:1px solid var(--panel-border);background:var(--chip-bg);font-size:16px">✕</div>
        </div>
        <div data-ref="shopcards" style="display:flex;gap:16px;min-height:160px"></div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:22px">
          <button data-act="reroll" style="display:flex;align-items:center;gap:8px;padding:11px 22px;border-radius:14px;border:none;cursor:pointer;background:var(--accent-grad);color:var(--accent-ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.3)"><span style="font-size:18px">🔄</span><span style="font-family:var(--font-heading);font-weight:700;font-size:15px">刷新</span><span style="font-family:var(--font-num);font-size:11px;color:var(--gold)">2金</span></button>
          <button data-act="lock" style="display:flex;align-items:center;gap:7px;padding:11px 18px;border-radius:14px;cursor:pointer;background:var(--btn-bg);border:1px solid var(--btn-edge);color:var(--btn-text);font-family:var(--font-heading);font-weight:700;font-size:14px">🔒 锁定商店</button>
          <div style="flex:1"></div>
          <button data-act="shop-close" style="padding:11px 30px;border-radius:14px;cursor:pointer;background:var(--btn-bg);border:1px solid var(--btn-edge);color:var(--ink);font-family:var(--font-heading);font-weight:700;font-size:15px">完成</button>
        </div>
      </div>
    </div>
    <!-- 开局三选一弹窗（接 rune_a/b/c；rune 实体在场时自动显示）-->
    <div data-ref="runemodal" style="position:absolute;inset:0;z-index:45;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.62);backdrop-filter:blur(5px);pointer-events:auto">
      <div style="text-align:center">
        <div style="font-family:var(--font-display);font-size:40px;color:var(--accent);letter-spacing:3px;margin-bottom:4px;text-shadow:0 2px 10px rgba(0,0,0,.5)">开局强化 · 三选一</div>
        <div style="font-size:13px;color:#fff;opacity:.72;margin-bottom:26px">择一而行 · 开战后生效</div>
        <div style="display:flex;gap:22px;justify-content:center">${runeCards}</div>
      </div>
    </div>`;

  // —— 交互接线：DOM 按钮 → 注入对应世界坐标的点击（clickable 按位置命中发信号）——
  const q = (s: string): HTMLElement => root.querySelector(s) as HTMLElement;
  const shopBackdrop = q('[data-act="shop-backdrop"]');
  const runeModal = q('[data-ref="runemodal"]');
  const shopCards = q('[data-ref="shopcards"]');
  const openShop = (b: boolean): void => { shopBackdrop.style.display = b ? 'flex' : 'none'; };
  q('[data-act="xp"]').addEventListener('click', () => click(300, 64));
  q('[data-act="ready"]').addEventListener('click', () => click(300, 180));
  q('[data-act="shop-open"]').addEventListener('click', () => openShop(true));
  root.querySelectorAll('[data-act="shop-close"]').forEach((b) => b.addEventListener('click', () => openShop(false)));
  shopBackdrop.addEventListener('click', (e) => { if (e.target === shopBackdrop) openShop(false); });
  q('[data-stop]').addEventListener('click', (e) => e.stopPropagation());
  q('[data-act="reroll"]').addEventListener('click', () => click(300, 150));
  q('[data-act="lock"]').addEventListener('click', () => click(300, 120));
  shopCards.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest('[data-buy]') as HTMLElement | null;
    if (c) play(Number(c.dataset.buy)); // 直接驱动 CardPile.play → 扣金占席、入备战台（不依赖位置点击）
  });
  RUNES.forEach(([k, , , , x, y]) => q(`[data-rune="${k}"]`).addEventListener('click', () => click(x, y)));

  const setAll = (k: string, t: string): void => root.querySelectorAll(`[data-ref="${k}"]`).forEach((e) => { (e as HTMLElement).textContent = t; });
  const setW = (k: string, pct: string): void => root.querySelectorAll(`[data-ref="${k}"]`).forEach((e) => { (e as HTMLElement).style.width = pct; });
  const elPips = q('[data-ref="pips"]'), elPhase = q('[data-ref="phase"]'), elGuide = q('[data-ref="guidetext"]'), elSyn = q('[data-ref="synrows"]'), elName = q('[data-ref="namelayer"]'), elEquip = q('[data-ref="equipslots"]'), elGhost = q('[data-ref="ghostlayer"]');
  let lastEquip = -1, lastGhost = '';
  let lastShopSig = ''; // 点将台卡面只在「在售/可负担」变化时重渲（每帧重建会杀掉 :hover 浮动效果）。
  let lastSynSig = '';

  const update = (w: World): void => {
    const num = (id: string): number | undefined => (getComponentById(w, 'Resource', 'id', id) as { current?: number } | undefined)?.current;
    const max = (id: string): number | undefined => (getComponentById(w, 'Resource', 'id', id) as { max?: number } | undefined)?.max;
    const flag = (id: string): boolean | undefined => (getComponentById(w, 'Flag', 'id', id) as { active?: boolean } | undefined)?.active;
    const stageI = num('stage_idx') ?? 1, roundI = num('round_idx') ?? 1;
    setAll('stage', `${stageI}-${roundI}`);
    if (elPips) elPips.innerHTML = Array.from({ length: 5 }, (_, i) => {
      const on = i + 1 === stageI;
      return `<div style="width:${on ? 10 : 7}px;height:${on ? 10 : 7}px;border-radius:50%;background:${i + 1 <= stageI ? 'var(--accent)' : 'var(--ink-dim)'};box-shadow:${on ? '0 0 8px var(--accent)' : 'none'}"></div>`;
    }).join('');
    const prep = flag('in_prep');
    if (elPhase) {
      elPhase.textContent = prep ? '⚔ 备战 · 布阵' : '⚔ 战斗阶段';
      elPhase.style.background = prep ? 'var(--accent-soft)' : 'rgba(214,86,104,.16)';
      elPhase.style.color = prep ? 'var(--accent)' : 'var(--danger)';
      elPhase.style.borderColor = prep ? 'var(--accent)' : 'var(--danger)';
    }
    const t = Math.max(0, Math.ceil(num('prep_left') ?? 0));
    setAll('timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    const hpV = num('player_hp'), hpM = max('player_hp') ?? 100;
    if (hpV !== undefined) { setAll('hp', String(Math.round(hpV))); setW('hpfill', `${Math.max(0, Math.min(100, (hpV / (hpM || 100)) * 100))}%`); }
    const streak = num('win_streak') ?? 0;
    setAll('streak', `${streak}连胜`);
    const gold = num('gold') ?? 0;
    setAll('gold', String(Math.round(gold)));
    const lvl = num('level'); if (lvl !== undefined) setAll('level', String(Math.round(lvl)));
    const xpV = num('xp'), xpM = max('xp') ?? 0;
    if (xpV !== undefined) { setAll('xp', `${Math.round(xpV)}/${xpM || '—'}`); if (xpM > 0) setW('xpfill', `${Math.max(0, Math.min(100, (xpV / xpM) * 100))}%`); }
    const benchSp = num('bench_space'); if (benchSp !== undefined) setAll('bench', String(Math.round(benchSp)));
    // 装备栏（A）：按真实 items 数填充（变化才重渲）。
    const itemN = Math.round(num('items') ?? 0);
    setAll('equipcount', `${itemN}/8`);
    if (elEquip && itemN !== lastEquip) {
      lastEquip = itemN;
      elEquip.innerHTML = Array.from({ length: 8 }, (_, i) => {
        const got = i < itemN;
        return `<div style="aspect-ratio:1;border-radius:8px;background:${got ? 'var(--gold-chip)' : 'transparent'};border:1px ${got ? 'solid var(--gold)' : 'dashed var(--panel-border)'};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:${got ? '0 0 8px var(--accent-soft)' : 'none'}">${got ? EQUIP_ICONS[i] : ''}</div>`;
      }).join('');
    }
    setAll('buffStreak', streak > 0 ? `连胜 ${streak} · 士气高涨` : '连胜越高士气越旺');
    // 羁绊真实计数（只在变化时重渲）+ 操作引导随相位。
    const counts = synData.map((s) => num(s.res) ?? 0);
    const synSig = counts.join(',');
    if (elSyn && synSig !== lastSynSig) { lastSynSig = synSig; elSyn.innerHTML = synData.map((s, i) => synRowHtml(s, counts[i])).join(''); }
    if (elGuide) elGuide.textContent = prep
      ? '招募英雄 → 拖上棋盘布阵（≤等级）→ 点「开战」'
      : '战斗进行中 · WASD 移动主公拾金 · 静待分出胜负';
    // 在板 marker 名牌（仅备战期投影；战斗期 marker 隐藏，由战斗单位头顶名字接管）。
    if (elName) {
      if (prep) {
        let html = '';
        for (const id of w.getAllEntities()) {
          if (!id.endsWith(':seat') || !/^bench\d*_a_/.test(id) || !w.getComponent(id, 'HexPos')) continue;
          const tr = w.getComponent(id, 'Transform') as { x: number; y: number } | undefined;
          const mm = id.match(/^bench\d*_(a_[a-z]+)#/);
          const nm = mm ? HERO_NAMES[mm[1]] : '';
          if (!tr || !nm) continue;
          const sx = tr.x * CAM_ZOOM + VIEWPORT_W / 2, sy = tr.y * CAM_ZOOM + VIEWPORT_H / 2 + 24;
          html += `<div style="position:absolute;left:${sx}px;top:${sy}px;transform:translateX(-50%);padding:1px 6px;border-radius:6px;background:rgba(0,0,0,.55);color:#fff;font:10px var(--font-body);white-space:nowrap">${nm}</div>`;
        }
        elName.innerHTML = html;
      } else if (elName.innerHTML) elName.innerHTML = '';
    }
    // 敌人预布阵幽灵（功能 B；仅备战期，英雄关半透明画出敌阵让玩家针对性布阵）。
    if (elGhost) {
      const sKey = prep ? `${stageI}-${roundI}` : '';
      if (sKey !== lastGhost) {
        lastGhost = sKey;
        if (!prep) elGhost.innerHTML = '';
        else {
          const foes = gameFEnemyPreview(stageI, roundI);
          elGhost.innerHTML = foes.map((f) => {
            const sx = f.x * CAM_ZOOM + VIEWPORT_W / 2, sy = f.y * CAM_ZOOM + VIEWPORT_H / 2;
            return `<div style="position:absolute;left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;opacity:.5">
              <div style="width:34px;height:34px;border-radius:9px;border:2px dashed #3a86d4;background:rgba(58,134,212,.25);display:flex;align-items:center;justify-content:center;font-family:var(--font-cjk);font-weight:900;font-size:15px;color:#cfe2f7">魏</div>
              <div style="font:9px var(--font-body);padding:0 4px;border-radius:5px;background:rgba(0,0,0,.45);color:#bcd6f0;white-space:nowrap">${f.name}</div></div>`;
          }).join('');
        }
      }
    }
    runeModal.style.display = w.hasComponent('rune_a', 'Clickable') ? 'flex' : 'none'; // 三选一在场即显
    if (shopBackdrop.style.display === 'flex') {
      const afford = gold >= 3;
      const codes = [num('shop_slot_1') ?? 0, num('shop_slot_2') ?? 0, num('shop_slot_3') ?? 0];
      const sig = `${codes.join(',')}|${afford}`;
      if (sig === lastShopSig) return; // 无变化不重渲 → 保住 hover
      lastShopSig = sig;
      shopCards.innerHTML = codes.map((code, i) => {
        const h = HEROES[code];
        if (!h) return `<div style="flex:1;min-height:160px;border-radius:14px;border:1px dashed var(--panel-border);background:var(--chip-bg);display:flex;align-items:center;justify-content:center;color:var(--ink-dim);font-size:13px">— 空 —</div>`;
        return `<div data-buy="${i}" style="position:relative;flex:1;display:flex;flex-direction:column;overflow:hidden;cursor:${afford ? 'pointer' : 'not-allowed'};border-radius:14px;border:1px solid ${SHU};background:var(--panel-grad);box-shadow:inset 0 0 0 1px var(--hairline),0 6px 16px rgba(0,0,0,.22);opacity:${afford ? 1 : 0.55};min-height:160px">
          <div style="height:28px;display:flex;align-items:center;justify-content:center;background:${SHU};color:#fff;font-weight:700;font-family:var(--font-num);font-size:13px">🪙 3</div>
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:14px">
            <div style="width:80px;height:80px;border-radius:13px;background:linear-gradient(160deg,${SHU}cc,${SHU}55);border:2px solid ${SHU};display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="assets/FreeArtLib/monster/${h[3]}.png" alt="${h[0]}" style="width:62px;height:62px;image-rendering:pixelated"></div>
            <div style="font-family:var(--font-cjk);font-weight:700;font-size:18px;color:var(--ink)">${h[0]}</div>
            <div style="display:flex;gap:6px"><span style="font-family:var(--font-cjk);font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px;background:var(--chip-bg);border:1px solid var(--panel-border);color:var(--ink-dim)">蜀</span><span style="font-family:var(--font-cjk);font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px;background:var(--chip-bg);border:1px solid var(--panel-border);color:var(--ink-dim)">${h[2]}</span></div>
          </div></div>`;
      }).join('');
    }
  };
  return { root, update };
}

export function mount(container: HTMLElement): () => void {
  // 字体（README §Typography；id 防重复注入）。
  if (!document.getElementById('gfx-fonts')) {
    const link = document.createElement('link');
    link.id = 'gfx-fonts';
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }
  const style = document.createElement('style');
  style.textContent = `.gfx-root.aurora{${AURORA}} .gfx-root.onyx{${ONYX}} ${SHELL_CSS}`;
  document.head.appendChild(style);

  const root = el('div', 'gfx-root aurora');
  // 顶栏：标题 + 页标签（对局/商城）+ 货币 + 皮肤切换（壳层换肤；对局内画布为锦霞数据染色）。
  const top = el('div', 'gfx-top');
  top.appendChild(el('div', 'gfx-title', '像素三分天下'));
  const tabBar = el('div', 'gfx-tabs');
  const tabGame = el('button', 'gfx-tab on', '对 局') as HTMLButtonElement;
  const tabMall = el('button', 'gfx-tab', '商 城') as HTMLButtonElement;
  tabBar.appendChild(tabGame);
  tabBar.appendChild(tabMall);
  top.appendChild(tabBar);
  const cur = el('div', 'gfx-cur', `<span class="gfx-chip">💎 <b>1280</b> ＋</span><span class="gfx-chip">🪙 <b>3600</b> ＋</span>`);
  // 皮肤分段控件（玄铁/锦霞；默认锦霞=aurora）。
  const skinSeg = el('div', 'gfx-seg');
  skinSeg.appendChild(el('span', 'lbl', '皮肤'));
  const skinBox = el('div', 'gfx-segbox');
  const segOnyx = el('button', 'gfx-segbtn', '玄铁') as HTMLButtonElement;
  const segBrocade = el('button', 'gfx-segbtn on', '锦霞') as HTMLButtonElement;
  skinBox.appendChild(segOnyx);
  skinBox.appendChild(segBrocade);
  skinSeg.appendChild(skinBox);
  cur.appendChild(skinSeg);
  top.appendChild(cur);
  root.appendChild(top);

  // 对局视图：锦霞面板 chrome 包画布 + 提示组件（kit notification 形）。
  const gameView = el('div', 'gfx-view');
  const boardPanel = el('div', 'gfx-board-panel');
  const stage = el('div', '');
  stage.style.cssText = `position:relative;width:${VIEWPORT_W}px;height:${VIEWPORT_H}px;overflow:hidden;background:var(--battlefield);background-size:cover`;
  boardPanel.appendChild(stage);
  // DOM 按钮 → 命令路由：位置点击触发 canvas clickable / CardPile play 直接买入（与键盘指针同 InputSource）。
  const queued = new QueuedInputSource('p1');
  const clickW = (x: number, y: number): void => queued.enqueue({ source: 'p1', x, y, phase: 'down' });
  const playShop = (i: number): void => queued.enqueue({ source: 'shop', key: 'play', values: [i] });
  // 对局 DOM 设计 chrome 覆盖层（顶/左/右/底 + 点将台/三选一弹窗；接真实世界状态 + 命令）。
  // 大重构方向（魏蜀吴 3 人一队、太阁立志传背景）：单人/双人之分取消——多人对局缺人由 AI 补位，菜单不再分模式。
  const hud = buildSoloHud(clickW, playShop);
  boardPanel.appendChild(hud.root);
  gameView.appendChild(boardPanel); // 操作引导已移入顶栏状态栏（data-ref guide），不再单列底注。

  // 商城视图（README §4）。
  const mallView = buildMall();
  mallView.style.display = 'none';

  root.appendChild(gameView);
  root.appendChild(mallView);
  container.appendChild(root);

  // 视图状态：页签（对局/商城）。
  let tab: 'game' | 'mall' = 'game';
  const applyView = (): void => {
    const showMall = tab === 'mall';
    gameView.style.display = showMall ? 'none' : '';
    mallView.style.display = showMall ? '' : 'none';
    tabGame.classList.toggle('on', tab === 'game');
    tabMall.classList.toggle('on', tab === 'mall');
  };
  tabGame.onclick = () => { tab = 'game'; applyView(); };
  tabMall.onclick = () => { tab = 'mall'; applyView(); };
  const applySkin = (onyx: boolean): void => {
    root.classList.toggle('onyx', onyx);
    root.classList.toggle('aurora', !onyx);
    segOnyx.classList.toggle('on', onyx);
    segBrocade.classList.toggle('on', !onyx);
  };
  segOnyx.onclick = () => applySkin(true);
  segBrocade.onclick = () => applySkin(false);
  applyView();

  // 美术资产（数据驱动，R9）：注册清单 → 异步加载；就绪前渲染器退化几何，就绪后自动画占位 token。
  const assets = new AssetManager(new ImageAssetLoader());
  assets.registerManifest(GAME_F_ASSETS);
  void assets.loadAll();

  // 输入源懒适配：Engine 的 input 是构造期只读，而 canvas 由 attachRenderer 挂载时才创建 → 占位转发。
  const keyboard = new KeyboardInputSource('p1', window);
  let pointer: PointerInputSource | null = null;
  const lazyInput: InputSource = { commandsForTick: (tick) => [...keyboard.commandsForTick(tick), ...(pointer ? pointer.commandsForTick(tick) : []), ...queued.commandsForTick(tick)] };
  const engine = new Engine({ tickRate: 60, input: lazyInput });
  engine.load(buildGameFBlueprint());
  // 透明画布：棋盘露出 stage 的设计平台背景（--platform-bg 随皮肤）。
  engine.attachRenderer(new CanvasRenderer({ width: VIEWPORT_W, height: VIEWPORT_H, background: 'transparent', assets }), stage);
  const canvas = stage.querySelector('canvas');
  if (canvas) {
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'pointer';
    canvas.style.position = 'relative'; // 抬到王冠台座之上（z1 > crown z0）
    canvas.style.zIndex = '1';
    pointer = new PointerInputSource('p1', canvas, {
      worldFromScreen: (sx, sy) => ({ x: (sx - VIEWPORT_W / 2) / CAM_ZOOM, y: (sy - VIEWPORT_H / 2) / CAM_ZOOM }),
    });
  }
  engine.start();

  // HUD 实时投影：每帧读世界资源刷新 DOM 数字/条（纯表现层，不进 hash）。
  let rafId = 0;
  const pump = (): void => {
    hud.update(engine.world);
    rafId = requestAnimationFrame(pump);
  };
  rafId = requestAnimationFrame(pump);

  return () => {
    cancelAnimationFrame(rafId);
    engine.stop();
    keyboard.dispose();
    pointer?.dispose();
    if (style.parentNode) style.parentNode.removeChild(style);
    if (root.parentNode === container) container.removeChild(root);
  };
}
