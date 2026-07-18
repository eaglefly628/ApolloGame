// Game B ·《雀宴》—— 对局可玩 UI（LayoutNode·从 MatchState 投影·真牌局交互层）。
// 架构（owner 2026-07-18「连个正常人都没法开始·分不清谁在打」根因修正）：
//   3D=纯氛围舞台（blueprint.ts）；**真牌局全在这层 2D HUD**——自家手牌=屏幕底部一大排**真牌面**
//   （Button.skin 贴占位牌面 PNG·点一张=打一张·不再是「打牌列表菜单」那种怪按钮）；四家牌河=牌面
//   小牌摊在桌心四方（弃谁的牌就落谁门前）；宝牌/供托/结算/脱衣 全可见。对标 game-c「3D 房 + 2D 牌」。
// UI 铁律：全 LayoutNode 闭集·写世界只走 action 信号（点手牌→play-tile·自摸→act-tsumo…）。
import type { LayoutNode } from '@ui/components/index.js';
import type { MatchState } from './core/game-state.js';
import { canTsumo, canRiichi, labelTile, seatWind, isWinLikeEnd, isPlayerTurn, isPlayerCallWindow, CLOTH_LABELS, STRIP_ITEMS } from './core/game-state.js';
import { kindStr, isRed, kindOf } from './core/tiles-def.js';
import type { Meld } from './core/meld.js';
import type { ChiCandidate } from './core/calls.js';
import { doraFromIndicator } from './core/wall.js';
import { FIELD_W, FIELD_H } from './theme.js';

export const PLAY_TILE = 'play-tile'; // arg=手牌位 key（'0'..'12' 暗手位 / 'd' 摸牌）·两步：先选中再打出
export const ACT_TSUMO = 'act-tsumo';
export const ACT_RIICHI = 'act-riichi';
export const NEXT_ROUND = 'next-round';
export const TOGGLE_LOG = 'toggle-log';
export const BACK_MENU = 'back-menu';
export const COPY_LOG = 'copy-log'; // 复制完整日志到剪贴板（查 bug·贴给 owner）
// 鸣牌窗口按钮（P4·owner 点名「先上鸣牌」·玩家可碰/吃/荣/过）。
export const CALL_PON = 'call-pon';
export const CALL_CHI = 'call-chi'; // arg=搭子候选 index
export const CALL_RON = 'call-ron';
export const CALL_PASS = 'call-pass';

// ── 牌面占位贴图（B-007 FluffyStuff CC0·600×800 象牙牌·赤5 带 -red）─────────────────────
const ART = '/games/game-b/art/mahjong';
/** 牌码 → 牌面 PNG URL（view 层解析·sim 只持整数牌码·纯度不破）。 */
function faceUrl(code: number): string {
  const base = isRed(code) ? `${kindStr(code)}-red` : kindStr(code);
  return `${ART}/${base}.png`;
}

const WIND = ['東', '南', '西', '北'];
// 牌尺寸（px）：自家手牌大、场牌小。
const HW = 44, HH = 60; // 手牌
const RW = 23, RH = 31; // 牌河
const DW = 26, DH = 35; // 宝牌

// 席位卡屏幕位（seat 0=玩家南·下；1=东·右；2=北·上；3=西·左·出牌 0→1→2→3 逆时针）。
const SEAT_POS: Array<{ x: number; y: number }> = [
  { x: 12, y: FIELD_H - 200 },              // 0 南（玩家·左下·抬高避让底部手牌排）
  { x: FIELD_W - 184, y: 250 },             // 1 东（右）
  { x: FIELD_W / 2 - 86, y: 12 },           // 2 北（上·对家）
  { x: 12, y: 250 },                        // 3 西（左）
];
// 席位卡暗底（不透明兜底·ui-playbook §3：文字对比不靠 3D 背景·任何底都读得清）。
// 暗梅底 + 樱粉/金亮字（同场况角标·game-a 先例：暗牌桌上暗卡亮字比浅纸贴片更融·且高对比）。
const CARD_BG = { custom: 'rgba(34,22,36,0.9)' };
// 牌河屏幕位（各家门前·围桌心 cx≈560 cy≈310）。
const RIVER_POS: Array<{ x: number; y: number }> = [
  { x: FIELD_W / 2 - (RW * 6 + 10) / 2, y: 356 }, // 0 南（桌心下·玩家门前）
  { x: 704, y: 214 },                              // 1 东（右）
  { x: FIELD_W / 2 - (RW * 6 + 10) / 2, y: 100 }, // 2 北（上）
  { x: 330, y: 214 },                              // 3 西（左）
];

