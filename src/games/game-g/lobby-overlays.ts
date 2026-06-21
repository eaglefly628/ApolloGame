// Game G · 大厅弹层渲染（帮助/设置/商城/抽卡开包/旁白/跳过引导·拆分自 lobby-screen.ts）。
import { esc, kfmt } from './lobby-util.js';
import { GI } from './icons.js';
import { isSfxMuted } from './sfx.js';
import { isBgmOn, toggleBgm, bgmTrackIdx, selectBgm, bgmVolume, setBgmVolume, BGM_TRACKS } from './bgm.js';
import { RECHARGE_PACKS, rechargeTotal, DIAMOND_EXCHANGES, DIZHI_SHARD_PACKS, GACHA, canonSuitPw, DIZHI_TIER_NM, dizhiTopTier, dizhiTotal } from './blueprint.js';
import { DIZHI_ZODIACS, type StoryBeat } from './blueprint.js';
import type { LobbyView, GachaResult, LobbyShopItem } from './lobby-screen.js';

export function helpBox(helpTab: 'intro' | 'tut' | 'manual', tier: 'easy' | 'mid' | 'hard'): string {
  const nav = (k: 'intro' | 'tut' | 'manual', lbl: string): string =>
    `<button class="cta-sub" style="${helpTab === k ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="helpTab" data-k="${k}">${lbl}</button>`;
  const introBody = `<h2>翻命扑克 · Fateflip</h2>
    <div class="lead">你，执掌命运之人。</div>
    <p>历史上最伟大的 <b>52 位名将</b>——孙武、成吉思汗、亚历山大、汉尼拔、韩信……他们的魂被诅咒，封进了一副扑克。每一位，都困在他<b>一生最关键的那场战役</b>里，命运定格在那一刻。</p>
    <p><b>掷命，即翻命。</b>你抛下手中的牌，正面则生、反面则亡——用一掷之力，去翻动这些被诅咒英雄的命运：重续辉煌，或改写败局。</p>
    <p class="lead" style="font-size:16px">三牌组，三层天命：</p>
    <p>· <b>扑克 52 · 名将</b>：上阵的兵，每张都是一位有名有姓的历史英雄。<br>· <b>天罡 36 · 兵法</b>：三十六记战术，你的法术——虎符、擒王、连环、背水……<br>· <b>地支 12 · 天命</b>：十二生肖的命格，镶进你的英雄，越养越强。</p>
    <p><b>52 场命运之战。</b>你将重走井陉、巨鹿、坎尼、温泉关……每一关，是一位英雄的成名之战。打赢，便解封他的魂，收他入麾下。</p>
    <p style="font-family:var(--fd);font-size:17px;color:var(--gold);text-align:center;margin-top:14px">配一副好牌，去翻天下英雄的命。</p>`;
  const tutBody = `<h3>📖 新手指导 · 一局怎么打</h3>
    <div class="step"><b>赛前（改造坊/牌组）</b>：构筑你的库——公平扑克 52 + 天罡牌（带 ≤12 进出战牌组）+ 地支镶嵌附魔。强弱靠经营、不靠抽强牌。</div>
    <div class="step"><b>开局</b>：三路 9 格、两端大本营各 3 血。每回合 <b>+1 召唤源泉</b>，四选一（抽/放/打天罡/弃）。</div>
    <div class="step"><b>对决核</b>：两军碰头 → 比战力 → 胜率(如 76:24) → 抛牌定生死（正面活·前进 / 反面亡）。<b>胜率可见</b>，永远有 3% 爆冷缝。</div>
    <div class="step"><b>赢条件</b>：把对面大本营 3 血打光，<b>先破者胜</b>。</div>`;
  const tb = (k: 'easy' | 'mid' | 'hard', lbl: string, col: string): string =>
    `<button class="cta-sub" data-act="manTier" data-k="${k}" style="${tier === k ? `background:${col};color:#1a1206;border:0` : ''}">${lbl}</button>`;
  const easy = `<h3 style="color:#4ade80">🟢 初级 · 打赢第一场</h3>
    <p><b>战场</b>：三条横路（上/中/下），每路 <b>9 格</b>（你 4 · 中 1 · 敌 4）；两端大本营各 <b>3 血</b>。<b>先把对面 3 血打光 = 赢。</b></p>
    <p><b>回合制·每回合做一件事</b>：回合开始 <b>+1 召唤源泉</b>，然后<b>四选一</b>（互斥）：<br>· <b>抽牌</b>· <b>放牌</b>（部署一兵到某路·可顺手开关机关门）· <b>打天罡</b>· <b>弃牌</b>。<br>做完 → 棋盘走一格，两军碰头 → <b>掷命对决</b>。</p>
    <p><b>掷命对决（核心）</b>：比战力 → 算胜率 → 抛牌定生死。战力高则胜率高，但永远有 <b>爆冷缝</b>（再强 3% 翻车·再弱 3% 翻盘）。</p>`;
  const mid = `<h3 style="color:#facc15">🟡 中级 · 三牌组 + 经营</h3>
    <p><b>三套牌</b>：<br>· <b>扑克 52（名将·兵）</b>：上场部队，点数=战力、花色=阵营，双方同副（公平）。<br>· <b>天罡 36（兵法·法术）</b>：赛前挑带上场，局内打出持续整局（虎符全军+2 / 疾行加速 / 擒王斩敌主将崩路）。<br>· <b>地支 12（天命·养成）</b>：局外镶到牌上叠属性（附魔台）。</p>
    <p><b>⚔ 掷命预报（落子前就看得见·owner 2026-06-21 新增）</b>：两军前锋将要相遇的那一路，棋盘上会在你前锋头顶浮出<b>档位词 + 具体胜率%</b>，让你<b>开战前</b>就心里有数：<br>
    · 占优：<span style="color:#bcc857;font-weight:700">小优 55%↑</span> → <span style="color:#84c97f;font-weight:700">优势 65%↑</span> → <span style="color:#5bbf7a;font-weight:700">大优 80%↑</span> → <span style="color:#2fbf6a;font-weight:700">碾压 90%↑</span><br>
    · 吃亏：<span style="color:#e8a64a;font-weight:700">小弱</span> → <span style="color:#e8814a;font-weight:700">弱势</span> → <span style="color:#e25a4a;font-weight:700">大弱</span> → <span style="color:#cf3b3b;font-weight:700">被碾压</span>；中间 <span style="color:#cdb86a;font-weight:700">均势 ~50%</span><br>
    （胜率含天罡/地支/士气全部加成，与真实开战同一套算法——预报即结果的概率，详见 🔴 高级）。</p>
    <p><b>经营要点</b>：召唤源泉紧（每回合 +1）→ 每个抉择都重要；机关门换路；同点数凑对子/三条加战力；<b>看预报田忌赛马</b>——避开"大弱/被碾压"的路、把强牌送去"大优/碾压"集中突破。</p>`;
  const hard = `<h3 style="color:#f87171">🔴 高级 · 概率算法 · 连携 · 克制</h3>
    <p><b>⭐ 掷命对决——最终概率怎么算出来的</b>（透明·非黑箱）：<br>
    ① <b>各取战力</b>：碰头的两张牌，各算<b>有效战力 P_eff</b> = 点数底盘 + 天罡加成（虎符全军+2…）+ 地支附魔(镶嵌+favor) + 士气(主将活则全路涨) + 干预。<br>
    ② <b>算差值</b>：取双方差 Δ = P我 − P敌。<br>
    ③ <b>过 S 形曲线</b>：胜率 = <b>logistic(Δ / k)</b> = 1 / (1 + e^(−Δ/k))。差越大胜率越高，但平滑——不是"高 1 点就必胜"。k 是缓和系数。<br>
    ④ <b>夹爆冷缝</b>：胜率 = <b>clamp(上式, 3%, 97%)</b>——再强也有 3% 翻车、再弱也有 3% 翻盘。<br>
    ⑤ <b>种子骰</b>：用确定性随机数掷这个胜率 → 正面活·前进 / 反面亡。<b>同一局同种子结果可复现</b>。</p>
    <p><b>调概率的牌</b>：铁骰(占优封顶不被爆冷) · 磐石(抬你下限) · 灌铅骰(强者愈强) · 鬼手(指定一场 +25%) · 巧手(P_eff +1) · 稳手(胜率下限 +5%)。</p>
    <p><b>地支连携（镶嵌质变）</b>：<br>· <b>二合·六合</b>（两颗相合）：门槛低、效果轻——如 子丑合 大本营+1血、午未合 濒死免死。<br>· <b>三合</b>（三颗同组）：强力质变——如 水(申子辰)一局1次必重掷、火(寅午戌)赢后连推。<br>（镶嵌战斗 apply 待实装。）</p>
    <p><b>赛前构筑</b>：天罡针对当关 Boss 明牌的 3 张地煞 counter-pick；集齐流派天罡解锁<b>招牌印</b>。Boss 库=12 随机天罡+3 专属地煞，比你猛但<b>明牌可破</b>。</p>`;
  const manualBody = `<div class="ctarow" style="margin-bottom:12px">${tb('easy', '🟢 初级', '#4ade80')}${tb('mid', '🟡 中级', '#facc15')}${tb('hard', '🔴 高级', '#f87171')}</div><div style="min-height:200px">${tier === 'easy' ? easy : tier === 'mid' ? mid : hard}</div>`;
  const body = helpTab === 'intro' ? introBody : helpTab === 'tut' ? tutBody : manualBody;
  return `<div class="tut-ov" data-act="help-close"><div class="tut-box intro-scroll" data-stop="1" style="width:560px;max-width:100%;display:flex;flex-direction:column">
    <div class="ctarow" style="margin-bottom:12px">${nav('intro', '📜 游戏介绍')}${nav('tut', '📖 新手指导')}${nav('manual', '📚 玩法手册')}</div>
    <div style="height:46vh;min-height:340px;overflow-y:auto;padding-right:4px">${body}</div>
    <div style="text-align:center;margin-top:12px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="help-close">明白了 →</button></div>
  </div></div>`;
}
// 背景音乐设置（owner 2026-06-21「把开关加菜单·让我选 3 首」）：开/关 + 3 首选曲 + 音量。状态读 bgm.ts（localStorage·与 SFX 分开）。
function bgmSettingsBlock(): string {
  const on = isBgmOn();
  const cur = bgmTrackIdx();
  const vol = Math.round(bgmVolume() * 100);
  const trackBtns = BGM_TRACKS.map((t, i) =>
    `<button class="cta-sub" style="${i === cur ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="bgmTrack" data-k="${i}">${i === cur ? '♪ ' : ''}${esc(t.name)}</button>`).join('');
  return `<div style="text-align:left;margin-top:16px"><div class="note" style="text-align:left;margin-bottom:6px">背景音乐</div>
    <button class="cta-sub" data-act="bgmToggle">${on ? '🎵 音乐：开（点击关闭）' : '🔇 音乐：关（点击开启）'}</button>
    ${on ? `<div class="ctarow" style="flex-wrap:wrap;gap:6px;margin-top:8px">${trackBtns}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:8px"><span class="note" style="margin:0">音量</span><button class="cta-sub" data-act="bgmVol" data-k="down" style="min-width:34px">−</button><b style="min-width:42px;text-align:center;color:var(--ink)">${vol}%</b><button class="cta-sub" data-act="bgmVol" data-k="up" style="min-width:34px">＋</button></div>` : ''}
  </div>`;
}
// 设置（owner 2026-06-20）：皮肤(默认玄铁) + 重看开场/引导 + 重置数据(调试)。
export function settingsBox(view: LobbyView): string {
  const seg = (k: 'onyx' | 'rosy', lbl: string): string =>
    `<button class="cta-sub" style="${view.skin === k ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="skin" data-k="${k}">${lbl}</button>`;
  return `<div class="tut-ov" data-act="settings-close"><div class="tut-box" data-stop="1" style="max-width:420px">
    <h2>⚙ 设置</h2>
    <div style="text-align:left;margin-top:10px"><div class="note" style="text-align:left;margin-bottom:6px">大厅皮肤</div><div class="ctarow">${seg('onyx', '玄铁（默认）')}${seg('rosy', '锦霞')}</div></div>
    <div style="text-align:left;margin-top:16px"><div class="note" style="text-align:left;margin-bottom:6px">音效</div><button class="cta-sub" data-act="sfxToggle">${isSfxMuted() ? '🔇 音效：关（点击开启）' : '🔊 音效：开（点击静音）'}</button></div>
    ${bgmSettingsBlock()}
    <div style="text-align:left;margin-top:16px"><div class="note" style="text-align:left;margin-bottom:6px">新手内容</div><button class="cta-sub" data-act="replayIntro">↻ 重看开场故事与新手引导</button></div>
    <div style="text-align:left;margin-top:16px"><div class="note" style="text-align:left;margin-bottom:6px">退出</div><button class="cta-sub" data-act="exitGame">⏏ 退出到游戏库</button></div>
    <div style="text-align:left;margin-top:16px;padding-top:12px;border-top:1px solid var(--panel-border)"><div class="note" style="text-align:left;margin-bottom:6px">调试</div><button class="cta-sub" data-act="reset" style="color:var(--danger);border-color:var(--danger)">⚠ 重置所有数据（调试用）</button></div>
    <div style="text-align:center;margin-top:16px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="settings-close">完成 →</button></div>
  </div></div>`;
}
// 商城（owner 2026-06-20 · Demo）：🎴抽卡(doc25 §四·从已解锁池随机·重复转碎片·碎片定向兑换) + 💎钱包(充值/兑换)。
// 全数据驱动：池/价格/汇率读 GACHA / RECHARGE_PACKS / DIAMOND_EXCHANGES；点击 = 真发卡/发币。
export function shopBox(view: LobbyView, shopTab: 'gacha' | 'wallet' | 'foil', rechargeErr = '', rcSuits: string[] = []): string {
  const dia = view.diamond ?? 0;
  const shards = view.dizhiShards ?? 0;
  const tShards = view.tiangangShards ?? 0;
  const needPw = !!view.rechargeNeedsPassword;
  const tabBtn = (k: 'gacha' | 'wallet' | 'foil', lbl: string): string =>
    `<button class="cta-sub" style="${shopTab === k ? 'background:var(--gold-grad);color:#1a1206;border:0' : ''}" data-act="shopTab" data-k="${k}">${lbl}</button>`;
  const bal = `<div style="display:flex;align-items:center;gap:14px;color:var(--ink-dim);font-size:12px;margin:6px 0 12px"><span>🪙 <b style="color:var(--ink)">${view.coin}</b></span><span>💎 <b style="color:#7fd0ff">${dia}</b></span><span>🔶 <b style="color:#e6b96a">${tShards}</b> 天罡碎片</span><span>🧩 <b style="color:#e6b96a">${shards}</b> 地支碎片</span></div>`;
  // ── 🎴 抽卡 tab ──
  const poolN = view.tiangangs.filter((j) => !j.locked).length;
  const dizhiN = DIZHI_ZODIACS.filter((z) => dizhiTotal((view.dizhiBag ?? {})[z.branch]) > 0).length;
  const drawBtn = (pool: 'tiangang' | 'dizhi', count: 1 | 10, pay: 'gold' | 'diamond'): string => {
    const g = GACHA[pool];
    const cost = pay === 'gold' ? (count === 10 ? g.tenGold : g.singleGold) : (count === 10 ? g.tenDiamond : g.singleDiamond);
    const afford = pay === 'gold' ? view.coin >= cost : dia >= cost;
    return `<button class="gacha-draw${afford ? '' : ' off'}"${afford ? ` data-act="gacha" data-k="${pool}:${count}:${pay}"` : ' disabled'}><span>${count === 10 ? '十连' : '单抽'}</span><b>${pay === 'gold' ? '🪙' : '💎'}${cost}</b></button>`;
  };
  const poolCard = (pool: 'tiangang' | 'dizhi', emoji: string, title: string, sub: string): string =>
    `<div class="gacha-pool"><div class="gacha-pool-hd">${emoji} ${title}</div><div class="note" style="text-align:left;margin:2px 0 8px">${sub}</div><div class="gacha-btns">${drawBtn(pool, 1, 'gold')}${drawBtn(pool, 1, 'diamond')}${drawBtn(pool, 10, 'gold')}${drawBtn(pool, 10, 'diamond')}</div></div>`;
  const craftable = view.tiangangs.filter((j) => !j.locked && !j.owned);
  const craftChips = craftable.length
    ? craftable.map((j) => { const can = tShards >= GACHA.tiangang.craftShards; return `<button class="gacha-craft${can ? '' : ' off'}"${can ? ` data-act="craftTiangang" data-k="${j.id}"` : ' disabled'}>${esc(j.name)} <span>🔶${GACHA.tiangang.craftShards}</span></button>`; }).join('')
    : '<span class="ghost" style="font-size:12px">已解锁天罡均已拥有 🎉</span>';
  // 地支碎片定向兑换（owner 2026-06-21「走通用碎片兑换地支牌」）：花地支碎片 → 卡包 +1 铜活化（满3自动升档·消耗品）。
  const dizhiBag = view.dizhiBag ?? {};
  const dizhiCraftChips = DIZHI_ZODIACS.map((z) => {
    const top = dizhiTopTier(dizhiBag[z.branch]); const n = dizhiTotal(dizhiBag[z.branch]);
    const can = shards >= GACHA.dizhi.craftShards;
    const label = `${z.animal}${n > 0 ? `·${DIZHI_TIER_NM[top]}×${n}` : ''} +1`;
    return `<button class="gacha-craft${can ? '' : ' off'}"${can ? ` data-act="craftDizhi" data-k="${z.branch}"` : ' disabled'} title="${esc(z.animal)}（${esc(z.symbol)}）· 兑一张铜活化进卡包">${esc(label)} <span>🧩${GACHA.dizhi.craftShards}</span></button>`;
  }).join('');
  const gachaTab = `${poolCard('tiangang', '🎴', '天罡卡池', `已解锁 ${poolN} 张 · 抽到重复 → +${GACHA.tiangang.dupShards} 天罡碎片`)}
    ${poolCard('dizhi', '🀄', '地支卡池', `12 生肖（已集 ${dizhiN}/12）· 重复自动升档 铜→银→金 · 满金转地支碎片`)}
    <div class="gacha-pool"><div class="gacha-pool-hd">🔶 天罡碎片 · 定向兑换（保底）</div><div class="note" style="text-align:left;margin:2px 0 8px">攒够碎片直接换你想要的天罡——防"抽不到配不出 build"。每张 ${GACHA.tiangang.craftShards} 碎片。</div><div class="gacha-crafts">${craftChips}</div></div>
    <div class="gacha-pool"><div class="gacha-pool-hd">🧩 地支碎片 · 定向兑换（升档）</div><div class="note" style="text-align:left;margin:2px 0 8px">攒够地支碎片直接换/升你想要的生肖（铜→银→金）。每次 ${GACHA.dizhi.craftShards} 碎片。<b style="color:#e6b96a">你有 ${shards} 🧩</b></div><div class="gacha-crafts">${dizhiCraftChips}</div></div>
    <div class="note" style="text-align:left;margin-top:10px;font-size:11px">从「已解锁池」随机（通关解锁更多）。地支镶嵌到「改造坊」给牌附魔。</div>`;
  // ── 💎 钱包 tab（充值 + 兑换）──
  const packCard = (p: typeof RECHARGE_PACKS[number]): string => {
    const total = rechargeTotal(p);
    const bonus = p.bonus > 0 ? `<span style="color:var(--gold);font-size:11px">含赠 +${p.bonus}</span>` : `<span style="color:var(--ink-dim);font-size:11px">&nbsp;</span>`;
    const tag = p.tag ? `<div style="position:absolute;top:-9px;right:8px;background:var(--gold-grad);color:#2a1a08;font-family:var(--fn);font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px">${p.tag}</div>` : '';
    return `<button class="rc-pack" data-act="rechargeBuy" data-k="${p.id}" style="position:relative">${tag}<div class="rc-amt">💎 ${total}</div>${bonus}<div class="rc-price">¥${p.price}</div></button>`;
  };
  const exCard = (x: typeof DIAMOND_EXCHANGES[number]): string => {
    const afford = dia >= x.diamond;
    const tag = x.tag ? `<div style="position:absolute;top:-9px;right:8px;background:#3a6ea5;color:#dff;font-family:var(--fn);font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px">${x.tag}</div>` : '';
    return `<button class="rc-pack${afford ? '' : ' off'}"${afford ? ` data-act="exchangeBuy" data-k="${x.id}"` : ' disabled'} style="position:relative">${tag}<div class="rc-amt" style="color:var(--gold)">🪙 ${x.gold}</div><div class="rc-price" style="background:#1c3a5a;color:#9fe0ff">💎 ${x.diamond}</div></button>`;
  };
  const shardCard = (x: typeof DIZHI_SHARD_PACKS[number]): string => {
    const afford = dia >= x.diamond;
    const tag = x.tag ? `<div style="position:absolute;top:-9px;right:8px;background:#7a5a2a;color:#ffe;font-family:var(--fn);font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px">${x.tag}</div>` : '';
    return `<button class="rc-pack${afford ? '' : ' off'}"${afford ? ` data-act="shardBuy" data-k="${x.id}"` : ' disabled'} style="position:relative">${tag}<div class="rc-amt" style="color:#e6b96a">🧩 ${x.shards}</div><div class="rc-price" style="background:#1c3a5a;color:#9fe0ff">💎 ${x.diamond}</div></button>`;
  };
  // 投资人彩蛋：第二次起需密码（首充免密·已由 needPw 标识）。
  // 测试版改「点选花色」当密码（owner 2026-06-21·不让打字）：点亮 2 张花色 → 即密码。正确=♥+♠。
  const SUIT_PW: [string, string, string][] = [['♠', '黑桃', '#5b7fb0'], ['♥', '红桃', '#d8504e'], ['♦', '方块', '#e0973a'], ['♣', '梅花', '#3fae6e']];
  const suitTiles = SUIT_PW.map(([g, nm, c]) => {
    const on = rcSuits.includes(g);
    return `<button class="rc-suit${on ? ' on' : ''}" data-act="rcSuit" data-k="${g}" style="flex:1;padding:10px 0;border-radius:10px;cursor:pointer;background:${on ? c : 'var(--chip)'};border:2px solid ${on ? c : 'var(--panel-border)'};color:${on ? '#fff' : c};display:flex;flex-direction:column;align-items:center;gap:2px;box-shadow:${on ? `0 0 12px ${c}88` : 'none'};transition:all .12s"><span style="font-size:24px;line-height:1">${g}</span><span style="font-size:11px;color:${on ? '#fff' : 'var(--ink-dim)'}">${nm}</span></button>`;
  }).join('');
  const pwBlock = needPw
    ? `<div style="margin-top:10px"><div style="font-size:12px;color:var(--ink-dim);margin-bottom:6px">🔒 复充需密码 · <b style="color:var(--ink)">点选 2 张花色</b>（测试版·免打字）<span style="color:var(--gold);margin-left:4px">已选 ${rcSuits.length}/2</span></div><div style="display:flex;gap:8px">${suitTiles}</div>${rechargeErr ? `<div style="color:#e0635f;font-size:12px;margin-top:6px">${rechargeErr}</div>` : ''}</div>`
    : `<div class="note" style="text-align:left;margin-top:6px;font-size:11px">🎁 首充免密「送一点点」体验。</div>`;
  const walletTab = `<div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);margin:4px 0 8px">充值 · 越充越送（Demo·点即到账）</div>
    <div class="rc-grid">${RECHARGE_PACKS.map(packCard).join('')}</div>
    ${pwBlock}
    <div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);margin:16px 0 8px">兑换金币 · 💎 → 🪙（改造坊通用材料）</div>
    <div class="rc-grid">${DIAMOND_EXCHANGES.map(exCard).join('')}</div>
    <div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--ink);margin:16px 0 8px">兑换地支碎片 · 💎 → 🧩（养地支专属材料）</div>
    <div class="rc-grid">${DIZHI_SHARD_PACKS.map(shardCard).join('')}</div>
    <div class="note" style="text-align:left;margin-top:12px;font-size:11px">Demo 演示：充值为模拟，点击直接到账、不走真实支付。</div>`;
  // ── ✨ 皮肤 tab（闪艺·牌面皮肤·金币购买）──
  const foilCard = (f: LobbyShopItem): string => {
    const st = f.owned ? '<span style="color:var(--gold);font-size:11px">✓ 已拥有</span>' : f.buyable ? `<button class="gacha-craft" data-act="buyFoil" data-k="${f.id}">🪙 ${f.cost}</button>` : `<span style="color:var(--ink-dim);font-size:11px">🪙 ${f.cost}（金币不足）</span>`;
    return `<div class="gacha-pool" style="display:flex;align-items:center;gap:10px"><div style="font-size:24px">✨</div><div style="flex:1"><div class="gacha-pool-hd">${esc(f.name)}</div><div class="note" style="text-align:left;margin:1px 0 0">${esc(f.sub)}</div></div>${st}</div>`;
  };
  const foilTab = `<div class="note" style="text-align:left;margin:2px 0 10px">✨ 闪艺 = 牌面皮肤（纯装饰·不影响战力）。点亮后牌组里的牌带流光皮肤。已拥有 ${view.foils.filter((f) => f.owned).length}/${view.foils.length}。</div>${view.foils.map(foilCard).join('')}`;
  const body = shopTab === 'gacha' ? gachaTab : shopTab === 'foil' ? foilTab : walletTab;
  return `<div class="tut-ov" data-act="recharge-close"><div class="tut-box intro-scroll" data-stop="1" style="width:560px;max-width:100%;display:flex;flex-direction:column">
    <h2>🛒 商城</h2>
    <div class="ctarow" style="margin:4px 0 2px">${tabBtn('gacha', '🎴 抽卡')}${tabBtn('foil', '✨ 皮肤')}${tabBtn('wallet', '💎 钱包')}</div>
    ${bal}
    <div style="height:48vh;min-height:320px;overflow-y:auto;padding-right:4px">${body}</div>
    <div style="text-align:center;margin-top:14px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="recharge-close">完成 →</button></div>
  </div></div>`;
}
// 开包演出（doc25 §四）：展示抽到的卡 + 新得/重复转化结果。
export function gachaRevealBox(results: GachaResult[]): string {
  const OUT_CLR: Record<GachaResult['outcome'], string> = { new: 'var(--gold)', 'dup-shard': '#7fb0d8', 'dizhi-up': '#56be84', 'dizhi-shard': '#7fb0d8' };
  const cards = results.map((r) => {
    const clr = OUT_CLR[r.outcome];
    const isNew = r.outcome === 'new' || r.outcome === 'dizhi-up';
    return `<div class="reveal-card" style="border-color:${clr};box-shadow:0 0 16px ${clr}55"><div class="reveal-emoji">${r.kind === 'tiangang' ? '🎴' : '🀄'}</div><div class="reveal-name">${esc(r.name)}</div><div class="reveal-tag" style="color:${clr}">${isNew ? '✦ ' : ''}${esc(r.detail)}</div></div>`;
  }).join('');
  return `<div class="tut-ov" data-act="reveal-close"><div class="tut-box" data-stop="1" style="max-width:560px;text-align:center">
    <h2>🎴 开 包</h2>
    <div class="reveal-grid">${cards}</div>
    <div style="margin-top:14px"><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="reveal-close">收下 →</button></div>
  </div></div>`;
}

