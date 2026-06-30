// Game D ·《骰途》挂载 —— 单人骰斗可玩原型 v2（HP+挑战门槛+反制 统一模型）+ 3D 房间背景 + 开场 Title。
//
// ⚠️ 原型（owner 2026-06-29「先做出能玩的·我看一眼」）：战斗逻辑暂在游戏层（combat.ts 纯函数）·UI 走 LayoutNode·
// 骰用彩色 emoji token·3D 房间当背景。上线版迁数据驱动(M0+主程)。设计见 docs/design/game-d/combat-design.md §12。
// 每回合：掷骰（反制禁用高低）→ 选骰/重掷 → 提交：满足门槛=命中扣敌HP(=本手点数和)·HP归零即胜；不满足=吃威胁扣心。
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
  ELEM_INFO, FIVE, plainDie, elemDie, heavyDie, wildDie, rollPool, makeFoe, counterDisabled, evalChallenge, damageOf,
  type Die, type RolledDie, type Foe,
} from './combat.js';

const SOLO_HEARTS = 6;
const FLOORS = 4;
const REROLLS = 2;
const WINDOW = 1;
const rnd = (): number => Math.random();

interface CombatState {
  pool: Die[]; hearts: number; globalRoom: number; foe: Foe;
  phase: 'roll' | 'select' | 'reward' | 'gameover' | 'victory';
  rolled: RolledDie[]; disabled: Set<number>; selected: Set<number>; rerolls: number; reward: Die[]; msg: string;
}