// ── 副露展示（吃/碰露出的面子·各家门前·naki-design §8）───────────────────────────────────
// 牌尺寸/位（玩家=大看得清；他家=小）。右侧两家（0/1）右锚防溢出；左/上家左锚。
const MELD_TILE: Array<{ w: number; h: number }> = [
  { w: 26, h: 34 }, { w: 18, h: 24 }, { w: 18, h: 24 }, { w: 18, h: 24 },
];
const MELD_POS: Array<{ x: number; y: number }> = [
  { x: 0, y: FIELD_H - 42 },        // 0 玩家（桌底·手牌上方·右锚）
  { x: 0, y: 344 },                 // 1 东（右·席卡下·右锚）
  { x: 700, y: 40 },                // 2 北（上·席卡右·左锚·避让北席卡）
  { x: 12, y: 344 },                // 3 西（左·席卡下·左锚）
];
/** 一组副露的像素宽（tiles×w + 内隙 + 副露间隙 + padding）。 */
function meldRowWidth(melds: Meld[], w: number): number {
  let total = 8; // padding 两侧
  melds.forEach((md, i) => { total += md.tiles.length * w + (md.tiles.length - 1) + (i > 0 ? 6 : 0); });
  return total;
}
/** 某家副露块（无副露→null）；每副露=牌面小牌簇（横摆示意·被鸣牌 called 带暗记）。 */
function meldBlock(m: MatchState, seat: number): LayoutNode | null {
  const melds = m.cur.melds[seat]!;
  if (melds.length === 0) return null;
  const { w, h } = MELD_TILE[seat]!;
  const pos = MELD_POS[seat]!;
  const rightAnchor = seat === 0 || seat === 1;
  const x = rightAnchor ? FIELD_W - 12 - meldRowWidth(melds, w) : pos.x;
  return {
    type: 'Panel', id: `melds-${seat}`, props: { bg: { custom: 'rgba(20,10,20,0.55)' } },
    layout: { x, y: pos.y, direction: 'row', gap: 6, padding: 4, align: 'center' },
    children: melds.map((md, i): LayoutNode => ({
      type: 'Panel', id: `meld-${seat}-${i}`, props: { bare: true }, layout: { direction: 'row', gap: 1, align: 'center' },
      children: md.tiles.map((c, j): LayoutNode => ({
        type: 'Image', id: `meld-${seat}-${i}-${j}`,
        props: { src: faceUrl(c), fit: 'contain' },
        layout: { width: w, height: h, opacity: c === md.called && md.from !== seat ? 0.72 : 1 }, // 被鸣的那张压暗示意
      })),
    })),
  };
}

