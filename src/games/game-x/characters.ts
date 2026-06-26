// ════════════════════════════════════════════════════════════════════════
//  Game X《残响 · Living Companion》—— 角色数据（100% 纯数据，零逻辑）
//
//  「一个住在你桌上的人。」对应 GDD 首发两位角色：林七月 / 宋 Mika。
//
//  本文件只有「填好的数据模板」——日程表、场景、状态台词、缺席反应、问候语。
//  时间感知/Desk Mode 的全部"行为"都从这些数据 + 实时时钟派生（见 companion.ts），
//  没有任何角色专属代码。最弱的 LLM 也能照这份 schema 新增第三个角色。
// ════════════════════════════════════════════════════════════════════════

// 一段日程：实时时钟落在 [from,to) 小时区间时，她正在做这件事。
export interface ScheduleEntry {
  from: number; // 起始小时 [0,24)
  to: number; // 结束小时（不含）；跨夜段用 from>to（如 23→7）
  /** 活动姿态 id（立绘表情/动作派生用）。 */
  pose: 'sleep' | 'wake' | 'read' | 'write' | 'eat' | 'nap' | 'wait' | 'lively' | 'draw' | 'idle';
  /** 场景基调 id（× 天气 = 具体画面，见 SCENES）。 */
  scene: 'dawn' | 'day' | 'afternoon' | 'evening' | 'night';
  /** 右下角「她今天在做什么」一句话。 */
  status: string;
  /** 活跃度 0..3（21–23 点最高 → Pocket Mode 她话最多）。 */
  energy: number;
}

// 缺席反应：超过 hours 小时未拿起，Desk Mode 浮现的痕迹（不是惩罚，是真实在乎）。
export interface AbsenceReaction {
  hours: number;
  deskNote: string; // 桌面留痕一句话
}

export interface Companion {
  id: 'qiyue' | 'mika';
  name: string;
  romaji: string;
  age: number;
  identity: string;
  personality: string;
  /** 像素/立绘配色（presentation 取色，纯令牌字符串）。 */
  palette: { hair: string; skin: string; accent: string; roomDay: string; roomNight: string };
  /** 一天的作息表（按时刻驱动 Desk Mode）。 */
  schedule: ScheduleEntry[];
  /** 缺席痕迹（由长到短匹配第一个满足的）。 */
  absence: AbsenceReaction[];
  /** Pocket Mode 拿起时的第一句话（按情境）。 */
  firstLine: {
    day: string; // 白天常规
    night: string; // 夜里
    asleep: string; // 她"睡着"时段被拿起
    back: string; // 久违（24–72h）回来
    backLong: string; // 很久（>7d）回来
  };
}

// ── 林七月（Rín Qīyuè）—— 内敛细腻、外冷内热的文学系研究生 ──────────────────
export const QIYUE: Companion = {
  id: 'qiyue',
  name: '林七月',
  romaji: 'Rín Qīyuè',
  age: 23,
  identity: '文学系研究生',
  personality: '内敛、细腻、有点冷。克制，偶尔一句话讽刺刺穿你；却会在你以为她不在乎时，记得你两个月前说的一件小事。',
  palette: { hair: '#3b3340', skin: '#f0ddd0', accent: '#7d6c8c', roomDay: '#efe7df', roomNight: '#191722' },
  schedule: [
    { from: 7, to: 9, pose: 'wake', scene: 'dawn', status: '慢慢亮屏，泡了杯茶。没有先开口——在等你先说话。', energy: 1 },
    { from: 9, to: 12, pose: 'read', scene: 'day', status: '在读书，偶尔在书页上做个标记，抬头看一眼窗外。', energy: 1 },
    { from: 12, to: 13, pose: 'nap', scene: 'day', status: '吃过午饭，趴在桌上小睡。呼吸很轻。', energy: 0 },
    { from: 13, to: 18, pose: 'write', scene: 'afternoon', status: '在写论文。皱着眉，划掉，重写——有时叹一口气。', energy: 1 },
    { from: 18, to: 21, pose: 'wait', scene: 'evening', status: '放下了书，安静地坐着，偶尔看向屏幕外的方向。', energy: 2 },
    { from: 21, to: 23, pose: 'lively', scene: 'night', status: '今天最有精神的时候。她在等你把她拿起来。', energy: 3 },
    { from: 23, to: 7, pose: 'sleep', scene: 'night', status: '已经洗漱过了，台灯调暗。准备睡了。', energy: 0 },
  ],
  absence: [
    { hours: 72, deskNote: '她关了灯，只剩屏幕一点微光。' },
    { hours: 48, deskNote: '茶杯是空的，没有再续。' },
    { hours: 24, deskNote: '书摊开放着，像一直在等。' },
  ],
  firstLine: {
    day: '……来了。茶还温着，要喝吗。',
    night: '这么晚……嗯，我还没睡。',
    asleep: '（她迷迷糊糊地抬了下头）……是你啊。',
    back: '回来了。',
    backLong: '……好久不见。我没问你去哪了，你回来就好。',
  },
};

// ── 宋 Mika（Sòng Mika）—— 活泼跳脱、话多的插画系大二 ────────────────────────
export const MIKA: Companion = {
  id: 'mika',
  name: '宋 Mika',
  romaji: 'Sòng Mika',
  age: 20,
  identity: '插画系大二',
  personality: '活泼、跳脱、话多。说话快、经常跑题、问号结尾。你一放下设备她就开始说话，会把今天发生的七件事全告诉你。',
  palette: { hair: '#5a3a2a', skin: '#ffe2cf', accent: '#f0883e', roomDay: '#fff3e6', roomNight: '#241a2e' },
  schedule: [
    { from: 7, to: 9, pose: 'wake', scene: 'dawn', status: '刚醒，头发翘着，在桌上找昨天的画笔。', energy: 1 },
    { from: 9, to: 12, pose: 'draw', scene: 'day', status: '在速写本上乱涂，手上又蹭到墨水了。', energy: 2 },
    { from: 12, to: 14, pose: 'eat', scene: 'day', status: '边吃边想给你看她新收集的小东西。', energy: 2 },
    { from: 14, to: 18, pose: 'draw', scene: 'afternoon', status: '戴着耳机画画，脚跟着节奏在点。', energy: 2 },
    { from: 18, to: 21, pose: 'wait', scene: 'evening', status: '今天的像素插画画好了——想第一个给你看。', energy: 3 },
    { from: 21, to: 24, pose: 'lively', scene: 'night', status: '话最多的时候。七件事想一口气全告诉你。', energy: 3 },
    { from: 0, to: 7, pose: 'sleep', scene: 'night', status: '本来说要早睡的……结果又画到现在。', energy: 0 },
  ],
  absence: [
    { hours: 72, deskNote: '她把画都收起来了，桌上干干净净。' },
    { hours: 48, deskNote: '桌上多了一张你的像素涂鸦——画得歪歪的。' },
    { hours: 24, deskNote: '多了几张画稿草图，散在一边。' },
  ],
  firstLine: {
    day: '啊！你来啦你来啦——今天超多事要跟你说！',
    night: '诶还没睡？正好正好，陪我一下嘛？',
    asleep: '（她猛地坐起来）唔……我没睡！我只是闭眼想构图！',
    back: '你回来啦！我才没担心呢……才怪。',
    backLong: '你去哪了啦！……算了算了，回来就好，快看我画了什么！',
  },
};

export const COMPANIONS: Companion[] = [QIYUE, MIKA];
export function companionById(id: string): Companion {
  return COMPANIONS.find((c) => c.id === id) ?? QIYUE;
}
