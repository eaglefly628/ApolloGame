// Game G · 收藏图谱(英雄列传) + 天梯榜 + 地煞图鉴（拆分自 lobby-screen.ts·叙事/展示层）。
import { esc } from './lobby-util.js';
import { HERO_CARDS, EARTH_FIENDS, STAGE_CAMPAIGN } from './blueprint.js';
import { heroPortrait } from './portraits.js';
import { DISHA_SPECS, stageDisha } from './disha.js';

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
  const recentsHtml = RECENTS.map(([result, k, mode, detail, lp]) => {
    const win = k === 'win';
    return `<div class="rec-row"><div class="rec-result ${win?'win':'lose'}">${result}</div><div style="flex:1;min-width:0"><div style="font-family:var(--fh);font-weight:700;font-size:13px;color:var(--ink)">${esc(mode)}</div><div style="font-size:10px;color:var(--ink-dim)">${esc(detail)}</div></div><span style="font-family:var(--fn);font-size:13px;color:${win?'var(--hp)':'var(--danger)'}">${esc(lp)}</span></div>`;
  }).join('');
  const ladderHtml = LADDER_DATA.map(([rank, lname, suit, mainCard, deck, wr, lp]) => {
    const top3 = +rank <= 3;
    const isMe = lname === name;
    const sc = SUIT_H[suit] ?? '#9ca3af';
    return `<div class="ldr-row" style="${isMe?'background:rgba(232,205,130,.08);border-color:var(--gold);':''}"><span style="width:48px;text-align:center;font-family:var(--fn);font-size:${top3?'18px':'14px'};color:${top3?'var(--gold)':'var(--ink-dim)'}">${esc(rank)}</span><div class="ldr-av" style="background:linear-gradient(150deg,${sc}dd,${sc}88)">${esc(suit)}</div><div style="flex:1;min-width:0"><div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(lname)}</div><div style="font-size:10px;color:var(--ink-dim);white-space:nowrap">主牌 ${esc(mainCard)}</div></div><span style="width:90px;flex:none;text-align:center;font-family:var(--fh);font-weight:700;font-size:12px;color:var(--ink-dim);white-space:nowrap">${esc(deck)}</span><span style="width:70px;text-align:right;font-family:var(--fn);font-size:12px;color:var(--ink-dim)">${esc(wr)}</span><span style="width:80px;text-align:right;font-family:var(--fn);font-size:14px;color:var(--gold)">${esc(lp)}</span></div>`;
  }).join('');
  return `<div style="display:flex;gap:20px;flex:1;min-height:0"><div style="width:340px;flex:none;display:flex;flex-direction:column;gap:16px"><div class="rank-card"><div class="rank-crest">♠</div><div style="font-family:var(--fd);font-size:40px;color:var(--ink);margin-top:10px;line-height:1">${esc(rankText)}</div><div style="font-family:var(--fn);font-size:15px;color:var(--gold);margin-top:6px">1240 LP</div><div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:62%"></div></div><div style="display:flex;justify-content:space-between;width:100%;margin-top:8px;font-size:11px;color:var(--ink-dim)"><span>${esc(rankText)}</span><span>距晋级 60 LP</span><span>—</span></div><div style="display:flex;gap:8px;margin-top:16px;width:100%"><div class="mini-stat"><span class="mini-num">64%</span><span class="mini-lbl">胜率</span></div><div class="mini-stat"><span class="mini-num-hp">3</span><span class="mini-lbl">连胜</span></div><div class="mini-stat"><span class="mini-num">71%</span><span class="mini-lbl">翻正率</span></div></div></div><div class="rec-sheet"><div class="rec-sheet-hd">近 10 局</div><div style="display:flex;flex-direction:column;gap:7px">${recentsHtml}</div></div></div><div class="rec-sheet"><div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><span style="font-family:var(--fd);font-size:26px;color:var(--ink)">全服榜</span><div style="display:flex;gap:5px;margin-left:6px"><button class="scope-on">全服</button><button class="scope-off">好友</button><button class="scope-off">同段</button></div><div style="flex:1"></div><span style="font-size:11px;color:var(--ink-dim)">每 5 分钟刷新 · 赛季 7</span></div><div class="ldr-head-row"><span style="width:48px">名次</span><span style="flex:1">玩家 / 主牌</span><span style="width:90px;text-align:center">主流派</span><span style="width:70px;text-align:right">胜率</span><span style="width:80px;text-align:right">LP</span></div><div style="flex:1;overflow-y:auto">${ladderHtml}</div></div></div>`;
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