// 叙事演出 overlay（首启开场故事 doc28 §一 / 每关开局演出 doc27 §五 共用）：逐幕旁白 + 下一幕/跳过。
export function narrationBox(beats: StoryBeat[], idx: number, label: string, cta: string): string {
  const i = Math.max(0, Math.min(beats.length - 1, idx));
  const b = beats[i];
  const last = i >= beats.length - 1;
  const dots = beats.map((_, k) => `<span style="width:7px;height:7px;border-radius:50%;background:${k === i ? 'var(--gold)' : 'var(--panel-border)'}"></span>`).join('');
  return `<div class="tut-ov story-ov"><div class="tut-box story-box" data-stop="1">
    <div style="font-family:var(--fn);font-size:11px;letter-spacing:.18em;color:var(--gold);text-transform:uppercase">${esc(label)}</div>
    <div style="font-family:var(--fd);font-size:23px;color:var(--ink);margin:10px 0 16px">〔 ${esc(b.scene)} 〕</div>
    <div style="font-size:16px;line-height:2.05;color:var(--ink);min-height:104px">${esc(b.text)}</div>
    <div style="display:flex;align-items:center;gap:7px;margin:18px 0 14px">${dots}</div>
    <div style="display:flex;gap:10px;align-items:center"><button class="cta-sub" data-act="story-skip">跳过</button><div style="flex:1"></div><button class="cta-sub" style="color:#2a1a08;background:var(--gold-grad);border:0" data-act="story-next">${last ? esc(cta) : '下一幕 →'}</button></div>
  </div></div>`;
}

