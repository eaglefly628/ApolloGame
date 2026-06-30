// Game D ·《骰途》挂载入口 —— 双人骰子 Roguelike（当前：单人战斗可玩原型 + 3D 房间背景 + 开场 Title）。
//
// owner 2026-06-29「先做出能玩的原型·慢慢调数值」。⚠️ 原型说明：战斗逻辑暂在游戏层（复用 combat.ts 纯函数·
// 即模拟器那套公式），UI 走 LayoutNode、骰子用彩色 emoji token、3D 房间当背景。**这是验证手感+调参的原型**，
// 上线版战斗要迁成数据驱动（蓝图+引擎能力·同 game-e·需 M0+主程）。双人协作(M2)见 combat-design §4。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@assets/index.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode } from '@ui/components/index.js';
import type { Camera3D } from '@engine/protocol/components.js';
import type { Component } from '@engine/core/types.js';
import { baseBlueprint, genRoom, roomMeta, ROOM_SPACING } from './rooms.js';
import { GAME_D_ASSETS } from './assets.js';
import {
  ELEM_INFO, FIVE, plainDie, elemDie, heavyDie, wildDie, rollPool, damageOf, makeEnemy, weaknessOf,
  type Die, type RolledDie, type Enemy, type Elem,
} from './combat.js';

const SOLO_HEARTS = 5;
const FLOORS = 4; // 4 层 × 3 间 = 12 间
const WINDOW = 1;
const rnd = () => Math.random(); // 原型：骰子随机用 Math.random（非 lockstep·上线版走种子 PRNG）

// 战斗状态（原型·游戏层）
interface CombatState {
  pool: Die[];
  hearts: number;
  globalRoom: number; // 1..12
  enemy: Enemy;
  phase: 'roll' | 'select' | 'reward' | 'gameover' | 'victory';
  rolled: RolledDie[];
  selected: Set<number>;
  rerolls: number;
  reward: Die[]; // 三选一
  msg: string;
}

const dieLabel = (r: RolledDie): string => `${ELEM_INFO[r.el].emoji}${r.v}`;
const elemLabel = (e: Elem): string => `${ELEM_INFO[e].emoji}${ELEM_INFO[e].cn}`;
const isBossRoom = (g: number): boolean => g % 3 === 0;

function newEnemy(globalRoom: number): Enemy {
  const el = FIVE[Math.floor(rnd() * 5)]!;
  return makeEnemy(globalRoom, isBossRoom(globalRoom), el, 'single');
}
function rewardChoices(): Die[] {
  // 简化奖励池（原型）：2 颗随机五行骰 + 1 颗 百搭/重骰。
  return [elemDie(FIVE[Math.floor(rnd() * 5)]!), elemDie(FIVE[Math.floor(rnd() * 5)]!), rnd() < 0.5 ? wildDie() : heavyDie()];
}

