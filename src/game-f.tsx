import { Engine } from './runtime/engine.js';
import { CanvasRenderer } from './renderer/index.js';
import { PointerInputSource, KeyboardInputSource } from './net/index.js';
import type { InputSource } from './net/commands.js';
import { AssetManager, ImageAssetLoader } from '@assets/index.js';
import { buildGameFBlueprint, GAME_F_ASSETS } from './games/game-f/index.js';

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

// —— 锦霞（Aurora）tokens（README 表格锦霞列原值）——
const AURORA = `
  --app-bg: radial-gradient(120% 120% at 50% -10%, #fdf4ee 0%, #f3e2dc 60%, #ecd6cf 100%);
  --panel-grad: linear-gradient(180deg,#fffdfa,#fbeee4);
  --panel-border: #e3c896;
  --hairline: rgba(216,164,78,.4);
  --chip-bg: rgba(255,255,255,.55);
  --track: rgba(150,110,90,.18);
  --ink: #5a3f44; --ink-dim: #a98b8f;
  --accent: #d8607b;
  --accent-grad: linear-gradient(180deg,#e887a0,#cf5070);
  --accent-soft: rgba(216,96,123,.16);
  --accent-ink: #fff;
  --gold: #cf9a3f; --seal-edge: #d8a44e;
  --success: #54ad8e; --warning: #e0a94e; --danger: #d65668; --info: #8aa0e6;
  --hp:#54ad8e; --mp:#8aa0e6; --xp:#c98fc4;
  --radius: 14px; --btn-radius: 16px; --radius-lg: 20px;
  --btn-bg: linear-gradient(180deg,#fffaf4,#fbece1); --btn-edge: #ecd3b2; --btn-text: #6a4a4f;
  --texture: radial-gradient(circle, rgba(201,148,72,.16) 1px, transparent 1.7px) 0 0/26px 26px,
    radial-gradient(circle, rgba(216,96,123,.10) 1px, transparent 1.6px) 13px 13px/26px 26px,
    repeating-linear-gradient(45deg, rgba(201,148,72,.07) 0 1px, transparent 1px 26px),
    repeating-linear-gradient(-45deg, rgba(201,148,72,.07) 0 1px, transparent 1px 26px);
  --font-display: 'Ma Shan Zheng', 'Noto Serif SC', serif;
  --font-heading: 'Cormorant Garamond', 'Noto Serif SC', serif;
  --font-body: 'Noto Serif SC', serif;
  --font-num: 'Silkscreen', monospace;
`;
// —— 玄铁（Onyx）tokens（README 玄铁列；壳层皮肤切换备用）——
const ONYX = `
  --app-bg: radial-gradient(120% 120% at 50% -10%, #1a2230 0%, #0a0d12 55%, #06080b 100%);
  --panel-grad: linear-gradient(180deg,#1c2531,#121821);
  --panel-border: #33404f;
  --hairline: rgba(255,214,150,.12);
  --chip-bg: rgba(255,255,255,.05);
  --track: rgba(0,0,0,.5);
  --ink: #e7edf3; --ink-dim: #7e8c9b;
  --accent: #ff5d2e;
  --accent-grad: linear-gradient(180deg,#ff7a45,#ee4515);
  --accent-soft: rgba(255,93,46,.18);
  --accent-ink: #1c0d06;
  --gold: #ffcb3d; --seal-edge: #caa24e;
  --success: #46d17a; --warning: #ffb24a; --danger: #ff404f; --info: #37b6ff;
  --hp:#46d17a; --mp:#37b6ff; --xp:#c184ff;
  --radius: 4px; --btn-radius: 12px; --radius-lg: 8px;
  --btn-bg: linear-gradient(180deg,#283341,#1a222c); --btn-edge: #3d4b5b; --btn-text: #dfe7ef;
  --texture: repeating-linear-gradient(45deg, rgba(135,175,215,.055) 0 1px, transparent 1px 9px),
    repeating-linear-gradient(-45deg, rgba(135,175,215,.045) 0 1px, transparent 1px 9px),
    repeating-linear-gradient(45deg, rgba(255,93,46,.03) 0 2px, transparent 2px 42px);
  --font-display: 'Zhi Mang Xing', 'Noto Sans SC', serif;
  --font-heading: 'Rajdhani', 'Noto Sans SC', sans-serif;
  --font-body: 'Noto Sans SC', sans-serif;
  --font-num: 'Silkscreen', monospace;
`;