// ── 席位卡（名/风/点/立直/衣物章·当前家高亮）───────────────────────────────────────────
function seatCard(m: MatchState, seat: number): LayoutNode {
  const active = m.cur.turn === seat && m.cur.phase === 'playing';
  const wind = WIND[seatWind(seat, m.dealer)];
  const isDealer = seat === m.dealer;
  const riichi = m.cur.riichi[seat];
  const p = SEAT_POS[seat]!;
  return {
    type: 'Panel', id: `seat-${seat}`, props: { accent: active, glow: active, bg: CARD_BG },
    layout: { x: p.x, y: p.y, width: 172, padding: 8, gap: 5, direction: 'column' },
    children: [
      {
        type: 'Panel', id: `seat-${seat}-r`, props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          { type: 'Avatar', id: `seat-${seat}-av`, props: { name: m.seatNames[seat]!.slice(-1), size: 34, shape: 'circle' } },
          {
            type: 'Panel', id: `seat-${seat}-nm`, props: { bare: true }, layout: { direction: 'column', gap: 1, flex: 1 },
            children: [
              { type: 'Label', id: `seat-${seat}-name`, props: { text: `${m.seatNames[seat]}${isDealer ? '·庄' : ''}`, size: 'sm', bold: true, color: 'jade' } },
              { type: 'Label', id: `seat-${seat}-pts`, props: { text: m.scores[seat]!.toLocaleString('en-US'), size: 'md', bold: true, color: 'gold' } },
            ],
          },
          { type: 'Tag', id: `seat-${seat}-w`, props: { label: wind!, tone: active ? 'accent' : 'normal', size: 'sm' } },
        ],
      },
      // 状态行：当前家「▶ 打牌中」/ 立直标
      ...(active || riichi ? [{
        type: 'Panel' as const, id: `seat-${seat}-st`, props: { bare: true }, layout: { direction: 'row' as const, gap: 4 },
        children: [
          ...(active ? [{ type: 'Tag' as const, id: `seat-${seat}-turn`, props: { label: seat === 0 ? '▶ 你的回合' : '▶ 打牌中', tone: 'accent' as const, size: 'sm' as const } }] : []),
          ...(riichi ? [{ type: 'Tag' as const, id: `seat-${seat}-ri`, props: { label: '● 立直', tone: 'accent' as const, size: 'sm' as const } }] : []),
        ],
      }] : []),
      // 衣物章行（gdd §七直击脱衣·剩余亮/脱掉熄灭·主角满且豁免）
      {
        type: 'Panel', id: `seat-${seat}-cloth`, props: { bare: true }, layout: { direction: 'row', gap: 3 },
        children: CLOTH_LABELS.map((lab, i): LayoutNode => {
          const on = i < m.clothing[seat]!;
          return { type: 'Tag', id: `seat-${seat}-cl${i}`, props: { label: lab, size: 'sm', tone: on ? 'normal' : 'dim', active: on } };
        }),
      },
    ],
  };
}

// ── 各家牌河（弃牌落门前·牌面小牌·6 列换行·最近弃牌高亮）───────────────────────────────
function riverBlock(m: MatchState, seat: number): LayoutNode {
  const river = m.cur.rivers[seat]!;
  const show = river.slice(-18); // 最近 18 张（3 行×6）
  const p = RIVER_POS[seat]!;
  const rows: LayoutNode[] = [];
  for (let r = 0; r < Math.ceil(show.length / 6); r++) {
    const slice = show.slice(r * 6, r * 6 + 6);
    rows.push({
      type: 'Panel', id: `river-${seat}-row${r}`, props: { bare: true }, layout: { direction: 'row', gap: 2 },
      children: slice.map((c, i): LayoutNode => ({
        type: 'Image', id: `river-${seat}-${r * 6 + i}`, props: { src: faceUrl(c), fit: 'contain' }, layout: { width: RW, height: RH },
      })),
    });
  }
  return {
    type: 'Panel', id: `river-${seat}`,
    props: show.length ? { bg: { custom: 'rgba(18,10,18,0.40)' } } : { bare: true }, // 有弃牌才铺暗垫（空河不留空盒）
    layout: { x: p.x, y: p.y, direction: 'column', gap: 2, padding: show.length ? 4 : 0 },
    children: rows,
  };
}

// ── 自家手牌（底部一大排·真牌面·**两步打牌**：点一张=选中站起 → 再点=打出·立直后锁摸切）───────
// 摸牌只在**轮到玩家**时显示（否则显示的是当前 AI 的摸牌=串台·owner 目击 bug）。绝对定位排布→
// 选中张 y 抬高「站起来」+ 余张压暗，避让 flex 做不出的抬升；返回节点数组直接铺进 play-root。
function playerHand(m: MatchState, selectedKey: string | null): LayoutNode[] {
  const rs = m.cur;
  const hand = rs.hands[0]!; // 13 张暗手（升序）
  const canPlay = isPlayerTurn(m);
  const locked = rs.riichi[0]; // 立直后只能摸切（打 drawn）
  const showDrawn = rs.drawn !== null && rs.turn === 0; // ★只有轮到玩家才显示自家摸牌
  const step = HW + 4;
  const drawnGap = 22;
  const n = hand.length;
  const totalW = n * step - 4 + (showDrawn ? drawnGap + HW : 0);
  const x0 = Math.round((FIELD_W - totalW) / 2);
  const BASE_Y = FIELD_H - HH - 4;
  const RAISE = 18;
  const dimOthers = selectedKey != null && canPlay && !locked;
  const forbid = (c: number): boolean => rs.forbiddenDiscard.includes(kindOf(c)); // 喰い替え禁打（鸣牌后本巡·R-2）
  const mkTile = (c: number, key: string, x: number, disabled: boolean): LayoutNode => {
    const sel = selectedKey === key && !disabled;
    const kuikaeDim = canPlay && forbid(c); // 喰い替え禁牌·压暗提示
    const op = kuikaeDim ? 0.4 : dimOthers && !sel ? 0.68 : 1;
    return {
      type: 'Button', id: `h-${key}`,
      props: { label: '', skin: faceUrl(c), kind: sel ? 'primary' : 'ghost', disabled, action: PLAY_TILE, actionArg: key },
      layout: { x, y: sel ? BASE_Y - RAISE : BASE_Y, width: HW, height: HH, opacity: op },
    };
  };
  const out: LayoutNode[] = hand.map((c, i) => mkTile(c, String(i), x0 + i * step, !canPlay || locked || forbid(c)));
  if (showDrawn) out.push(mkTile(rs.drawn!, 'd', x0 + n * step + drawnGap - 4, !canPlay)); // 摸牌离一档
  return out;
}

