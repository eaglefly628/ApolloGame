// Game D ·《骰途 · TOWER OF FATE》挂载 —— 复刻美术设计案（src/games/game-d/doc/「骰途 美术设计文案/视觉原型」）。
//
// ⚠️ 原型（owner 2026-06-29「先做出能玩的」）：战斗逻辑暂在游戏层（combat.ts 纯函数）·UI 全走 LayoutNode（UI 铁律）·
// 3D 房间当背景（流式 + 相机 dolly）。上线版迁数据驱动（M0+主程）。
//
// 复刻的四块画面 + 转场（设计案 §2–5）：
//   屏① 开场 Title（金色 hero「开始攀塔」+ 双人同攀/单人/设置 + 3D 命运骰子背景）
//   屏② 塔内场景 HUD（左·六色元素法阵环 / 右·队友 + Buff 面板 / 顶·层间 chip + 货币 / 底·命运骰盅入口）
//   屏③ 命运骰盅·选骰备战（骰库 Tab + 卡片 + 详情子页 + 出战骰组 + 骰型 + 本关需求·越省越好）
//   屏④ 通关 + 3D 战利品三选一
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@assets/index.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, UITheme } from '@ui/components/index.js';
import type { Camera3D } from '@engine/protocol/components.js';
import type { Component } from '@engine/core/types.js';
import { baseBlueprint, genRoom, roomMeta, ROOM_SPACING, ACTS } from './rooms.js';
import { GAME_D_ASSETS } from './assets.js';
import {
  ELEM_INFO, ELEMS, rollPool, makeDie, dieDef, startLibrary, DICE_CATALOG, sizeCn,
  type Die, type RolledDie, type DieDef, type Elem,
} from './dice.js';
import { makeFoe, counterDisabled, evalChallenge, damageOf, condLabel, type Foe } from './combat.js';
import { elementBadge, diceFaceArt, lootCardArt, skyArt, CARDED_DEFIDS } from './art.js';

const SOLO_HEARTS = 6;
const FLOORS = 4;
const REROLLS = 2;
const WINDOW = 1;
const LOADOUT_CAP = 5;
const rnd = (): number => Math.random();

// ── 骰途主题（复刻设计案：暗紫靛蓝 + 金 + 六色·UI 铁律：只填令牌·不写 CSS）─────────────
const GAME_D_THEME: UITheme = {
  bg0: '#120c22', bg1: 'rgba(30,22,52,0.92)', bg2: 'rgba(44,32,70,0.92)', bg3: 'rgba(60,46,92,0.9)',
  pageBg: 'radial-gradient(125% 95% at 50% 16%, #2a1f4d 0%, #160f2c 58%, #0a0716 100%)',
  line: 'rgba(180,160,235,0.16)',
  text: '#efeafb', sub: '#b8acd8', dim: '#807594',
  jade: '#c3a8ff', jadeWash: 'rgba(150,110,235,0.18)', jadeLine: 'rgba(175,135,245,0.5)',
  gold: '#f3c257', // 复刻设计案更饱的暖金（logo #f7c252 / hero 键 #ffd982→#f0a93a 一系）
  ok: '#7fd49a', okWash: 'rgba(110,205,140,0.16)',
  warn: '#f0b756', warnWash: 'rgba(240,183,86,0.16)', danger: '#ff7d7d',
  mine: '#f0d68a', foe: '#ff8a8a',
  fontUi: '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif', // 正文无衬线
  fontSerif: '"Noto Serif SC", Georgia, serif', // 标题/logo/骰名衬线（Label font:'serif'）
  fontMono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  inputBg: 'rgba(0,0,0,0.32)',
};

// ── 静态展示数据（队友 + Buff·复刻屏②右侧面板·单人原型作演出·co-op 后接 sim）──────────
const ALLY_BUFFS: { el: Elem; name: string; tail: string }[] = [
  { el: 'mu', name: '再生', tail: '2 回合' },
  { el: 'huo', name: '灼烧', tail: '×3' },
  { el: 'feng', name: '疾行', tail: '1 回合' },
];

interface S {
  phase: 'title' | 'arena' | 'dish' | 'reward' | 'gameover' | 'victory';
  library: Die[];           // 拥有的骰库
  loadout: string[];        // 出战骰组（die 实例 id·上限 5）
  detail: string | null;    // 命运骰盅详情子页聚焦的 defId
  dishTab: 'all' | 'element' | 'function';
  hearts: number; gold: number; gem: number;
  globalRoom: number; foe: Foe;
  thrown: boolean;          // 本轮 loadout 是否已掷出
  rolled: RolledDie[]; disabled: Set<number>; selected: Set<number>; rerolls: number;
  reward: string[]; msg: string;
}

const newFoe = (g: number): Foe => makeFoe(g, (g - 1) % 3);
const layerName = (g: number): string => ACTS[Math.floor((g - 1) / 3) % ACTS.length]!.name;
const roomKindCn = (g: number): string => { const r = (g - 1) % 3; return r === 0 ? '砸血间' : r === 1 ? '试炼间' : '守关间'; };

// 一颗骰子的"招牌面"图标（元素色字形）。
const dieGlyph = (el: Elem): string => ELEM_INFO[el].glyph;
// 骰库/骰组卡片的骰面图标（Unicode 骰面 ⚀-⚅·代表面点数·复刻原型的 pip 骰图标）。
const DIE_FACE_CHARS = '⚀⚁⚂⚃⚄⚅';
const dieFaceChar = (def: DieDef): string => DIE_FACE_CHARS[Math.max(0, Math.min(5, (def.faces[2]?.v ?? 4) - 1))]!;
const elemTone = (el: Elem): 'ok' | 'danger' | 'warn' | 'accent' | 'dim' =>
  el === 'mu' ? 'ok' : el === 'huo' ? 'danger' : el === 'lei' || el === 'feng' ? 'warn' : 'accent';

