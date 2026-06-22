// Game G · 收藏图谱(英雄列传) + 天梯榜 + 地煞图鉴（拆分自 lobby-screen.ts·叙事/展示层）。
import { esc } from './lobby-util.js';
import { HERO_CARDS, EARTH_FIENDS, STAGE_CAMPAIGN } from './blueprint.js';
import { heroPortrait } from './portraits.js';
import { DISHA_SPECS, stageDisha } from './disha.js';
import { renderNode, type LayoutNode, type TableRow } from '@ui/components/index.js'; // 引擎数据驱动 UI（实验·菜单逐个重写）
import { GG_LOBBY_THEME } from './ui-theme.js'; // 大厅内嵌皮：桥接 .ggl-root 的 CSS 变量 → 随玄铁/锦霞皮自适应

const RAR_META: Record<string, [string, string]> = {
  white: ['普通', '#b9bec8'], green: ['精良', '#5bbf7a'], blue: ['稀有', '#3a9bff'],
  purple: ['史诗', '#bf6bff'], orange: ['传说', '#f0972f'],
};
const SUIT_H: Record<string, string> = { '♠': '#5b7fb0', '♥': '#d8504e', '♦': '#e0973a', '♣': '#3fae6e' };
const SUIT_N: Record<string, string> = { '♠': '黑桃', '♥': '红桃', '♦': '方块', '♣': '梅花' };
export function heroCollSection(heroSuit: string, heroRar: string, heroDetail: string, ownedOnly: boolean): string {
  const filtered = HERO_CARDS.filter(h =>
    (heroSuit === 'all' || h.suit === heroSuit) &&
    (heroRar === 'all' || h.rar === heroRar) &&
    (!ownedOnly || h.own > 0)
  );
  const selId = heroDetail || filtered[0]?.id || '';
  const selCard = HERO_CARDS.find(h => h.id === selId);
  const pill = (on: boolean, act: string, k: string, lbl: string): string =>
    `<button class="filter-pill${on?' on':''}" data-act="${act}" data-k="${esc(k)}">${lbl}</button>`;
  const suitPills: [string, string][] = [['all','全部'],['♠','♠'],['♥','♥'],['♦','♦'],['♣','♣']];
  const rarPills: [string, string][] = [['all','全部'],['blue','稀有'],['purple','史诗'],['orange','传说'],['white','普通']];
  const filterBar = `<div class="coll-filter-bar"><div style="display:flex;align-items:center;gap:10px"><span class="filter-lbl">花色</span>${suitPills.map(([k,l]) => pill(heroSuit===k,'heroSuit',k,l)).join('')}</div><div class="filter-div"></div><div style="display:flex;align-items:center;gap:10px"><span class="filter-lbl">稀有度</span>${rarPills.map(([k,l]) => pill(heroRar===k,'heroRar',k,l)).join('')}</div><div style="flex:1"></div><button class="filter-pill${ownedOnly?' on':''}" data-act="heroOwned" data-k="">${ownedOnly?'☑ 仅已拥有':'☐ 仅已拥有'}</button><div class="filter-pill" style="cursor:pointer">点数 ▾</div></div>`;
  const grid = `<div style="flex:1;min-width:0;overflow-y:auto;padding-right:6px"><div class="hero-grid6">${
    filtered.map(h => {
      const sc = SUIT_H[h.suit] ?? '#9ca3af';
      const rc = RAR_META[h.rar]?.[1] ?? '#9ca3af';
      const locked = h.own === 0;
      const isSel = selId === h.id;
      return `<div class="hcard2${isSel?' sel':''}${locked?' locked':''}" data-act="heroDetail" data-k="${h.id}"><div class="hc2-portrait" style="background:linear-gradient(165deg,${sc}33,${sc}11),radial-gradient(circle at 50% 36%,${sc}55,transparent 62%);border-bottom:2px solid ${rc}"><div class="hc2-corner" style="color:${sc}">${h.rank}<br>${h.suit}</div><div class="hc2-fig">${heroPortrait(h.suit, h.era, h.rank, h.rar)}</div><div class="hc2-gem" style="background:${rc};color:${rc}"></div>${locked?'<div class="hc2-lock">🔒</div>':''}</div><div class="hc2-name">${esc(h.name)}</div><div class="hc2-own" style="color:${locked?'var(--ink-dim)':rc}">${locked?'未拥有':'×'+h.own}</div></div>`;
    }).join('')
  }</div></div>`;
  let detailPane = `<div class="hero-detail-pane" style="display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--ink-dim);font-size:13px">← 选择英雄查看详情</div>`;
  if (selCard) {
    const sc = SUIT_H[selCard.suit] ?? '#9ca3af';
    const [rarName, rarColor] = RAR_META[selCard.rar] ?? ['普通', '#9ca3af'];
    // 二阶「列传」（doc23 §一）：如展开一卷古书——先叙事后数值；缺字段优雅占位；英雄层=纯叙事·不进对战强度（公平骨架·doc22 §四）。
    const scroll = (label: string, body: string): string =>
      `<div style="margin-top:15px"><div style="font-family:var(--fd);font-size:15px;color:var(--gold);margin-bottom:5px">${label}</div><div style="font-size:13px;color:var(--ink);line-height:1.85">${body}</div></div>`;
    const curse = selCard.curseIntro ? esc(selCard.curseIntro) : '<span class="ghost">此魂之诅咒序待录 · 命运待解封</span>';
    const bio = selCard.bio ? esc(selCard.bio) : `${esc(selCard.contrib)}<br><span class="ghost">—— 全传逐期补录。</span>`;
    const battle = selCard.battleName ? scroll('名 战', `<b style="color:var(--ink)">${esc(selCard.battleName)}</b> —— ${esc(selCard.battleResult ?? '')}`) : '';
    const quote = selCard.quote ? `<div style="margin-top:15px;text-align:center;font-family:var(--fd);font-size:20px;color:var(--gold);padding:11px 0;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline)">「${esc(selCard.quote)}」</div>` : '';
    const origin = selCard.titleOrigin ? scroll('称号由来', esc(selCard.titleOrigin)) : '';
    // 三阶「八卦野史」（owner 2026-06-21）：花边/路边新闻一则 + 对后世影响/未来关系。缺则优雅占位。
    const gossip = selCard.gossip ? scroll('野史 · 八卦', esc(selCard.gossip)) : '';
    const legacy = selCard.legacy ? scroll('流变 · 影响', esc(selCard.legacy)) : '';
    detailPane = `<div class="hero-detail-pane" style="overflow-y:auto"><div class="hd2-art${selCard.own === 0 ? ' locked' : ''}" style="background:linear-gradient(165deg,${sc}44,${sc}14),radial-gradient(circle at 50% 34%,${sc}66,transparent 60%);border:4px solid ${rarColor};box-shadow:0 0 26px ${rarColor}55,inset 0 0 0 2px rgba(255,255,255,.5)"><div class="hd2-corner" style="top:10px;left:12px;color:${sc}">${selCard.rank}<br>${selCard.suit}</div><div class="hd2-fig">${heroPortrait(selCard.suit, selCard.era, selCard.rank, selCard.rar)}</div><div class="hd2-corner" style="bottom:10px;right:12px;transform:rotate(180deg);color:${sc}">${selCard.rank}<br>${selCard.suit}</div></div><div style="display:flex;align-items:baseline;gap:10px;margin-top:14px"><div style="font-family:var(--fd);font-size:30px;color:var(--ink);line-height:1">${esc(selCard.name)}</div><span style="display:inline-block;padding:3px 10px;background:#9b2d22;color:#f5e6c8;border-radius:4px;font-family:var(--fh);font-weight:700;font-size:13px;box-shadow:0 1px 4px rgba(155,45,34,.5)">${esc(selCard.title)}</span></div><div style="font-size:12px;color:var(--ink-dim);margin-top:5px">${esc(selCard.era)} · 贡献度 第 ${selCard.contribRank} 位</div><div class="hd2-chips"><span class="hd2-chip" style="background:${rarColor}22;color:${rarColor};border:1px solid ${rarColor}66">${rarName}</span><span class="hd2-chip" style="background:${sc}22;color:${sc};border:1px solid ${sc}66">${selCard.suit} ${SUIT_N[selCard.suit] ?? ''}</span><span class="hd2-chip" style="background:var(--chip);color:var(--ink-dim);border:1px solid var(--panel-border)">军衔 ${selCard.rank}</span></div>${scroll('诅咒 · 序', curse)}${scroll('列传 · 生平', bio)}${battle}${quote}${origin}${gossip}${legacy}${scroll('战绩 · 成长弧', '<span class="ghost">尚未立功 · 杀敌 → 称号 → 数值后定（公平骨架：英雄层不进对战强度）</span>')}<div style="display:flex;gap:9px;margin-top:16px"><button style="flex:1;padding:11px;border-radius:11px;cursor:pointer;background:var(--chip);border:1px solid var(--panel-border);color:var(--ink);font-family:var(--fh);font-weight:700;font-size:14px">改造</button><button style="flex:2;padding:11px;border-radius:11px;clip-path:var(--chamfer);cursor:pointer;border:none;background:var(--gold-grad);color:#2a1a08;font-family:var(--fh);font-weight:700;font-size:15px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)">加入牌组</button></div></div>`;
  }
  return `${filterBar}<div style="display:flex;gap:20px;flex:1;min-height:0">${grid}${detailPane}</div>`;
}