// ── 场况角标（局/本场/供托/余牌 + 宝牌真牌面）─────────────────────────────────────────────
function centerInfo(m: MatchState): LayoutNode {
  const doraTiles: LayoutNode[] = m.cur.doraInd.map((d, i): LayoutNode => ({
    type: 'Image', id: `dora-${i}`, props: { src: faceUrl(doraFromIndicator(d)), fit: 'contain' }, layout: { width: DW, height: DH },
  }));
  return {
    type: 'Panel', id: 'info', props: { bg: { custom: 'rgba(28,18,28,0.78)' }, dashed: true },
    layout: { x: 12, y: 12, padding: 9, gap: 6, direction: 'column' },
    children: [
      { type: 'Label', id: 'info-l', props: { text: `東${m.roundNo}局 · ${m.honba}本場`, size: 'md', bold: true, color: 'gold', font: 'serif' } },
      { type: 'Label', id: 'info-w', props: { text: `供托 ${m.kyotaku / 1000} · 余牌 ${m.cur.wall.length}`, size: 'sm', color: 'jade' } },
      {
        type: 'Panel', id: 'info-dora', props: { bare: true }, layout: { direction: 'row', gap: 5, align: 'center' },
        children: [{ type: 'Label', id: 'info-dl', props: { text: '宝牌', size: 'sm', color: 'sub' } }, ...doraTiles],
      },
    ],
  };
}

// ── 行动按钮排（自摸/立直 可用才亮·日志/菜单常驻）────────────────────────────────────────
function actionBar(m: MatchState): LayoutNode {
  return {
    type: 'Panel', id: 'acts', props: { bare: true },
    layout: { x: FIELD_W - 250, y: 12, direction: 'row', gap: 8 },
    children: [
      { type: 'Button', id: 'act-tsumo', props: { label: '自摸', kind: 'hero', disabled: !canTsumo(m), action: ACT_TSUMO } },
      { type: 'Button', id: 'act-riichi', props: { label: '立直', kind: 'primary', disabled: !canRiichi(m), action: ACT_RIICHI } },
      { type: 'Button', id: 'act-log', props: { label: '📜', kind: 'quiet', action: TOGGLE_LOG } },
      { type: 'Button', id: 'act-menu', props: { label: '☰', kind: 'quiet', action: BACK_MENU } },
    ],
  };
}