// 新手引导（doc28 §二 A/B/C · 线性·点对推进）：每步高亮一个锚点 + 一句话，点中该锚点的动作即进下一步。
// 高亮遮罩复用引擎通用 coachmark 能力（@renderer/coachmark 纯几何 + mountLobby 内薄 DOM 适配·OnboardingOverlay 同法）。教学关战斗本体=甲。
export const GUIDE_COACH: { anchor: string; text: string; advanceAct: string; advanceK?: string; placement: 'top' | 'bottom' }[] = [
  { anchor: 'help', text: '① 先翻一遍《玩法手册》——30 秒看懂怎么打（三路九格 · 每回合四选一 · 掷命对决）。点这里 📖', advanceAct: 'man', placement: 'bottom' },
  { anchor: 'decks', text: '② 配一套出战牌组——点这里进「我的牌组」。', advanceAct: 'tab', advanceK: 'decks', placement: 'bottom' },
  { anchor: 'autobuild-poker', text: '③ 点「✨一键自动构筑」，自动帮你凑 16 张扑克牌库。', advanceAct: 'autoBuildDeck', placement: 'bottom' },
  { anchor: 'tab-gang', text: '④ 再切到「⚡天罡战法」页配天罡。', advanceAct: 'deckTab', advanceK: 'gang', placement: 'bottom' },
  { anchor: 'autobuild-gang', text: '⑤ 点「✨一键配置天罡」，自动凑满天罡战法。', advanceAct: 'autoBuildTiangang', placement: 'bottom' },
  { anchor: 'home', text: '⑥ 配好了！点这里返回「大厅」。', advanceAct: 'tab', advanceK: 'home', placement: 'bottom' },
  { anchor: 'play', text: '⑦ 点「出征」打第一战——温泉关 · 列奥尼达（最易），解封你的第一缕英雄之魂！', advanceAct: 'play', placement: 'top' },
];
// 跳过引导确认对话框（owner 2026-06-20「首页加个跳过引导的对话框」）。
export function guideSkipDialog(): string {
  return `<div class="tut-ov"><div class="tut-box" data-stop="1" style="max-width:380px;text-align:center">
    <h3>跳过新手引导？</h3>
    <div class="note" style="margin-top:6px">老手可直接上手。你随时能在顶栏「↻ 引导」重新观看开场与引导。</div>
    <div style="display:flex;gap:10px;margin-top:18px"><button class="cta-sub" style="flex:1" data-act="guide-skip-cancel">继续引导</button><button class="cta-sub" style="flex:1;color:#2a1a08;background:var(--gold-grad);border:0" data-act="guide-skip-confirm">跳过</button></div>
  </div></div>`;
}