export function ladderSection(name: string, rankText: string): string {
  const RECENTS: [string, string, string, string, string][] = [
    ['胜', 'win', '天梯掷命 1v1', '黑桃急袭 · 翻正 4/5', '+22'],
    ['胜', 'win', '天梯掷命 1v1', '红桃火攻 · 斩首奏效', '+19'],
    ['负', 'lose', '天梯掷命 1v1', '田忌阵被识破', '−16'],
    ['胜', 'win', '天梯掷命 1v1', '锋矢破中路', '+21'],
    ['胜', 'win', '天梯掷命 1v1', '黑杰克级正面率', '+18'],
    ['负', 'lose', '天梯掷命 1v1', '能量误判', '−14'],
  ];
  const LADDER_DATA: [string, string, string, string, string, string, string][] = [
    ['1', '同花顺王', '♠', '黑桃A', '♠ 顺子', '78%', '2880'],
    ['2', '红桃皇后', '♥', '红桃K', '♥ 火攻', '74%', '2710'],
    ['3', '方块老千', '♦', '方块Q', '♦ 配重', '71%', '2640'],
    ['4', '梅花骑士', '♣', '梅花J', '♣ 连携', '69%', '2510'],
    ['5', '百搭天罡', '♠', '黑桃10', '混 · 干预', '67%', '2380'],
    ['6', '黑桃暗影', '♠', '黑桃A', '♠ 速攻', '65%', '2240'],
    ['7', name, '♠', '黑桃A', '♠ 急袭', '64%', '1240'],
    ['8', '掷地有声', '♦', '方块K', '♦ 稳翻', '61%', '1180'],
  ];
  // ⭐ 数据驱动 UI（实验·从菜单逐个入手）：手写 DOM → LayoutNode **数据** + 引擎 renderNode + 古风主题。
  //   布局=纯数据(本屏无回调·纯展示·逻辑天然分离)；同份数据换主题即换皮。引擎 Table 渲表头/行/对齐/着色。
  const recentRows: TableRow[] = RECENTS.map(([result, k, mode, detail, lp], i) => ({ id: `rec-${i}`, cells: { r: result, mode: `${mode} · ${detail}`, lp }, tone: k === 'win' ? 'accent' : 'dim' }));
  const boardRows: TableRow[] = LADDER_DATA.map(([rank, lname, suit, mainCard, deck, wr, lp]) => ({ id: `ldr-${rank}`, cells: { rank, name: `${suit} ${lname} · ${mainCard}`, deck, wr, lp }, tone: lname === name ? 'accent' : (+rank <= 3 ? 'accent' : 'normal') }));
  const tree: LayoutNode = {
    type: 'Panel', id: 'ladder', props: {}, layout: { direction: 'row', gap: 16 },
    children: [
      {
        type: 'Panel', id: 'ldr-left', props: {}, layout: { direction: 'column', gap: 14, width: 320 },
        children: [
          {
            type: 'Panel', id: 'ldr-rank', props: { title: '我的段位' }, layout: { gap: 6 },
            children: [
              { type: 'Label', id: 'ldr-rank-t', props: { text: `♠ ${rankText}`, size: 'xl', color: 'gold', bold: true } },
              { type: 'Label', id: 'ldr-rank-lp', props: { text: '1240 LP · 距晋级 60 LP', size: 'sm', color: 'sub' } },
              { type: 'Label', id: 'ldr-rank-st', props: { text: '胜率 64% · 连胜 3 · 翻正率 71%', size: 'sm', color: 'dim' } },
            ],
          },
          { type: 'Table', id: 'ldr-recents', props: { title: '近 10 局', columns: [{ key: 'r', label: '', width: 30, align: 'center' }, { key: 'mode', label: '对局' }, { key: 'lp', label: 'LP', width: 52, align: 'right' }], rows: recentRows } },
        ],
      },
      {
        type: 'Panel', id: 'ldr-right', props: {}, layout: { flex: 1 },
        children: [
          { type: 'Table', id: 'ldr-board', props: { title: '全服榜 · 赛季 7 · 每 5 分钟刷新', columns: [{ key: 'rank', label: '名次', width: 48, align: 'center' }, { key: 'name', label: '玩家 / 主牌' }, { key: 'deck', label: '主流派', width: 96, align: 'center' }, { key: 'wr', label: '胜率', width: 60, align: 'right' }, { key: 'lp', label: 'LP', width: 68, align: 'right' }], rows: boardRows } },
        ],
      },
    ],
  };
  return renderNode(tree, GG_LOBBY_THEME);
}