// ── 鸣牌窗口按钮条（有人打出可鸣牌·亮碰/吃/荣/过·owner 点名先上鸣牌）────────────────────
/** 吃搭子 → 顺子标签（如 "234萬"）。 */
function chiLabel(c: ChiCandidate, tile: number): string {
  const kinds = [c.consume[0], c.consume[1], kindOf(tile)].sort((a, b) => a - b);
  const nums = kinds.map((k) => (k % 9) + 1).join('');
  const suit = ['萬', '筒', '索'][Math.floor(kinds[0]! / 9)];
  return `${nums}${suit}`;
}
/** 鸣牌行动条（仅玩家有待鸣窗口时）；否则 null。 */
function callBar(m: MatchState): LayoutNode | null {
  const cw = m.cur.callWindow;
  if (!cw) return null;
  const o = cw.options;
  const btns: LayoutNode[] = [
    { type: 'Label', id: 'call-hint', props: { text: `${m.seatNames[cw.discarder]} 打【${labelTile(cw.tile)}】`, size: 'sm', bold: true, color: 'gold' } },
  ];
  if (o.ron) btns.push({ type: 'Button', id: 'call-ron', props: { label: '🀄 荣和', kind: 'primary', action: CALL_RON } });
  if (o.pon) btns.push({ type: 'Button', id: 'call-pon', props: { label: '碰', kind: 'primary', action: CALL_PON } });
  o.chi.forEach((c, i) => btns.push({ type: 'Button', id: `call-chi-${i}`, props: { label: `吃 ${chiLabel(c, cw.tile)}`, kind: 'primary', action: CALL_CHI, actionArg: String(i) } }));
  btns.push({ type: 'Button', id: 'call-pass', props: { label: '过', kind: 'quiet', action: CALL_PASS } });
  return {
    type: 'Panel', id: 'callbar', props: { bg: { custom: 'rgba(32,16,28,0.97)' }, glow: true, accent: true },
    layout: { x: FIELD_W / 2 - 230, y: FIELD_H - HH - 82, width: 460, padding: 8, gap: 9, direction: 'row', justify: 'center', align: 'center' },
    children: btns,
  };
}

// ── 字幕条（轮到谁·思考中·结果播报）────────────────────────────────────────────────────
function subtitle(m: MatchState, selectedKey: string | null): LayoutNode {
  const yourTurn = m.cur.turn === 0 && m.cur.phase === 'playing' && m.cur.callWindow === null;
  let txt: string;
  if (isPlayerCallWindow(m)) {
    txt = '⚡ 可以鸣牌！ —— 选 碰 / 吃 / 荣 或「过」';
  } else if (m.cur.phase !== 'playing') {
    txt = m.log.all().slice(-1)[0]?.text ?? '';
  } else if (yourTurn) {
    txt = canTsumo(m) ? '★ 可以自摸和了！（或点牌选中 → 再点打出）'
      : selectedKey != null ? '已选中 —— 再点一次打出（点别张可改选）'
      : '轮到你 —— 点一张牌选中';
  } else {
    // AI 回合：报「上家打了啥 + 现在轮到谁」（节奏可跟·owner「找不到北/太快」）
    const lastDisc = [...m.log.all()].reverse().find((e) => e.kind === 'discard' && e.tile != null);
    const cur = m.seatNames[m.cur.turn];
    txt = lastDisc ? `${lastDisc.actor} 打【${labelTile(lastDisc.tile!)}】　▸ 轮到 ${cur}` : `▸ 轮到 ${cur}`;
  }
  return {
    type: 'Panel', id: 'sub', props: { bg: { custom: 'rgba(22,14,22,0.9)' } },
    layout: { x: FIELD_W / 2 - 235, y: FIELD_H - HH - 52, width: 470, padding: 8, align: 'center' },
    children: [{ type: 'Label', id: 'sub-l', props: { text: txt, size: 'md', bold: true, color: yourTurn ? 'gold' : 'jade' } }],
  };
}

function logPanel(m: MatchState, logCopied: boolean): LayoutNode {
  const evs = m.log.recent(24); // 面板扫近 24 条（跨局累计·完整靠复制钮）
  return {
    type: 'Panel', id: 'logpanel', props: { bg: { custom: 'rgba(18,12,20,0.97)' }, title: '游戏日志 · 跨局累计（查 bug）' },
    layout: { x: FIELD_W - 392, y: 52, width: 376, height: FIELD_H - 104, padding: 10, gap: 3, direction: 'column' },
    children: [
      { type: 'Button', id: 'log-copy', props: { label: logCopied ? '✓ 已复制 —— 粘贴给我即可' : `📋 复制完整日志（${m.log.size()} 条·全部局）`, kind: logCopied ? 'quiet' : 'primary', action: COPY_LOG } },
      ...evs.map((e, i): LayoutNode => ({
        type: 'Label', id: `log-${i}`,
        props: { text: `[${e.round}] ${e.actor}·${e.text}`, size: 'xs', color: e.kind === 'tsumo' || e.kind === 'ron' ? 'gold' : e.kind === 'score' ? 'danger' : e.kind === 'draw' || e.kind === 'discard' ? 'sub' : 'jade' },
      })),
    ],
  };
}