function startPool(): Die[] { return [plainDie(), plainDie(), plainDie(), plainDie(), plainDie()]; }

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0b1020;overflow:hidden';
  const stage = document.createElement('div');
  stage.style.cssText = 'position:relative;line-height:0';
  wrapper.appendChild(stage);
  container.appendChild(wrapper);
  const w = Math.max(320, Math.min(1100, wrapper.clientWidth || 960));
  const h = Math.max(240, Math.min(720, wrapper.clientHeight || 600));

  const assets = new AssetManager(new ModelAssetLoader());
  assets.registerManifest(GAME_D_ASSETS);
  void assets.loadAll();

  const engine = new Engine();
  engine.load(baseBlueprint());
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x0b1020, assets });
  engine.attachRenderer(renderer, stage);

  // ── 3D 房间背景：流式生成/卸载 + 相机往上 dolly（同前·当战斗背景）──
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
  const streamTo = (center: number): void => {
    for (const i of [...loaded.keys()]) if (i < center - WINDOW || i > center + WINDOW) unloadRoom(i);
    for (let i = center - WINDOW; i <= center + WINDOW; i++) loadRoom(i);
  };
  let bgRoom = 0;
  const cam = (): Camera3D | undefined => engine.world.getComponent<Camera3D>('cam', 'Camera3D');
  streamTo(0);

  // ── 战斗状态 + UI（LayoutNode·原型）──
  const S: CombatState = { pool: startPool(), hearts: SOLO_HEARTS, globalRoom: 1, enemy: newEnemy(1), phase: 'roll', rolled: [], selected: new Set(), rerolls: 1, reward: [], msg: '掷骰开始战斗' };

  const enemyCard = (): LayoutNode => {
    const e = S.enemy; const wk = weaknessOf(e.el);
    return {
      type: 'Panel', id: 'cb-enemy', props: { title: e.isBoss ? '👑 守关者' : '⚔ 敌人' }, layout: { direction: 'column', gap: 4, padding: 12, maxWidth: 420 },
      children: [
        { type: 'Label', id: 'cb-en-name', props: { text: `${elemLabel(e.el)}  ${e.name}`, size: 'lg', bold: true, glow: true } },
        { type: 'Label', id: 'cb-en-hp', props: { text: `HP ${Math.max(0, e.hp)} / ${e.maxHp}`, size: 'sm', color: 'danger' } },
        { type: 'Label', id: 'cb-en-wk', props: { text: `弱点 ${elemLabel(wk)}(×2.2) · 抗 ${elemLabel(BEATSREV(e.el))}(×0.3)`, size: 'sm', color: 'sub' } },
        { type: 'Label', id: 'cb-en-th', props: { text: '威胁：本回合没打死 → 全队 -1 ❤', size: 'xs', color: 'warn' } },
      ],
    };
  };

  const handArea = (): LayoutNode[] => {
    const out: LayoutNode[] = [];
    // HUD 行
    out.push({ type: 'Label', id: 'cb-hud', props: { text: `${'❤'.repeat(Math.max(0, S.hearts))}   第 ${roomMeta(S.globalRoom - 1).act + 1} 层 · 第 ${S.globalRoom} 间`, size: 'sm', glow: true } });
    if (S.phase === 'roll') {
      out.push({ type: 'Button', id: 'cb-roll', props: { label: '🎲 掷骰', kind: 'hero', action: 'roll' }, layout: { sheen: true } });
    } else if (S.phase === 'select') {
      // 骰子行
      out.push({
        type: 'Panel', id: 'cb-dice', props: { bare: true }, layout: { direction: 'row', gap: 6, justify: 'center' },
        children: S.rolled.map((r, i) => ({ type: 'Button', id: `cb-d${i}`, props: { label: dieLabel(r), kind: S.selected.has(i) ? 'primary' : 'ghost', action: `pick${i}` } })),
      });
      // 伤害预览
      const sel = [...S.selected].map((i) => S.rolled[i]!);
      const dmg = damageOf(sel, S.enemy.el);
      out.push({ type: 'Label', id: 'cb-prev', props: { text: sel.length ? `预计伤害 ${dmg.dmg}　(主 ${ELEM_INFO[dmg.mainEl].emoji} ×${dmg.mult} · 克制 ×${dmg.counter})` : '点选骰子组成攻击', size: 'sm', color: sel.length ? 'gold' : 'dim' } });
      out.push({
        type: 'Panel', id: 'cb-ctrl', props: { bare: true }, layout: { direction: 'row', gap: 8, justify: 'center' },
        children: [
          { type: 'Button', id: 'cb-atk', props: { label: '⚔ 攻击', kind: 'primary', action: 'attack' } },
          { type: 'Button', id: 'cb-rr', props: { label: `🎲 重掷未选 (${S.rerolls})`, kind: S.rerolls > 0 ? 'ghost' : 'quiet', action: 'reroll' } },
        ],
      });
    }
    out.push({ type: 'Label', id: 'cb-msg', props: { text: S.msg, size: 'sm', color: 'sub' } });
    return out;
  };

  const combatTree = (): LayoutNode => {
    if (S.phase === 'reward') {
      return {
        type: 'Screen', id: 'cb-scr', props: { center: true }, children: [{
          type: 'Panel', id: 'cb-rw', props: { title: '⭐ 过关！选一颗骰入库' }, layout: { direction: 'column', align: 'center', gap: 12, padding: 18, maxWidth: 520 },
          children: [
            { type: 'Label', id: 'cb-rw-t', props: { text: '命运抉择 · 三选一', size: 'lg', color: 'gold', bold: true } },
            { type: 'Panel', id: 'cb-rw-row', props: { bare: true }, layout: { direction: 'row', gap: 10, justify: 'center' }, children: S.reward.map((d, i) => ({ type: 'Button', id: `cb-rw${i}`, props: { label: `${d.faces.map((f) => ELEM_INFO[f.el].emoji).filter((e, j, a) => a.indexOf(e) === j).join('')} ${d.name}`, kind: 'primary', action: `reward${i}` } })) },
          ],
        }],
      };
    }
    if (S.phase === 'gameover' || S.phase === 'victory') {
      const win = S.phase === 'victory';
      return {
        type: 'Screen', id: 'cb-scr', props: { center: true }, children: [{
          type: 'Panel', id: 'cb-end', props: {}, layout: { direction: 'column', align: 'center', gap: 12, padding: 20, maxWidth: 460 },
          children: [
            { type: 'Label', id: 'cb-end-t', props: { text: win ? '🏆 登顶！命运由你改写' : '💀 全灭… 命运之塔吞没了你', size: 'xxl', color: win ? 'gold' : 'danger', bold: true, glow: true } },
            { type: 'Label', id: 'cb-end-s', props: { text: `走到 第 ${S.globalRoom} 间`, size: 'sm', color: 'sub' } },
            { type: 'Button', id: 'cb-again', props: { label: '↻ 再来一局', kind: 'hero', action: 'restart' }, layout: { sheen: true } },
          ],
        }],
      };
    }
    // roll / select：居中列（敌人卡 + 手牌区）
    return {
      type: 'Screen', id: 'cb-scr', props: { center: true }, children: [{
        type: 'Panel', id: 'cb-col', props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 10, padding: 14, maxWidth: 560 },
        children: [enemyCard(), ...handArea()],
      }],
    };
  };

  // 战斗 UI 宿主（覆盖·透明底·按钮可点·3D 房间透出）
  const cbHost = document.createElement('div');
  cbHost.style.cssText = 'position:absolute;inset:0;pointer-events:auto';
  wrapper.appendChild(cbHost);
  let cbUi: (() => void) | null = null;

  const advanceRoom = (): void => {
    S.globalRoom += 1;
    if (S.globalRoom > FLOORS * 3) { S.phase = 'victory'; render(); return; }
    bgRoom = S.globalRoom - 1; streamTo(bgRoom); // 3D 背景往上一间
    S.enemy = newEnemy(S.globalRoom); S.phase = 'roll'; S.rolled = []; S.selected.clear(); S.rerolls = 1; S.msg = '掷骰！';
    render();
  };

  const resolveAttack = (): void => {
    const sel = [...S.selected].map((i) => S.rolled[i]!);
    if (sel.length === 0) { S.msg = '先点选骰子'; render(); return; }
    const { dmg } = damageOf(sel, S.enemy.el);
    S.enemy.hp -= dmg;
    if (S.enemy.hp <= 0) {
      S.msg = `造成 ${dmg} 伤害 — 击败 ${S.enemy.name}！`;
      if (S.enemy.isBoss) S.hearts = Math.min(SOLO_HEARTS, S.hearts + 1);
      S.reward = rewardChoices(); S.phase = 'reward'; render(); return;
    }
    // 没打死 → 威胁
    S.hearts -= 1;
    if (S.hearts <= 0) { S.phase = 'gameover'; render(); return; }
    S.msg = `造成 ${dmg}，敌人未死 → 威胁 -1❤（剩 ${S.hearts}）`;
    S.phase = 'roll'; S.rolled = []; S.selected.clear(); S.rerolls = 1; render();
  };

  const handlers = (): Record<string, () => void> => {
    const h: Record<string, () => void> = {
      start: () => { cbHost.style.display = 'flex'; render(); },
      coop: () => { cbHost.style.display = 'flex'; render(); },
      solo: () => { cbHost.style.display = 'flex'; render(); },
      settings: () => {},
      roll: () => { S.rolled = rollPool(S.pool, rnd); S.selected.clear(); S.phase = 'select'; S.msg = '点选骰子组攻击（看预计伤害·选对克制色！）'; render(); },
      attack: resolveAttack,
      reroll: () => { if (S.rerolls <= 0) return; S.rerolls -= 1; const keep = S.selected; S.rolled = S.rolled.map((r, i) => keep.has(i) ? r : rollPool([S.pool.find((d) => d.id === r.dieId) ?? plainDie()], rnd)[0]!); render(); },
      restart: () => { S.pool = startPool(); S.hearts = SOLO_HEARTS; S.globalRoom = 1; S.enemy = newEnemy(1); S.phase = 'roll'; S.rolled = []; S.selected.clear(); S.rerolls = 1; S.msg = '掷骰开始战斗'; bgRoom = 0; streamTo(0); render(); },
    };
    S.rolled.forEach((_, i) => { h[`pick${i}`] = () => { if (S.phase !== 'select') return; if (S.selected.has(i)) S.selected.delete(i); else S.selected.add(i); render(); }; });
    S.reward.forEach((d, i) => { h[`reward${i}`] = () => { S.pool.push(d); advanceRoom(); }; });
    return h;
  };

  function render(): void { if (cbUi) cbUi(); cbUi = mountUI(cbHost, combatTree(), handlers()); }

  // ── 开场 Title（点开始揭开进战斗）──
  const titleHost = document.createElement('div');
  titleHost.style.cssText = 'position:absolute;inset:0;pointer-events:auto;z-index:5;background:radial-gradient(120% 90% at 50% 22%,#1c1640 0%,#0c0a1c 58%,#070610 100%)';
  wrapper.appendChild(titleHost);
  const titleTree: LayoutNode = {
    type: 'Screen', id: 'gd-title', props: { center: true }, children: [{
      type: 'Panel', id: 'gd-title-box', props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 14, maxWidth: 560 },
      children: [
        { type: 'Label', id: 'gd-logo', props: { text: '🎲', size: 'xxxl', glow: true } },
        { type: 'Label', id: 'gd-name', props: { text: '骰　途', size: 'xxxl', color: 'gold', bold: true } },
        { type: 'Label', id: 'gd-tsub', props: { text: '命运之塔 · TOWER OF FATE', size: 'sm', color: 'sub' } },
        { type: 'Label', id: 'gd-ttag', props: { text: '掷骰定命 · 凑对五行克制 · 一层层往上闯（可玩原型·单人）', size: 'xs', color: 'dim' } },
        { type: 'Button', id: 'gd-start', props: { label: '▶ 开始攀塔', kind: 'hero', sub: '第一层 · 翠庭', action: 'start' }, layout: { sheen: true } },
        { type: 'Label', id: 'gd-ver', props: { text: 'Apollo Engine · Game D《骰途》· 战斗原型', size: 'xs', color: 'dim' } },
      ],
    }],
  };
  const enterRun = (): void => { if (titleUi) { titleUi(); titleUi = null; } titleHost.remove(); render(); };
  let titleUi: (() => void) | null = mountUI(titleHost, titleTree, { start: enterRun, coop: enterRun, solo: enterRun, settings: () => {} });

  // 相机每帧 dolly 到当前背景房间
  const unsub = engine.subscribe(() => { const c = cam(); if (!c) return; const t = bgRoom * ROOM_SPACING; const cur = c.pivotZ ?? 0; c.pivotZ = Math.abs(t - cur) < 0.05 ? t : cur + (t - cur) * 0.12; });
  engine.start();

  return () => {
    unsub(); engine.stop(); renderer.destroy();
    if (cbUi) cbUi(); if (titleUi) titleUi(); cbHost.remove(); titleHost.remove(); wrapper.remove();
  };
}

// 敌人「抗性」元素（克它的反方向：谁被敌人克）= 对它 ×0.3。
function BEATSREV(enemyEl: Elem): Elem { const m: Record<string, Elem> = { jin: 'mu', mu: 'tu', tu: 'shui', shui: 'huo', huo: 'jin' }; return m[enemyEl] ?? 'none'; }