const FIEND_KIND_CLR: Record<string, string> = { power: '#ef4444', odds: '#a78bfa', combo: '#2dd4bf', morale: '#fcd34d', tempo: '#22c55e', stamina: '#38bdf8', draw: '#06b6d4', lane: '#94a3b8', siege: '#a8a29e' };
// 地煞「真正数值」（读甲 DISHA_SPECS·关1-5 精确数值）→ 人话一行，让玩家一目了然。
export function dishaNumberLine(dishaId: string): string {
  const s = DISHA_SPECS[dishaId]; if (!s) return '';
  const p: string[] = [];
  if (s.homeHp) p.push(`大本营 ${s.homeHp} 血`);
  if (s.allWinPct) p.push(`全军 +${s.allWinPct}% 胜率`);
  if (s.generalWinPct) p.push(`主将 +${s.generalWinPct}%`);
  if (s.phalanxPerAdj) p.push(`每相邻友兵 +${s.phalanxPerAdj}%${s.phalanxCap ? ` · 封顶 +${s.phalanxCap}%` : ''}`);
  if (s.nearBaseSlots) p.push(`大本营前 ${s.nearBaseSlots} 格 ${[s.nearBasePower ? `守军战力 +${s.nearBasePower}` : '', s.nearBaseWinPct ? `+${s.nearBaseWinPct}% 胜率` : ''].filter(Boolean).join('·') || '固守'}`);
  if (s.eliteMidWinPct) p.push(`中路前锋 +${s.eliteMidWinPct}%`);
  if (s.flankYouWinPct) p.push(`你被左右夹 −${s.flankYouWinPct}%`);
  if (s.firstStrike) p.push(`先手出击${s.firstStrikeWinPct ? ` +${s.firstStrikeWinPct}%` : ''}`);
  if (s.winStreakPer) p.push(`每连胜 +${s.winStreakPer}%${s.winStreakCap ? ` · 封顶 +${s.winStreakCap}%` : ''}`);
  if (s.lastStandGeneral) p.push('主将 2 命（首负不亡·退一格）');
  if (s.noRout) p.push('主将亡不溃散');
  if (s.bonusMana) p.push(`每回合多 +${s.bonusMana} 召唤源泉`);
  if (s.batteryEveryTurns) p.push(`每 ${s.batteryEveryTurns} 回合压一路 −${s.batteryWinPct}%`);
  return p.join(' · ');
}
// 地煞图鉴（doc23 §八/§九 · 52 Boss × 3 招牌历史战术·明牌可破）。kind 借天罡词汇配色。
export function fiendsCodex(campaignMax = 1): string {
  // 按关卡顺位排序：战役 5 关 Boss 在前（按 stage），其余在后；未抵达的关卡置暗。
  const stageOf = new Map(STAGE_CAMPAIGN.map((c) => [c.boss, c.stage]));
  const sorted = [...EARTH_FIENDS].sort((a, b) => (stageOf.get(a.boss) ?? 99) - (stageOf.get(b.boss) ?? 99));
  return `<div style="flex:1;min-height:0;overflow-y:auto;padding-right:6px"><div class="note" style="text-align:left;margin-bottom:10px">🎴 <b>地煞</b> = 每位 Boss 的招牌历史战术（明牌·公平可破）。按关卡顺位排列·未解锁的略暗。共 ${EARTH_FIENDS.length} 位 Boss。</div>${sorted.map((b) => {
    const st = stageOf.get(b.boss);
    const locked = st === undefined || st > campaignMax;
    const bDisha = st !== undefined ? stageDisha(st) : [];
    const fs = b.fiends.map((f, i) => {
      const clr = FIEND_KIND_CLR[f.kind.split('+')[0]] ?? '#9ca3af';
      const nums = dishaNumberLine(bDisha[i] ?? '');
      return `<div class="fiend-card"><div class="fiend-hd"><b>${esc(f.name)}</b><span class="fiend-kind" style="color:${clr};border-color:${clr}66">${esc(f.kind)}</span></div><div class="fiend-eff">${esc(f.effect)}</div>${nums ? `<div class="disha-num">📊 数值：${esc(nums)}</div>` : ''}<div class="fiend-cnt">🛡 破：${esc(f.counter)}</div></div>`;
    }).join('');
    const badge = st !== undefined ? `<span class="fiend-stage${locked ? ' lk' : ''}">${locked ? '🔒 ' : ''}第 ${st} 关</span>` : `<span class="fiend-stage lk">🔒 后续关卡</span>`;
    return `<div class="boss-block${locked ? ' locked' : ''}"><div class="boss-hd">${badge}<span class="boss-name">${esc(b.boss)}</span><span class="ghost" style="font-size:11px;margin-left:auto">招牌战术 ×${b.fiends.length}</span></div><div class="fiend-row">${fs}</div></div>`;
  }).join('')}</div>`;
}