// ── 出战骰组「骰型」评估（复刻屏③b·扑克牌型式·loadout 构成加成·展示为主）──────────────
function loadoutPattern(defs: DieDef[]): { name: string; pips: string; note: string } {
  if (defs.length === 0) return { name: '空骰组', pips: '◇◇◇◇◇', note: '从骰库点选装入' };
  const cnt = new Map<Elem, number>();
  for (const d of defs) { if (d.el === 'wild') continue; cnt.set(d.el, (cnt.get(d.el) ?? 0) + 1); }
  const distinct = cnt.size; const maxSame = Math.max(0, ...cnt.values());
  if (defs.length >= 5 && distinct >= 5) return { name: '五星同辉', pips: '◆◆◆◆◆', note: '满阵加成' };
  if (maxSame >= 3) return { name: '三元和鸣', pips: '◆◆◆◇◇', note: '中幅强化' };
  if (distinct >= 4) return { name: '四方汇聚', pips: '◆◆◆◇◇', note: '中幅强化' };
  if (maxSame >= 2) return { name: '元素对子', pips: '◆◇◇◇◇', note: '小幅强化' };
  return { name: '杂色阵', pips: '◇◇◇◇◇', note: '无额外加成' };
}

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  // 微缩盒庭 = 明快通透（复刻美术案：不暗黑·温暖泛光）——底衬做成柔和浅暖灰，让浮空盒庭「漂在光里」。
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 100% at 50% 38%,#eceae4 0%,#dcd9d4 60%,#c8c4c0 100%);overflow:hidden';
  const stage = document.createElement('div');
  stage.style.cssText = 'position:relative;line-height:0';
  wrapper.appendChild(stage);
  container.appendChild(wrapper);
  const w = Math.max(320, Math.min(1180, wrapper.clientWidth || 1000));
  const h = Math.max(240, Math.min(760, wrapper.clientHeight || 620));

  const assets = new AssetManager(new ModelAssetLoader());
  assets.registerManifest(GAME_D_ASSETS);
  void assets.loadAll();

  const engine = new Engine();
  engine.load(baseBlueprint());
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0xe7e3dc, assets });
  engine.attachRenderer(renderer, stage);

  // 3D 房间背景：流式 + 相机往上 dolly
  const loaded = new Map<number, string[]>();
  const loadRoom = (i: number): void => {
    if (i < 0 || loaded.has(i)) return;
    const ids: string[] = [];
    for (const [id, ent] of Object.entries(genRoom(i))) {
      engine.world.createEntity(id);
      for (const [type, data] of Object.entries(ent as Record<string, object>)) engine.world.addComponent(id, { ...data, type } as Component);
      ids.push(id);
    }
    loaded.set(i, ids);
  };
  const unloadRoom = (i: number): void => { const ids = loaded.get(i); if (!ids) return; for (const id of ids) engine.world.destroyEntity(id); loaded.delete(i); };
  const streamTo = (c: number): void => { for (const i of [...loaded.keys()]) if (i < c - WINDOW || i > c + WINDOW) unloadRoom(i); for (let i = c - WINDOW; i <= c + WINDOW; i++) loadRoom(i); };
  let bgRoom = 0;
  const cam = (): Camera3D | undefined => engine.world.getComponent<Camera3D>('cam', 'Camera3D');

  // ── Title 大骰子（复刻原型 initTitle：单颗大命运骰缓转 + 暗塔氛围）──
  const hexNum = (el: Elem): number => parseInt(ELEM_INFO[el].hex.slice(1), 16);
  const TITLE_DIE = 'gd-title-die';
  let titleDieUp = false;
  const setMood = (dark: boolean): void => {
    // Title=**柔和蓝灰天穹**（复刻概念图高级感·非暗黑）；盒庭=浅暖。相机在天空盒球内 → 用 Sky3D 渐变穹顶。
    const s = engine.world.getComponent<{ type: 'Sky3D'; top: number; bottom: number; clouds?: boolean }>('sky', 'Sky3D');
    if (s) { s.top = dark ? 0x181231 : 0xd7dbe4; s.bottom = dark ? 0x0b0817 : 0xece7de; s.clouds = false; }
    // Title=**暗紫夜穹**（复刻原型 title：alpha 画布浮于深色页 + 暗角 vignette → 元素色发光骰 + 金 logo 高对比高级感·非浅蓝灰）；
    // 盒庭=浅暖灰绿（概念取样 #d6ddd6）。
    renderer.setBackgroundTexture(null);
    renderer.setBackground(dark ? 0x0c0a18 : 0xd6ddd6);
    // Title 关闭泛光/移轴（参考原型是纯 ACES 渲染·无 composer·骰子靠 emissive .16 自发光）；盒庭用强移轴+泛光。
    const p = engine.world.getComponent<{ type: 'Post3D'; tiltShift?: object; bloom?: object }>('post', 'Post3D');
    if (p) {
      p.tiltShift = { focus: 0.54, intensity: dark ? 0 : 1.7 };
      p.bloom = { strength: dark ? 0 : 0.72, radius: 0.7, threshold: dark ? 0.9 : 0.6 };
    }
    // 三点补光（复刻参考）：Title 把基础灯改成 Ambient 白 .5 + Key 平行光 #fff0d8 int1.1（去向 -3,-4,-5），
    // 关掉盒庭的蓝色平行补光（fillDir）——Rim/Fill 由 showTitleDie 的两盏点光顶上。盒庭恢复原值。
    const amb = engine.world.getComponent<{ type: 'Light3D'; color: number; intensity: number }>('amb', 'Light3D');
    if (amb) { amb.color = 0xffffff; amb.intensity = dark ? 0.5 : 0.6; }
    const sun = engine.world.getComponent<{ type: 'Light3D'; color: number; intensity: number; dirX: number; dirY: number; dirZ: number; castShadow: boolean }>('sun', 'Light3D');
    if (sun) { sun.color = 0xfff0d8; sun.intensity = dark ? 1.1 : 1.05; sun.dirX = dark ? -3 : -6; sun.dirY = dark ? -4 : -11; sun.dirZ = -5; sun.castShadow = true; }
    const fillDir = engine.world.getComponent<{ type: 'Light3D'; color: number; intensity: number; dirX: number; dirY: number; dirZ: number }>('fillDir', 'Light3D');
    if (fillDir) { fillDir.color = 0x6f7cff; fillDir.intensity = dark ? 0 : 0.35; fillDir.dirX = 5; fillDir.dirY = -4; fillDir.dirZ = 4; }
    // 相机：Title=**参考原型正面透视**（fov 38·pos (0,0.2,6.3)·lookAt 原点 → yaw 0 / pitch 0.032 / dist 6.3）；盒庭=近俯视 ortho。
    const c = engine.world.getComponent<Camera3D>('cam', 'Camera3D');
    if (c) {
      if (dark) { c.projection = 'perspective'; c.fov = 38; c.yaw = 0; c.pitch = 0.032; c.distance = 6.3; c.pivotX = 0; c.pivotY = 0; c.pivotZ = 0; }
      else { c.projection = 'ortho'; c.yaw = Math.PI; c.pitch = 0.98; c.orthoSize = 13; c.distance = 240; c.pivotX = 0; c.pivotY = 1.5; c.pivotZ = 0; }
    }
  };
  const showTitleDie = (): void => {
    if (titleDieUp) return;
    // 命运骰（严格 1:1 复刻参考·owner 2026-07-01 上传 TS）：六面各一元素色 MeshStandard
    // （emissive=元素色·ei .16 / rough .42 / metal .18 / CanvasTexture）。初始姿态 rot(0.5,0.7,0)，固定匀速翻滚（见 tick）。
    // 面序 = BoxGeometry [右+X,左-X,顶+Y,底-Y,前+Z,后-Z]，点数 [1,6,2,5,3,4]，颜色六元素 火/水/木/雷/风/暗。
    const ELEM_FACES = [
      { color: 0xff5b4d, pip: 1 }, // 火（右 +X）
      { color: 0x3ba0ff, pip: 6 }, // 水（左 -X）
      { color: 0x46c66a, pip: 2 }, // 木（顶 +Y）
      { color: 0xffcf3f, pip: 5 }, // 雷（底 -Y）
      { color: 0xe8edf3, pip: 3 }, // 风（前 +Z）
      { color: 0x9b6cff, pip: 4 }, // 暗（后 -Z）
    ];
    // 骰子（原型原尺寸 1.95·die.y -0.45）。相机/光/背光晕由 setMood + 下方三点补光按参考装配。
    engine.world.createEntity(TITLE_DIE);
    engine.world.addComponent(TITLE_DIE, { type: 'Transform3D', x: 0, y: -0.45, z: 0, rotX: 0.5, rotY: 0.7, scale: 1 } as unknown as Component);
    engine.world.addComponent(TITLE_DIE, { type: 'Mesh3D', shape: 'box', width: 1.95, height: 1.95, depth: 1.95, frontTint: 0xeef4ff, dieFaces: ELEM_FACES } as unknown as Component);
    // 三点补光的两盏点光（复刻参考·Rim 紫 + Fill 蓝·range 30）。Ambient + Key 平行光由 setMood 改基础灯。
    engine.world.createEntity('gd-title-rim');
    engine.world.addComponent('gd-title-rim', { type: 'Light3D', kind: 'point', color: 0x9b6cff, intensity: 1.2, x: -4, y: 1, z: -3, range: 30, decay: 2 } as unknown as Component);
    engine.world.createEntity('gd-title-fill');
    engine.world.addComponent('gd-title-fill', { type: 'Light3D', kind: 'point', color: 0x3ba0ff, intensity: 0.7, x: 4, y: -2, z: 2, range: 30, decay: 2 } as unknown as Component);
    // 背光柔光晕（复刻参考 sprite·tint #ffe5a8·scale 6.4·pos (0,-.45,-1.4)）
    engine.world.createEntity('gd-title-glow');
    engine.world.addComponent('gd-title-glow', { type: 'Transform3D', x: 0, y: -0.45, z: -1.4 } as unknown as Component);
    engine.world.addComponent('gd-title-glow', { type: 'Glow3D', color: 0xffe5a8, scale: 6.4, opacity: 0.85 } as unknown as Component);
    titleDieUp = true;
  };
  const hideTitleDie = (): void => { if (!titleDieUp) return; try { engine.world.destroyEntity(TITLE_DIE); engine.world.destroyEntity('gd-title-rim'); engine.world.destroyEntity('gd-title-fill'); engine.world.destroyEntity('gd-title-glow'); } catch { /* noop */ } titleDieUp = false; };

  const S: S = {
    phase: 'title', library: startLibrary(), loadout: [], detail: 'baida', dishTab: 'all',
    hearts: SOLO_HEARTS, gold: 128, gem: 7, globalRoom: 1, foe: newFoe(1), thrown: false,
    rolled: [], disabled: new Set(), selected: new Set(), rerolls: REROLLS, reward: [], msg: '',
  };

  // 开局停在 Title：暗氛围 + 大骰（不流式房间；「开始攀塔」再进盒庭）——须在 S 声明后（setMood 读 S）。
  setMood(true); showTitleDie();

  // ════════ 通用小件 ════════
  const bareRow = (id: string, children: LayoutNode[], extra: Record<string, unknown> = {}): LayoutNode =>
    ({ type: 'Panel', id, props: { bare: true }, layout: { direction: 'row', gap: 8, ...extra }, children });
  const bareCol = (id: string, children: LayoutNode[], extra: Record<string, unknown> = {}): LayoutNode =>
    ({ type: 'Panel', id, props: { bare: true }, layout: { direction: 'column', gap: 6, ...extra }, children });
  const lbl = (id: string, text: string, p: Record<string, unknown> = {}): LayoutNode =>
    ({ type: 'Label', id, props: { text, ...p } });

  // ════════ 屏① Title ════════
  // 漂浮光尘（复刻原型 4 颗彩色 mote·float 动画·纯装饰）：火黄/暗紫/水蓝/木绿。
  const MOTES: [number, number, number, string, number][] = [
    [0.22, 0.62, 7, '#ffe5a8', 5000], [0.74, 0.54, 6, '#9b6cff', 6400], [0.62, 0.70, 8, '#3ba0ff', 5600], [0.34, 0.48, 6, '#46c66a', 7000],
  ];
  const titleTree = (): LayoutNode => ({
    // 暗角 vignette（复刻原型 radial 80%70%@50%42% 透明→暗·中亮边暗的「眩晕色」）→ 让 3D 大骰居中透出、边缘压暗出高级感。
    type: 'Screen', id: 'gd-title', props: { bg: 'radial-gradient(78% 66% at 50% 44%, rgba(20,14,34,0) 52%, rgba(8,5,20,0.62) 100%)' },
    children: [
      ...MOTES.map(([sx, sy, d, c, ms], i): LayoutNode => ({ type: 'Panel', id: `gd-mote${i}`, props: { bg: `radial-gradient(circle, ${c} 30%, transparent 72%)` }, layout: { x: Math.round(sx * w), y: Math.round(sy * h), width: d + 6, height: d + 6, radius: d + 6, padding: 0, opacity: 0.9, fx: [{ kind: 'float', ms }] }, children: [] })),
      { type: 'Panel', id: 'gd-logo-box', props: { bare: true }, layout: { x: w / 2 - 240, y: Math.round(h * 0.07), width: 480, direction: 'column', align: 'center', gap: 9 },
        children: [
          // 确切复刻原型：logo 76px 衬线 letter-spacing6·副标 Cinzel 15px sp6 两侧细线·tagline 13px
          lbl('gd-name', '骰途', { size: 76, color: 'gold', bold: true, glow: true, tracking: 6, font: 'serif' }),
          bareRow('gd-subrow', [
            { type: 'Panel', id: 'gd-sl', props: { bg: 'linear-gradient(90deg,transparent,#cdbfe8)' }, layout: { width: 34, height: 1, padding: 0 }, children: [] },
            lbl('gd-sub', 'TOWER OF FATE', { size: 15, color: 'sub', tracking: 6, font: 'serif' }),
            { type: 'Panel', id: 'gd-sr', props: { bg: 'linear-gradient(90deg,#cdbfe8,transparent)' }, layout: { width: 34, height: 1, padding: 0 }, children: [] },
          ], { justify: 'center', align: 'center', gap: 12 }),
          lbl('gd-tag', '两名掷命者，一座会改写命运的古塔', { size: 13, color: 'sub', tracking: 1 }),
        ],
      },
      { type: 'Panel', id: 'gd-btns', props: { bare: true }, layout: { x: w / 2 - 170, y: h - 150, width: 340, direction: 'column', align: 'center', gap: 13 },
        children: [
          // 金渐变 hero 键（复刻原型 #ffd982→#f0a93a·主程回驳 Button 自定义色 → 用 Panel.action+bg 拼）
          { type: 'Panel', id: 'gd-start', props: { action: 'start', bg: 'linear-gradient(180deg,#ffd982,#f0a93a)', edge: 'gold' }, layout: { width: 236, radius: 13, padding: 14, align: 'center', direction: 'column', gap: 3, fx: [{ kind: 'pulse', ms: 3400 }] },
            children: [lbl('gd-start-t', '开 始 攀 塔', { size: 19, color: 'text', bold: true, font: 'serif', tracking: 4 })] }, // TODO(REQ-UI-ink)：原型深色字 #3a2406 on gold·待主程加 Label 'ink' 深色令牌后改
          lbl('gd-start-s', `第一层 · ${layerName(1)}`, { size: 'sm', color: 'sub', tracking: 2 }),
          bareRow('gd-modes', [
            { type: 'Button', id: 'gd-coop', props: { label: '双人同攀', kind: 'ghost', action: 'start' } },
            { type: 'Button', id: 'gd-solo', props: { label: '单人', kind: 'ghost', action: 'start' } },
            { type: 'Button', id: 'gd-set', props: { label: '设置', kind: 'ghost', action: 'noop' } },
          ], { justify: 'center', gap: 10 }),
        ],
      },
    ],
  });

  // ════════ 屏② 塔内场景 HUD ════════
  // 左：六色元素法阵环（竖列）
  const elemRing = (el: Elem, i: number): LayoutNode => {
    const dim = S.foe.trialEl && S.foe.trialEl !== el && el !== 'feng';
    return {
      type: 'Panel', id: `hud-ring-${el}`, props: { bare: true, action: 'castElem', actionArg: el },
      layout: { width: 58, height: 58, radius: 29, align: 'center', justify: 'center', padding: 0, ...(S.foe.trialEl === el ? { fx: [{ kind: 'glow' as const, color: 'gold' as const }] } : dim ? { fx: [{ kind: 'fade' as const }] } : {}) },
      children: [{ type: 'Image', id: `hud-ring-i-${el}`, props: { src: elementBadge(el), fit: 'contain' }, layout: { width: 58, height: 58 } }],
    };
  };
  const elemColumn = (): LayoutNode => ({
    type: 'Panel', id: 'hud-elems', props: { bare: true }, layout: { x: 14, y: 70, direction: 'column', gap: 10 },
    children: ELEMS.map((el, i) => elemRing(el, i)),
  });
  // 顶左：层间 chip
  const layerChip = (): LayoutNode => ({
    type: 'Panel', id: 'hud-layer', props: { glass: true }, layout: { x: 14, y: 12, direction: 'row', gap: 10, align: 'center', padding: 8 },
    children: [
      { type: 'Panel', id: 'hud-layer-n', props: { edge: 'gold' }, layout: { width: 34, height: 34, radius: 8, align: 'center', justify: 'center', padding: 0 }, children: [lbl('hud-layer-nn', String(Math.floor((S.globalRoom - 1) / 3) + 1), { size: 'lg', color: 'gold', bold: true })] },
      bareCol('hud-layer-t', [
        lbl('hud-layer-name', `第${Math.floor((S.globalRoom - 1) / 3) + 1}层 · ${layerName(S.globalRoom)}`, { size: 'sm', bold: true }),
        lbl('hud-layer-sub', `${roomKindCn(S.globalRoom)} · 房间 ${S.globalRoom}`, { size: 'xs', color: 'sub' }),
      ], { gap: 1 }),
    ],
  });
  // 顶右：货币
  const currency = (): LayoutNode => ({
    type: 'Panel', id: 'hud-cur', props: { bare: true }, layout: { x: w - 248, y: 14, direction: 'row', gap: 8 },
    children: [
      { type: 'Tag', id: 'hud-gold', props: { label: `🪙 ${S.gold}`, tone: 'accent', size: 'lg' } },
      { type: 'Tag', id: 'hud-gem', props: { label: `💎 ${S.gem}`, tone: 'normal', size: 'lg' } },
    ],
  });
  // 右：队友 + Buff
  const allyPanel = (): LayoutNode => ({
    type: 'Panel', id: 'hud-ally', props: { bare: true }, layout: { x: w - 234, y: 58, direction: 'column', gap: 8, width: 220 },
    children: [
      {
        type: 'Panel', id: 'hud-ally-card', props: { glass: true }, layout: { direction: 'column', gap: 6, padding: 10 },
        children: [
          bareRow('hud-ally-hd', [
            { type: 'Avatar', id: 'hud-ally-av', props: { name: '乙', size: 34, shape: 'rounded' } },
            bareCol('hud-ally-nm', [
              bareRow('hud-ally-nmr', [lbl('hud-ally-name', '掷命者 · 乙', { size: 'sm', bold: true }), lbl('hud-ally-lv', 'Lv.4', { size: 'xs', color: 'gold' })], { justify: 'between' }),
              lbl('hud-ally-st', '协战中 · 邻室', { size: 'xs', color: 'sub' }),
            ], { gap: 1, flex: 1 }),
          ], { align: 'center' }),
          { type: 'ProgressBar', id: 'hud-ally-hp', props: { value: 0.72, max: 1, tone: 'danger', label: '生命' } },
          { type: 'ProgressBar', id: 'hud-ally-sh', props: { value: 0.4, max: 1, tone: 'accent', label: '护盾' } },
        ],
      },
      {
        type: 'Panel', id: 'hud-buffs', props: { title: '当前 BUFF', glass: true }, layout: { direction: 'column', gap: 5, padding: 10 },
        children: ALLY_BUFFS.map((b, i): LayoutNode => ({
          type: 'Panel', id: `hud-buff-${i}`, props: { bare: true }, layout: { direction: 'row', gap: 6, justify: 'between', align: 'center' },
          children: [
            lbl(`hud-buff-n${i}`, `${ELEM_INFO[b.el].emoji} ${ELEM_INFO[b.el].cn} · ${b.name}`, { size: 'xs' }),
            lbl(`hud-buff-t${i}`, b.tail, { size: 'xs', color: 'sub' }),
          ],
        })),
      },
    ],
  });
  // 中：敌人 + 门槛（紧凑·浮在 3D 之上）
  const foeCenter = (): LayoutNode => {
    const f = S.foe;
    const sel = [...S.selected].map((i) => S.rolled[i]!);
    const ev = evalChallenge(sel, f.conds);
    return {
      type: 'Panel', id: 'hud-foe', props: { glass: true }, layout: { x: w / 2 - 170, y: 14, width: 340, direction: 'column', gap: 5, padding: 12, align: 'center' },
      children: [
        lbl('hud-foe-nm', `${f.isBoss ? '👑 守关者' : '⚔'} ${ELEM_INFO[f.el].emoji} ${f.name}`, { size: 'md', bold: true, glow: true }),
        { type: 'ProgressBar', id: 'hud-foe-hp', props: { value: Math.max(0, f.hp), max: f.maxHp, tone: 'danger', showValue: true, label: 'HP' } },
        bareRow('hud-foe-req', ev.results.map((r, i): LayoutNode => ({ type: 'Tag', id: `hud-foe-c${i}`, props: { label: `${r.ok ? '✓' : '·'} ${r.label}`, tone: r.ok ? 'accent' : 'dim', size: 'sm' } })), { justify: 'center', gap: 6 }),
        ...(f.counter.kind !== 'none' ? [lbl('hud-foe-ctr', `🚫 反制：${f.counter.label}`, { size: 'xs', color: 'warn' })] : []),
      ],
    };
  };
  // 底：命运骰盅入口 / 战斗控制
  const bottomBar = (): LayoutNode => {
    const loadDefs = S.loadout.map((id) => dieDef(S.library.find((d) => d.id === id)!));
    if (!S.thrown) {
      // 备战：去骰盅 / 直接掷出
      const preview = loadDefs.slice(0, 8).map((d, i): LayoutNode => ({ type: 'Tag', id: `bb-pv${i}`, props: { label: dieGlyph(d.el), tone: elemTone(d.el), size: 'md' } }));
      return {
        type: 'Panel', id: 'hud-bottom', props: { glass: true }, layout: { x: w / 2 - 290, y: h - 84, width: 580, direction: 'row', gap: 12, align: 'center', justify: 'between', padding: 10 },
        children: [
          bareRow('bb-dish', [
            lbl('bb-cup', '🎲', { size: 'xl' }),
            bareCol('bb-cupt', [
              lbl('bb-cup-t', '命运骰盅', { size: 'sm', bold: true, color: 'gold' }),
              lbl('bb-cup-s', `出战 ${S.loadout.length} 颗 · 越省越好`, { size: 'xs', color: 'sub' }),
            ], { gap: 1 }),
          ], { align: 'center' }),
          bareRow('bb-pv', preview, { gap: 4 }),
          bareRow('bb-acts', [
            { type: 'Button', id: 'bb-open', props: { label: '选骰备战', kind: 'ghost', action: 'openDish' } },
            { type: 'Button', id: 'bb-throw', props: { label: '🎲 掷出', kind: 'hero', disabled: S.loadout.length === 0, action: 'throw' } },
          ], { gap: 6, align: 'center' }),
        ],
      };
    }
    // 已掷出：选骰提交
    const sel = [...S.selected].map((i) => S.rolled[i]!);
    const ev = evalChallenge(sel, S.foe.conds);
    const d = damageOf(sel);
    return {
      type: 'Panel', id: 'hud-bottom', props: { glass: true }, layout: { x: w / 2 - 300, y: h - 134, width: 600, direction: 'column', gap: 6, align: 'center', padding: 10 },
      children: [
        bareRow('bb-dice', S.rolled.map((r, i): LayoutNode => S.disabled.has(i)
          ? { type: 'Button', id: `bb-d${i}`, props: { label: `🚫${ELEM_INFO[r.el].emoji}${r.v}`, kind: 'quiet', action: 'noop' } }
          : { type: 'Button', id: `bb-d${i}`, props: { label: `${ELEM_INFO[r.el].emoji}${r.v}`, kind: S.selected.has(i) ? 'primary' : 'ghost', action: 'pick', actionArg: String(i) } }),
          { justify: 'center', gap: 6 }),
        lbl('bb-prev', sel.length
          ? `总和 ${d.sum} · 牌型 ${d.pat.name} ×${d.pat.mult}${ev.met ? ` → 命中扣 ${d.dmg} HP ✅` : ' · ⬜ 未达门槛'}`
          : '点选骰子组一手（🚫=被反制禁用 · 凑牌型翻倍伤害）',
          { size: 'sm', color: ev.met ? 'ok' : (sel.length ? 'warn' : 'dim') }),
        bareRow('bb-ctrl', [
          { type: 'Button', id: 'bb-submit', props: { label: '✔ 提交一手', kind: 'hero', disabled: sel.length === 0, action: 'submit' } },
          { type: 'Button', id: 'bb-rr', props: { label: `🎲 重掷未选 (${S.rerolls})`, kind: S.rerolls > 0 ? 'ghost' : 'quiet', action: 'reroll' } },
          { type: 'Button', id: 'bb-redish', props: { label: '改骰组', kind: 'ghost', action: 'openDish' } },
        ], { justify: 'center' }),
      ],
    };
  };
  const arenaTree = (): LayoutNode => ({
    type: 'Screen', id: 'gd-arena', props: { bg: 'transparent' },
    children: [layerChip(), currency(), elemColumn(), allyPanel(), foeCenter(), bottomBar(),
      ...(S.msg ? [{ type: 'Panel', id: 'gd-msg', props: {}, layout: { x: w / 2 - 170, y: h - (S.thrown ? 168 : 122), width: 340, padding: 7, align: 'center' }, children: [lbl('gd-msg-t', S.msg, { size: 'xs', color: 'gold' })] } as LayoutNode] : []),
    ],
  });

  // ════════ 屏③ 命运骰盅 · 选骰备战 ════════
  const dieCard = (def: DieDef): LayoutNode => {
    const inLoad = S.loadout.some((id) => dieDef(S.library.find((d) => d.id === id)!).defId === def.defId);
    return {
      type: 'Panel', id: `dc-${def.defId}`, props: { action: 'dishPick', actionArg: def.defId, accent: S.detail === def.defId, edge: inLoad ? 'gold' : undefined },
      layout: { direction: 'column', gap: 5, padding: 10 },
      children: [
        bareRow(`dc-hd-${def.defId}`, [
          { type: 'Image', id: `dc-ic-${def.defId}`, props: { src: diceFaceArt(def.el, def.faces[2]?.v ?? 4), fit: 'contain' }, layout: { width: 46, height: 46 } },
          ...(inLoad ? [lbl(`dc-ck-${def.defId}`, '✓', { size: 'md', color: 'gold', bold: true })] : []),
        ], { justify: 'between', align: 'center' }),
        lbl(`dc-nm-${def.defId}`, def.name, { size: 'sm', bold: true }),
        { type: 'Rating', id: `dc-ra-${def.defId}`, props: { value: def.rarity, max: 5 } },
        bareRow(`dc-tg-${def.defId}`, [
          { type: 'Tag', id: `dc-te-${def.defId}`, props: { label: ELEM_INFO[def.el].cn, tone: elemTone(def.el), size: 'sm' } },
          { type: 'Tag', id: `dc-ts-${def.defId}`, props: { label: sizeCn(def.size), tone: 'dim', size: 'sm' } },
          ...def.tags.map((t, i): LayoutNode => ({ type: 'Tag', id: `dc-tt-${def.defId}-${i}`, props: { label: t, tone: 'normal', size: 'sm' } })),
        ], { gap: 4 }),
      ],
    };
  };
  const dishLibrary = (): LayoutNode => {
    const cat = DICE_CATALOG.filter((d) => S.dishTab === 'all' || d.group === S.dishTab);
    return bareCol('dish-lib', [
      bareRow('dish-libhd', [
        lbl('dish-libt', '可选骰 · 点选装入出战骰组', { size: 'sm', color: 'sub', bold: true }),
        bareRow('dish-tabs', ([['all', '全部'], ['element', '元素骰'], ['function', '功能骰']] as [S['dishTab'], string][]).map(([k, label]): LayoutNode =>
          ({ type: 'Tag', id: `dish-tab-${k}`, props: { label, active: S.dishTab === k, action: 'dishTab', actionArg: k, size: 'sm' } })), { gap: 6 }),
      ], { justify: 'between', align: 'center' }),
      { type: 'Panel', id: 'dish-grid', props: { scroll: true }, layout: { direction: 'grid', minCol: 150, gap: 10, padding: 4, height: h - 150 }, children: cat.map(dieCard) },
    ], { gap: 8, flex: 1 });
  };
  const dishDetail = (): LayoutNode => {
    const def = DICE_CATALOG.find((d) => d.defId === S.detail) ?? DICE_CATALOG[0]!;
    const inLoad = S.loadout.some((id) => dieDef(S.library.find((d) => d.id === id)!).defId === def.defId);
    return {
      type: 'Panel', id: 'dish-detail', props: { glass: true }, layout: { direction: 'column', gap: 8, padding: 14, width: 250 },
      children: [
        bareRow('dd-hd', [
          { type: 'Panel', id: 'dd-ic', props: { bg: ELEM_INFO[def.el].hex }, layout: { width: 56, height: 56, radius: 12, align: 'center', justify: 'center', padding: 0 }, children: [lbl('dd-icg', dieGlyph(def.el), { size: 'xl' })] },
          bareCol('dd-nm', [
            lbl('dd-name', def.name, { size: 'lg', bold: true, color: 'gold' }),
            bareRow('dd-tags', [
              { type: 'Tag', id: 'dd-te', props: { label: ELEM_INFO[def.el].cn, tone: elemTone(def.el), size: 'sm' } },
              { type: 'Tag', id: 'dd-ts', props: { label: `${sizeCn(def.size)} · ${def.sides}面`, tone: 'dim', size: 'sm' } },
            ], { gap: 4 }),
            { type: 'Rating', id: 'dd-ra', props: { value: def.rarity, max: 5 } },
          ], { gap: 4 }),
        ], { align: 'center', gap: 10 }),
        { type: 'Panel', id: 'dd-ab', props: { bg: 'rgba(0,0,0,0.25)' }, layout: { padding: 10, radius: 8 }, children: [lbl('dd-abt', def.ability, { size: 'sm', color: 'text' })] },
        lbl('dd-faces-t', `骰面 · ${def.sides} 面`, { size: 'xs', color: 'sub' }),
        bareRow('dd-faces', def.faces.map((f, i): LayoutNode => ({ type: 'Panel', id: `dd-f${i}`, props: { edge: 'gold' }, layout: { width: 30, height: 30, radius: 6, align: 'center', justify: 'center', padding: 0 }, children: [lbl(`dd-fv${i}`, `${ELEM_INFO[f.el].emoji}${f.v}`, { size: 'xs' })] })), { gap: 5 }),
        lbl('dd-flavor', def.flavor, { size: 'xs', color: 'dim' }),
        { type: 'Button', id: 'dd-toggle', props: { label: inLoad ? '移出骰组' : '装入骰组', kind: inLoad ? 'ghost' : 'primary', action: 'dishPick', actionArg: def.defId } },
      ],
    };
  };
  const dishLoadout = (): LayoutNode => {
    const loadDefs = S.loadout.map((id) => dieDef(S.library.find((d) => d.id === id)!));
    const pat = loadoutPattern(loadDefs);
    const f = S.foe;
    const trialCond = f.conds.find((c) => c.kind === 'element');
    const have = trialCond && trialCond.kind === 'element' ? loadDefs.filter((d) => d.el === trialCond.el || d.el === 'wild').length : 0;
    const need = trialCond && trialCond.kind === 'element' ? trialCond.n : 0;
    return {
      type: 'Panel', id: 'dish-load', props: { accent: true, glass: true }, layout: { direction: 'column', gap: 8, padding: 12, width: 250 },
      children: [
        bareRow('dl-hd', [
          lbl('dl-t', '出战骰组', { size: 'md', bold: true, color: 'gold' }),
          lbl('dl-cnt', `${S.loadout.length} / ${LOADOUT_CAP}`, { size: 'sm', color: S.loadout.length > LOADOUT_CAP ? 'danger' : 'sub' }),
        ], { justify: 'between', align: 'center' }),
        lbl('dl-sub', '阵容偏大 · 谨慎取舍（越省越好）', { size: 'xs', color: 'dim' }),
        // 动态尺寸：选得越少 → 骰子越大越金（奖励精简·复刻原型 loSize/loGlow）。
        (() => {
          const n = S.loadout.length;
          const sz = n <= 2 ? 60 : n === 3 ? 52 : n === 4 ? 46 : 40;
          const lean = n > 0 && n <= 3; // 精简阵 → 金光
          return bareRow('dl-slots', Array.from({ length: Math.max(LOADOUT_CAP, n) }, (_, i): LayoutNode => {
            const id = S.loadout[i];
            if (id) { const def = dieDef(S.library.find((d) => d.id === id)!); return { type: 'Panel', id: `dl-s${i}`, props: { bg: ELEM_INFO[def.el].hex, action: 'dishRemove', actionArg: id, ...(lean ? { edge: 'gold' as const } : {}) }, layout: { width: sz, height: sz, radius: Math.round(sz * 0.22), align: 'center', justify: 'center', padding: 0, ...(lean ? { fx: [{ kind: 'glow' as const, color: 'gold' as const }] } : {}) }, children: [lbl(`dl-sg${i}`, DIE_FACE_CHARS[Math.min(5, i + 1)]!, { size: n <= 3 ? 'xl' : 'lg', color: 'text' })] }; }
            return { type: 'Panel', id: `dl-s${i}`, props: { dashed: true, edge: 'gold' }, layout: { width: 40, height: 40, radius: 9, padding: 0 }, children: [] };
          }), { gap: 8, justify: 'center', align: 'center' });
        })(),
        { type: 'Divider', id: 'dl-div', props: {} },
        bareRow('dl-pat', [
          bareCol('dl-patl', [lbl('dl-pat-l', '骰型', { size: 'xs', color: 'sub' }), lbl('dl-pat-n', pat.name, { size: 'sm', bold: true, color: 'gold' })], { gap: 1 }),
          bareCol('dl-patr', [lbl('dl-pat-p', pat.pips, { size: 'sm', color: 'gold' }), lbl('dl-pat-note', pat.note, { size: 'xs', color: 'sub' })], { gap: 1, align: 'end' }),
        ], { justify: 'between', align: 'center' }),
        ...(trialCond ? [bareRow('dl-trial', [
          lbl('dl-trial-l', `本轮可凑 · 对照试炼`, { size: 'xs', color: 'sub' }),
          lbl('dl-trial-v', `${ELEM_INFO[(trialCond as { el: Elem }).el].cn} ${have}/${need} ${have >= need ? '✅' : '✗'}`, { size: 'sm', bold: true, color: have >= need ? 'ok' : 'danger' }),
        ], { justify: 'between', align: 'center' })] : []),
        { type: 'Button', id: 'dl-confirm', props: { label: `确认投掷 · ${S.loadout.length} 骰`, kind: 'hero', disabled: S.loadout.length === 0, action: 'throw' } },
        lbl('dl-hint', S.loadout.length === 0 ? '选择尚未满足试炼需求' : '回到战场掷出这组骰子', { size: 'xs', color: 'dim' }),
      ],
    };
  };
  const dishTree = (): LayoutNode => {
    const f = S.foe;
    const trialCond = f.conds.find((c) => c.kind === 'element');
    return {
      type: 'Screen', id: 'gd-dish', props: { bg: 'transparent' }, // 透明 → 骰盅玻璃面板浮在（模糊的）盒庭之上
      children: [{
        // 「命运骰盅」紫布面板（渐变 + 斜纹织物·复刻原型 165deg 紫布 + woven texture）+ 金边。
        // 磨砂玻璃骰盅（半透深紫玻璃 + backdrop-blur·概念图取样底 #241828→半透）：盒庭从后透出模糊
        type: 'Panel', id: 'dish-root', props: { glass: true, bg: 'linear-gradient(165deg,rgba(42,22,50,0.78) 0%,rgba(29,16,38,0.84) 55%,rgba(20,12,26,0.88) 100%)', pattern: 'stripe', edge: 'gold' }, layout: { direction: 'column', gap: 10, padding: 18, maxWidth: 1140, radius: 18 },
        children: [
          // header
          bareRow('dish-hdr', [
            bareRow('dish-hdl', [
              // 酒红骰盅图标（顶一颗金球·复刻原型 dice-cup glyph）
              { type: 'Panel', id: 'dish-cup', props: { bg: 'radial-gradient(120% 120% at 30% 20%,#a8506a,#6e2d44)' }, layout: { width: 50, height: 50, radius: 14, align: 'center', justify: 'start', padding: 0 }, children: [{ type: 'Panel', id: 'dish-cup-ball', props: { bg: 'radial-gradient(circle at 35% 30%,#ffd98a,#e0a328)' }, layout: { width: 17, height: 17, radius: 9, y: -5, x: 16, padding: 0 }, children: [] }] },
              bareCol('dish-hdt', [
                lbl('dish-title', '命运骰盅', { size: 'xxl', bold: true, color: 'gold', glow: true }),
                lbl('dish-sub', `第${Math.floor((S.globalRoom - 1) / 3) + 1}层 · ${layerName(S.globalRoom)} · 选出本轮要投掷的骰子，越省越好`, { size: 'sm', color: 'sub' }),
              ], { gap: 2 }),
            ], { align: 'center', gap: 12 }),
            {
              type: 'Panel', id: 'dish-req', props: { edge: 'gold', glass: true }, layout: { direction: 'column', gap: 4, padding: 12, width: 280 },
              children: [
                lbl('dish-req-t', `本关需求 · ${layerName(S.globalRoom)} · 试炼之庭`, { size: 'xs', color: 'gold', bold: true }),
                bareRow('dish-req-c', f.conds.map((c, i): LayoutNode => ({ type: 'Tag', id: `dish-req-c${i}`, props: { label: condLabel(c), tone: 'accent', size: 'md' } })), { gap: 6 }),
                lbl('dish-req-s', trialCond ? `限 3 次投掷达成 · 唤醒${ELEM_INFO[(trialCond as { el: Elem }).el].cn}之力` : '靠多次投掷砸穿血量', { size: 'xs', color: 'sub' }),
              ],
            },
          ], { justify: 'between', align: 'start' }),
          { type: 'Divider', id: 'dish-div', props: {} },
          // body: library | detail+loadout
          bareRow('dish-body', [
            dishLibrary(),
            bareCol('dish-side', [dishDetail(), dishLoadout()], { gap: 10 }),
          ], { gap: 12, align: 'start' }),
          { type: 'Button', id: 'dish-back', props: { label: '← 返回战场', kind: 'ghost', action: 'closeDish' }, layout: { width: 140 } },
        ],
      }],
    };
  };

  // ════════ 屏④ 通关 + 战利品三选一 ════════
  const rewardTree = (): LayoutNode => ({
    type: 'Screen', id: 'gd-reward', props: { bg: 'transparent', center: true },
    children: [{
      type: 'Panel', id: 'rw-box', props: {}, layout: { direction: 'column', align: 'center', gap: 14, padding: 22, maxWidth: 640 },
      children: [
        lbl('rw-t', '⭐ 通关 · 命运抉择', { size: 'xl', color: 'gold', bold: true, glow: true }),
        lbl('rw-s', '三选一 · 一张命运骰收入骰库', { size: 'sm', color: 'sub' }),
        // 3D 战利品卡（手绘卡面·扇形浮动·点选·复刻屏④b）
        bareRow('rw-cards', S.reward.map((defId, i): LayoutNode => ({
          type: 'Panel', id: `rw-c${i}`, props: { bare: true, action: 'reward', actionArg: String(i) },
          layout: { padding: 0, fx: [{ kind: 'float', ms: 3000 }], rotate: i === 0 ? -6 : i === 2 ? 6 : 0, ...(i === 1 ? { scale: 1.06 } : {}) },
          children: [{ type: 'Image', id: `rw-img${i}`, props: { src: lootCardArt(defId), fit: 'contain' }, layout: { width: 172, height: 240, radius: 14 } }],
        })), { gap: 18, justify: 'center', align: 'center' }),
      ],
    }],
  });

  // ════════ 终局 ════════
  const endTree = (win: boolean): LayoutNode => ({
    type: 'Screen', id: 'gd-end', props: { bg: 'transparent', center: true },
    children: [{
      type: 'Panel', id: 'end-box', props: {}, layout: { direction: 'column', align: 'center', gap: 12, padding: 22, maxWidth: 480 },
      children: [
        lbl('end-t', win ? '🏆 登顶！命运由你改写' : '💀 全灭… 命运之塔吞没了你', { size: 'xxl', color: win ? 'gold' : 'danger', bold: true, glow: true }),
        lbl('end-s', `走到 第 ${S.globalRoom} 间 · ${layerName(S.globalRoom)}`, { size: 'sm', color: 'sub' }),
        { type: 'Button', id: 'end-again', props: { label: '↻ 再来一局', kind: 'hero', action: 'restart' }, layout: { fx: [{ kind: 'pulse' }] } },
      ],
    }],
  });

  // ════════ 渲染分发 ════════
  const tree = (): LayoutNode => {
    switch (S.phase) {
      case 'title': return titleTree();
      case 'dish': return dishTree();
      case 'reward': return rewardTree();
      case 'gameover': return endTree(false);
      case 'victory': return endTree(true);
      default: return arenaTree();
    }
  };

  // ════════ 逻辑 ════════
  const beginRoom = (): void => {
    S.foe = newFoe(S.globalRoom); S.thrown = false; S.rolled = []; S.selected.clear(); S.disabled.clear(); S.rerolls = REROLLS;
    bgRoom = S.globalRoom - 1; streamTo(bgRoom);
    renderer.setBackgroundTexture(skyArt(Math.floor((S.globalRoom - 1) / 3), 'warm')); // 换层换天空图
  };
  const rewardChoices = (): string[] => {
    // 只发有手绘卡面的特制骰（基础元素骰不进战利品池）·三张不重复。
    const pool = [...CARDED_DEFIDS];
    const out: string[] = [];
    while (out.length < 3 && pool.length) { const j = Math.floor(rnd() * pool.length); out.push(pool.splice(j, 1)[0]!); }
    return out;
  };
  const throwLoadout = (): void => {
    if (S.loadout.length === 0) return;
    const dice = S.loadout.map((id) => S.library.find((d) => d.id === id)!);
    S.rolled = rollPool(dice, rnd);
    S.disabled = counterDisabled(S.rolled, S.foe.counter);
    S.selected.clear(); S.rerolls = REROLLS; S.thrown = true; S.phase = 'arena';
    S.msg = S.disabled.size ? '反制禁用了你最高+最低（🚫）·从其余里凑一手' : '点选骰子凑一手满足门槛';
    render();
  };
  const doSubmit = (): void => {
    const sel = [...S.selected].map((i) => S.rolled[i]!);
    const ev = evalChallenge(sel, S.foe.conds);
    if (ev.met) {
      const d = damageOf(sel);
      S.foe.hp -= d.dmg; S.gold += 6;
      if (S.foe.hp <= 0) {
        if (S.foe.isBoss) { S.hearts = Math.min(SOLO_HEARTS, S.hearts + 1); S.gem += 1; }
        S.reward = rewardChoices(); S.phase = 'reward'; S.msg = ''; render(); return;
      }
      S.msg = `命中！${d.pat.name}×${d.pat.mult} 扣 ${d.dmg}，敌 HP 剩 ${S.foe.hp}`;
      S.thrown = false; S.rolled = []; S.selected.clear(); S.disabled.clear(); render(); return;
    }
    S.hearts -= 1;
    if (S.hearts <= 0) { S.phase = 'gameover'; S.msg = ''; render(); return; }
    S.msg = `未达门槛 → 威胁 -1❤（剩 ${S.hearts}）`;
    S.thrown = false; S.rolled = []; S.selected.clear(); S.disabled.clear(); render();
  };
  const advanceRoom = (): void => {
    S.globalRoom += 1;
    if (S.globalRoom > FLOORS * 3) { S.phase = 'victory'; render(); return; }
    beginRoom(); S.phase = 'arena'; S.msg = `进入 ${roomKindCn(S.globalRoom)}`; render();
  };

  const handlers = (): Record<string, (arg?: string) => void> => ({
    noop: () => {},
    start: () => { hideTitleDie(); setMood(false); S.phase = 'arena'; beginRoom(); S.msg = '点「选骰备战」打开命运骰盅'; render(); },
    openDish: () => { S.phase = 'dish'; render(); },
    closeDish: () => { S.phase = 'arena'; render(); },
    dishTab: (arg) => { S.dishTab = (arg as S['dishTab']) ?? 'all'; render(); },
    dishPick: (arg) => {
      if (!arg) return; S.detail = arg;
      const idx = S.loadout.findIndex((id) => dieDef(S.library.find((d) => d.id === id)!).defId === arg);
      if (idx >= 0) { S.loadout.splice(idx, 1); }
      else {
        if (S.loadout.length >= LOADOUT_CAP) { S.msg = `出战骰组已满（${LOADOUT_CAP}）`; render(); return; }
        const die = S.library.find((d) => d.defId === arg && !S.loadout.includes(d.id));
        if (die) S.loadout.push(die.id);
      }
      render();
    },
    dishRemove: (arg) => { if (arg) S.loadout = S.loadout.filter((id) => id !== arg); render(); },
    throw: throwLoadout,
    pick: (arg) => { const i = Number(arg); if (S.disabled.has(i)) return; if (S.selected.has(i)) S.selected.delete(i); else S.selected.add(i); render(); },
    submit: doSubmit,
    reroll: () => {
      if (S.rerolls <= 0) return; S.rerolls -= 1;
      S.rolled = S.rolled.map((r, i) => (S.selected.has(i) || S.disabled.has(i)) ? r : rollPool([S.library.find((d) => d.id === r.dieId)!], rnd)[0]!);
      S.disabled = counterDisabled(S.rolled, S.foe.counter);
      for (const i of [...S.selected]) if (S.disabled.has(i)) S.selected.delete(i);
      render();
    },
    castElem: () => { S.msg = '元素技能 · 表演位（co-op/技能后接 sim）'; render(); },
    reward: (arg) => { const i = Number(arg); const defId = S.reward[i]; if (defId) S.library.push(makeDie(defId)); advanceRoom(); },
    restart: () => { S.library = startLibrary(); S.loadout = []; S.hearts = SOLO_HEARTS; S.gold = 128; S.gem = 7; S.globalRoom = 1; S.phase = 'arena'; beginRoom(); S.msg = '重新攀塔'; render(); },
  });

  // ════════ 挂载 ════════
  const uiHost = document.createElement('div');
  uiHost.style.cssText = 'position:absolute;inset:0;pointer-events:auto';
  wrapper.appendChild(uiHost);
  let ui: (() => void) | null = null;
  function render(): void { if (ui) ui(); ui = mountUI(uiHost, tree(), handlers(), GAME_D_THEME); }
  render();

  const unsub = engine.subscribe(() => {
    // 固定轴向匀速翻滚（复刻参考 tumble·@60fps 每帧 rot.x+=.004 / rot.y+=.006·X 慢 Y 快·同为正·无随机）。
    if (titleDieUp) { const td = engine.world.getComponent<{ type: 'Transform3D'; rotX?: number; rotY?: number }>(TITLE_DIE, 'Transform3D'); if (td) { td.rotX = (td.rotX ?? 0) + 0.004; td.rotY = (td.rotY ?? 0) + 0.006; } }
    const c = cam(); if (!c) return; const t = bgRoom * ROOM_SPACING; const cur = c.pivotZ ?? 0; c.pivotZ = Math.abs(t - cur) < 0.05 ? t : cur + (t - cur) * 0.12;
  });
  engine.start();

  return () => { unsub(); engine.stop(); renderer.destroy(); if (ui) ui(); uiHost.remove(); wrapper.remove(); };
}