// 凤羽卷草转角纹饰（design_handoff 商城源内 phoenixSvg 原样）。
const PHOENIX =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#cf9a3f" stroke-width="1.7" stroke-linecap="round"><path d="M7 58 C7 30 19 9 52 7"/><path d="M12 46 C20 33 33 25 50 20"/><path d="M9 52 C18 38 33 28 54 15"/><path d="M30 14 q7 -6 16 -6 M40 21 q7 -4 15 -1"/><circle cx="54" cy="9" r="2.6" fill="#d8607b" stroke="none"/></g></svg>';
const PHOENIX_URI = `url("data:image/svg+xml,${encodeURIComponent(PHOENIX)}")`;

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
.gfx-view{width:${VIEWPORT_W}px;}
.gfx-board-panel{position:relative;border:1px solid var(--panel-border);border-radius:var(--radius-lg);
  background:var(--panel-grad);box-shadow:0 0 0 1.5px var(--hairline) inset,0 14px 34px rgba(120,70,60,.16);
  overflow:hidden;}
.gfx-board-panel canvas{display:block;}
.gfx-note{display:flex;gap:10px;align-items:flex-start;margin:10px 0 24px;padding:10px 14px;border-radius:var(--radius);
  background:var(--panel-grad);border:1px solid var(--panel-border);border-left:3px solid var(--info);
  color:var(--ink-dim);font:12.5px var(--font-body);}
.gfx-note .ico{width:22px;height:22px;border-radius:50%;background:var(--info);color:#fff;display:flex;
  align-items:center;justify-content:center;flex:none;font-size:12px;}
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
  const skinBtn = el('button', 'gfx-skin', '换肤：锦霞 ⇄ 玄铁') as HTMLButtonElement;
  cur.appendChild(skinBtn);
  top.appendChild(cur);
  root.appendChild(top);

  // 对局视图：锦霞面板 chrome 包画布 + 提示组件（kit notification 形）。
  const gameView = el('div', 'gfx-view');
  const boardPanel = el('div', 'gfx-board-panel');
  const stage = el('div', '');
  stage.style.cssText = `width:${VIEWPORT_W}px;height:${VIEWPORT_H}px;overflow:hidden`;
  boardPanel.appendChild(stage);
  gameView.appendChild(boardPanel);
  gameView.appendChild(el('div', 'gfx-note', `<span class="ico">i</span><span>买棋子点商店大卡 ➜ 备战席自动落座；拖上棋盘出兵（场上 ≤ 等级），拖到另一子=换位，拖进 🗑 卖出；3 同名自动升星（板上原地升）。点「开战」数 3-2-1 开打；WASD 移动主公拾取战利品。</span>`));

  // 商城视图（README §4）。
  const mallView = buildMall();
  mallView.style.display = 'none';

  root.appendChild(gameView);
  root.appendChild(mallView);
  container.appendChild(root);

  const switchTab = (mall: boolean): void => {
    gameView.style.display = mall ? 'none' : '';
    mallView.style.display = mall ? '' : 'none';
    tabGame.classList.toggle('on', !mall);
    tabMall.classList.toggle('on', mall);
  };
  tabGame.onclick = () => switchTab(false);
  tabMall.onclick = () => switchTab(true);
  skinBtn.onclick = () => {
    root.classList.toggle('aurora');
    root.classList.toggle('onyx');
  };

  // 美术资产（数据驱动，R9）：注册清单 → 异步加载；就绪前渲染器退化几何，就绪后自动画占位 token。
  const assets = new AssetManager(new ImageAssetLoader());
  assets.registerManifest(GAME_F_ASSETS);
  void assets.loadAll();

  // 输入源懒适配：Engine 的 input 是构造期只读，而 canvas 由 attachRenderer 挂载时才创建 → 占位转发。
  const keyboard = new KeyboardInputSource('p1', window);
  let pointer: PointerInputSource | null = null;
  const lazyInput: InputSource = { commandsForTick: (tick) => [...keyboard.commandsForTick(tick), ...(pointer ? pointer.commandsForTick(tick) : [])] };
  const engine = new Engine({ tickRate: 60, input: lazyInput });
  engine.load(buildGameFBlueprint());
  engine.attachRenderer(new CanvasRenderer({ width: VIEWPORT_W, height: VIEWPORT_H, background: '#f6e8e0', assets }), stage);
  const canvas = stage.querySelector('canvas');
  if (canvas) {
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'pointer';
    pointer = new PointerInputSource('p1', canvas, {
      worldFromScreen: (sx, sy) => ({ x: (sx - VIEWPORT_W / 2) / CAM_ZOOM, y: (sy - VIEWPORT_H / 2) / CAM_ZOOM }),
    });
  }
  engine.start();

  return () => {
    engine.stop();
    keyboard.dispose();
    pointer?.dispose();
    if (style.parentNode) style.parentNode.removeChild(style);
    if (root.parentNode === container) container.removeChild(root);
  };
}