// ── 结算浮层（和了/流局·点移·脱衣汇总·和了手真牌面）──────────────────────────────────────
function resultOverlay(m: MatchState): LayoutNode {
  const r = m.cur.result!;
  const title = r.type === 'draw' ? '荒牌流局' : (r.type === 'tsumo' ? `${m.seatNames[r.winner!]} 自摸和了` : `${m.seatNames[r.winner!]} 荣和`);
  const rows: LayoutNode[] = [
    { type: 'Label', id: 'res-t', props: { text: title, size: 'xl', bold: true, color: 'gold', font: 'serif' } },
  ];
  // 和了手真牌面
  if (r.type !== 'draw' && r.handSnapshot) {
    rows.push({
      type: 'Panel', id: 'res-hand', props: { bare: true }, layout: { direction: 'row', gap: 2, justify: 'center' },
      children: r.handSnapshot.map((c, i): LayoutNode => ({
        type: 'Image', id: `res-h-${i}`, props: { src: faceUrl(c), fit: 'contain' }, layout: { width: 30, height: 40 },
      })),
    });
    rows.push({ type: 'Label', id: 'res-w', props: { text: `和了牌 ${labelTile(r.winTile!)}${r.loser !== null ? `（放铳 ${m.seatNames[r.loser]}）` : '（自摸）'}`, size: 'sm', color: 'sub' } });
  }
  // 本局脱衣汇总（直击制·gdd §七）
  const stripSum = (r.stripped ?? []).map((n, i) => (n > 0 ? `${m.seatNames[i]} 脱${n}（余 ${m.clothing[i]}/${STRIP_ITEMS}）` : null)).filter(Boolean);
  if (stripSum.length) rows.push({ type: 'Label', id: 'res-strip', props: { text: `直击脱衣 · ${stripSum.join('　')}`, size: 'sm', color: 'danger' } });
  rows.push({
    type: 'Panel', id: 'res-delta', props: { bare: true }, layout: { direction: 'column', gap: 2 },
    children: r.delta.map((d, i): LayoutNode => ({ type: 'Label', id: `res-d-${i}`, props: { text: `${m.seatNames[i]}　${d >= 0 ? '+' : ''}${d}　→ ${m.scores[i]!.toLocaleString('en-US')}`, size: 'sm', color: d > 0 ? 'ok' : d < 0 ? 'danger' : 'sub' } })),
  });
  rows.push({ type: 'Button', id: 'res-next', props: { label: m.over ? '返回主菜单' : '下一局 ▸', kind: 'hero', action: m.over ? BACK_MENU : NEXT_ROUND } });
  return {
    type: 'Modal', id: 'result', props: { title: m.over ? '终局' : '本局结算', closable: false },
    children: [{ type: 'Panel', id: 'res-body', props: { bare: true }, layout: { direction: 'column', gap: 10, align: 'center', padding: 6 }, children: rows }],
  };
}

export interface PlayHudOpts { logOpen: boolean; selectedKey?: string | null; logCopied?: boolean }

export function buildPlayHud(m: MatchState, opts: PlayHudOpts): LayoutNode {
  const sel = opts.selectedKey ?? null;
  const children: LayoutNode[] = [
    centerInfo(m),
    actionBar(m),
    ...[0, 1, 2, 3].map((s) => riverBlock(m, s)),
    ...[0, 1, 2, 3].map((s) => seatCard(m, s)),
    ...[0, 1, 2, 3].map((s) => meldBlock(m, s)).filter((n): n is LayoutNode => n !== null), // 副露展示
    ...playerHand(m, sel), // 手牌=绝对定位节点数组（选中张抬升）·直接铺进 play-root
    ...(isPlayerCallWindow(m) ? [] : [subtitle(m, sel)]), // 鸣牌窗口时字幕让位给按钮条（同区避重叠）
  ];
  const cb = callBar(m); // 鸣牌窗口按钮（有待鸣才显）
  if (cb) children.push(cb);
  if (opts.logOpen) children.push(logPanel(m, opts.logCopied ?? false));
  if (isWinLikeEnd(m)) children.push(resultOverlay(m));
  return { type: 'Panel', id: 'play-root', props: { bare: true }, layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H }, children };
}