const dieLabel = (r: RolledDie): string => `${ELEM_INFO[r.el].emoji}${r.v}`;
const newFoe = (g: number): Foe => makeFoe(g, (g - 1) % 3);
const startPool = (): Die[] => [plainDie(), plainDie(), plainDie(), plainDie(), plainDie()];
function rewardChoices(): Die[] { return [elemDie(FIVE[Math.floor(rnd() * 5)]!), elemDie(FIVE[Math.floor(rnd() * 5)]!), rnd() < 0.5 ? wildDie() : heavyDie()]; }

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
  streamTo(0);

  const S: CombatState = { pool: startPool(), hearts: SOLO_HEARTS, globalRoom: 1, foe: newFoe(1), phase: 'roll', rolled: [], disabled: new Set(), selected: new Set(), rerolls: REROLLS, reward: [], msg: '掷骰，凑出满足要求的一手' };

  const foeCard = (): LayoutNode => {
    const f = S.foe;
    const sel = [...S.selected].map((i) => S.rolled[i]!);
    const ev = evalChallenge(sel, f.conds);
    return {
      type: 'Panel', id: 'cb-foe', props: { title: `${f.isBoss ? '👑 守关者' : '⚔ 敌人'} · ${f.kindLabel}` }, layout: { direction: 'column', gap: 4, padding: 12, maxWidth: 460 },
      children: [
        { type: 'Label', id: 'cb-f-name', props: { text: `${ELEM_INFO[f.el].emoji} ${f.name}`, size: 'lg', bold: true, glow: true } },
        { type: 'Label', id: 'cb-f-hp', props: { text: `HP ${Math.max(0, f.hp)} / ${f.maxHp}　(命中扣 = 本手点数和)`, size: 'sm', color: 'danger' } },
        // 门槛条件（live ✓/✗ 跟随当前选择）
        { type: 'Label', id: 'cb-f-req', props: { text: '过关门槛（满足才命中）：', size: 'xs', color: 'sub' } },
        ...ev.results.map((r, i): LayoutNode => ({ type: 'Label', id: `cb-f-c${i}`, props: { text: `${r.ok ? '✅' : '⬜'} ${r.label}`, size: 'sm', color: r.ok ? 'ok' : 'sub' } })),
        ...(f.counter.kind !== 'none' ? [{ type: 'Label', id: 'cb-f-ctr', props: { text: `🚫 反制：${f.counter.label}`, size: 'xs', color: 'warn' } } as LayoutNode] : []),
      ],
    };
  };

  const handArea = (): LayoutNode[] => {
    const out: LayoutNode[] = [];
    out.push({ type: 'Label', id: 'cb-hud', props: { text: `${'❤'.repeat(Math.max(0, S.hearts))}   第 ${roomMeta(S.globalRoom - 1).act + 1} 层 · 第 ${S.globalRoom} 间`, size: 'sm', glow: true } });
    if (S.phase === 'roll') {
      out.push({ type: 'Button', id: 'cb-roll', props: { label: '🎲 掷骰', kind: 'hero', action: 'roll' }, layout: { sheen: true } });
    } else if (S.phase === 'select') {
      out.push({
        type: 'Panel', id: 'cb-dice', props: { bare: true }, layout: { direction: 'row', gap: 6, justify: 'center' },
        children: S.rolled.map((r, i) => S.disabled.has(i)
          ? { type: 'Button', id: `cb-d${i}`, props: { label: `🚫${dieLabel(r)}`, kind: 'quiet', action: `dis${i}` } }
          : { type: 'Button', id: `cb-d${i}`, props: { label: dieLabel(r), kind: S.selected.has(i) ? 'primary' : 'ghost', action: `pick${i}` } }),
      });
      const sel = [...S.selected].map((i) => S.rolled[i]!);
      const ev = evalChallenge(sel, S.foe.conds);
      const d = damageOf(sel);
      out.push({ type: 'Label', id: 'cb-prev', props: { text: sel.length ? `总和 ${d.sum} · 牌型 ${d.pat.name} ×${d.pat.mult}${ev.met ? ` → 命中扣 ${d.dmg} HP ✅` : ' · ⬜未达门槛'}` : '点选骰子组一手（🚫=被反制禁用·凑牌型翻倍伤害）', size: 'sm', color: ev.met ? 'ok' : (sel.length ? 'warn' : 'dim') } });
      out.push({
        type: 'Panel', id: 'cb-ctrl', props: { bare: true }, layout: { direction: 'row', gap: 8, justify: 'center' },
        children: [
          { type: 'Button', id: 'cb-sub', props: { label: '✔ 提交一手', kind: 'primary', action: 'submit' } },
          { type: 'Button', id: 'cb-rr', props: { label: `🎲 重掷未选 (${S.rerolls})`, kind: S.rerolls > 0 ? 'ghost' : 'quiet', action: 'reroll' } },
        ],
      });
    }
    out.push({ type: 'Label', id: 'cb-msg', props: { text: S.msg, size: 'sm', color: 'sub' } });
    return out;
  };

  const combatTree = (): LayoutNode => {
    if (S.phase === 'reward') {
      return { type: 'Screen', id: 'cb-scr', props: { center: true }, children: [{
        type: 'Panel', id: 'cb-rw', props: { title: '⭐ 过关！选一颗骰入库' }, layout: { direction: 'column', align: 'center', gap: 12, padding: 18, maxWidth: 520 },
        children: [
          { type: 'Label', id: 'cb-rw-t', props: { text: '命运抉择 · 三选一', size: 'lg', color: 'gold', bold: true } },
          { type: 'Panel', id: 'cb-rw-row', props: { bare: true }, layout: { direction: 'row', gap: 10, justify: 'center' }, children: S.reward.map((d, i) => ({ type: 'Button', id: `cb-rw${i}`, props: { label: `${d.faces.map((f) => ELEM_INFO[f.el].emoji).filter((e, j, a) => a.indexOf(e) === j).join('')} ${d.name}`, kind: 'primary', action: `reward${i}` } })) },
        ],
      }] };
    }
    if (S.phase === 'gameover' || S.phase === 'victory') {
      const win = S.phase === 'victory';
      return { type: 'Screen', id: 'cb-scr', props: { center: true }, children: [{
        type: 'Panel', id: 'cb-end', props: {}, layout: { direction: 'column', align: 'center', gap: 12, padding: 20, maxWidth: 460 },
        children: [
          { type: 'Label', id: 'cb-end-t', props: { text: win ? '🏆 登顶！命运由你改写' : '💀 全灭… 命运之塔吞没了你', size: 'xxl', color: win ? 'gold' : 'danger', bold: true, glow: true } },
          { type: 'Label', id: 'cb-end-s', props: { text: `走到 第 ${S.globalRoom} 间`, size: 'sm', color: 'sub' } },
          { type: 'Button', id: 'cb-again', props: { label: '↻ 再来一局', kind: 'hero', action: 'restart' }, layout: { sheen: true } },
        ],
      }] };
    }
    return { type: 'Screen', id: 'cb-scr', props: { center: true }, children: [{
      type: 'Panel', id: 'cb-col', props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 10, padding: 14, maxWidth: 560 },
      children: [foeCard(), ...handArea()],
    }] };
  };

  const cbHost = document.createElement('div');
  cbHost.style.cssText = 'position:absolute;inset:0;pointer-events:auto';
  wrapper.appendChild(cbHost);
  let cbUi: (() => void) | null = null;

  const advanceRoom = (): void => {
    S.globalRoom += 1;
    if (S.globalRoom > FLOORS * 3) { S.phase = 'victory'; render(); return; }
    bgRoom = S.globalRoom - 1; streamTo(bgRoom);
    S.foe = newFoe(S.globalRoom); S.phase = 'roll'; S.rolled = []; S.selected.clear(); S.disabled.clear(); S.rerolls = REROLLS; S.msg = '掷骰！';
    render();
  };

  const doSubmit = (): void => {
    const sel = [...S.selected].map((i) => S.rolled[i]!);
    const ev = evalChallenge(sel, S.foe.conds);
    if (ev.met) {
      const d = damageOf(sel);
      S.foe.hp -= d.dmg;
      if (S.foe.hp <= 0) {
        if (S.foe.isBoss) S.hearts = Math.min(SOLO_HEARTS, S.hearts + 1);
        S.reward = rewardChoices(); S.phase = 'reward'; render(); return;
      }
      S.msg = `命中！${d.pat.name}×${d.pat.mult} 扣 ${d.dmg}，敌 HP 剩 ${S.foe.hp}。再来一手`;
      S.phase = 'roll'; S.rolled = []; S.selected.clear(); S.disabled.clear(); S.rerolls = REROLLS; render(); return;
    }
    // 未满足门槛 → 威胁
    S.hearts -= 1;
    if (S.hearts <= 0) { S.phase = 'gameover'; render(); return; }
    S.msg = `未达门槛 → 威胁 -1❤（剩 ${S.hearts}）`;
    S.phase = 'roll'; S.rolled = []; S.selected.clear(); S.disabled.clear(); S.rerolls = REROLLS; render();
  };

  const doRoll = (): void => {
    S.rolled = rollPool(S.pool, rnd);
    S.disabled = counterDisabled(S.rolled, S.foe.counter);
    S.selected.clear(); S.rerolls = REROLLS; S.phase = 'select';
    S.msg = S.disabled.size ? '反制禁用了你最高+最低（🚫）·从其余里凑一手' : '点选骰子凑一手满足门槛';
    render();
  };

  const handlers = (): Record<string, () => void> => {
    const h: Record<string, () => void> = {
      start: () => render(), coop: () => render(), solo: () => render(), settings: () => {},
      roll: doRoll, submit: doSubmit,
      reroll: () => {
        if (S.rerolls <= 0) return; S.rerolls -= 1;
        S.rolled = S.rolled.map((r, i) => (S.selected.has(i) || S.disabled.has(i)) ? r : rollPool([S.pool.find((d) => d.id === r.dieId) ?? plainDie()], rnd)[0]!);
        S.disabled = counterDisabled(S.rolled, S.foe.counter);
        for (const i of [...S.selected]) if (S.disabled.has(i)) S.selected.delete(i);
        render();
      },
      restart: () => { S.pool = startPool(); S.hearts = SOLO_HEARTS; S.globalRoom = 1; S.foe = newFoe(1); S.phase = 'roll'; S.rolled = []; S.selected.clear(); S.disabled.clear(); S.rerolls = REROLLS; S.msg = '掷骰开始'; bgRoom = 0; streamTo(0); render(); },
    };
    S.rolled.forEach((_, i) => { h[`pick${i}`] = () => { if (S.phase !== 'select' || S.disabled.has(i)) return; if (S.selected.has(i)) S.selected.delete(i); else S.selected.add(i); render(); }; h[`dis${i}`] = () => {}; });
    S.reward.forEach((d, i) => { h[`reward${i}`] = () => { S.pool.push(d); advanceRoom(); }; });
    return h;
  };

  function render(): void { if (cbUi) cbUi(); cbUi = mountUI(cbHost, combatTree(), handlers()); }

  // 开场 Title
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
        { type: 'Label', id: 'gd-ttag', props: { text: '掷骰凑满要求 · HP+门槛+反制 · 一层层往上闯（可玩原型·单人）', size: 'xs', color: 'dim' } },
        { type: 'Button', id: 'gd-start', props: { label: '▶ 开始攀塔', kind: 'hero', sub: '第一层 · 翠庭', action: 'start' }, layout: { sheen: true } },
        { type: 'Label', id: 'gd-ver', props: { text: 'Apollo Engine · Game D《骰途》· 战斗原型 v2', size: 'xs', color: 'dim' } },
      ],
    }],
  };
  const enterRun = (): void => { if (titleUi) { titleUi(); titleUi = null; } titleHost.remove(); render(); };
  let titleUi: (() => void) | null = mountUI(titleHost, titleTree, { start: enterRun, coop: enterRun, solo: enterRun, settings: () => {} });

  const unsub = engine.subscribe(() => { const c = cam(); if (!c) return; const t = bgRoom * ROOM_SPACING; const cur = c.pivotZ ?? 0; c.pivotZ = Math.abs(t - cur) < 0.05 ? t : cur + (t - cur) * 0.12; });
  engine.start();

  return () => {
    unsub(); engine.stop(); renderer.destroy();
    if (cbUi) cbUi(); if (titleUi) titleUi(); cbHost.remove(); titleHost.remove(); wrapper.remove();
  };
}
