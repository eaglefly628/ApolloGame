// game108 角色配音 —— 走引擎 `VoicePort`（`docs/playbooks/audio.md`「角色语音」行）。
//
// owner 2026-08-07「给我做一下 AI 的配音」。手册指的路：游戏侧**只发纯数据事件**
// `{charId, event, text, params?}`，端口负责变成声音；降级链 ①TTS → ②采样 wav → ③兜底提示音 + 字幕。
// v1 用 `TtsVoicePort`（浏览器 `speechSynthesis`·**零资产零 key**），采样包将来真配音了再挂第二档。
//
// 红线（手册原文）：**表现层旁路·绝不碰 world / snapshot / hash** —— 语音不进 sim、不进录放、不进 lockstep。
// 所以它只由宿主在"看到世界变成什么样"之后触发，不参与任何判定。
//
// 台词是**数据表**：`事件 × 语言` 一张表，按卡片角色的**心情**挑语气（rate/pitch）。
// 台词内容将来由 GD 按卡片人设改写——改表不改代码。
import { TtsVoicePort, createVoiceChain, type VoicePort, type VoiceParams } from '@zerocraft/engine/services/voice/index.js';
import type { Lang } from './strings.js';
import type { Mood } from './card-character.js';

/** 事件键闭集（本作 spec·引擎那边收任意 string，闭集校验归消费方=我们）。 */
export type VoiceEvent =
  | 'roundStart'      // 新回合开场
  | 'foeFull'         // 对手某一手蓄满（最该出声的时刻：这是玩家要读的那份情报）
  | 'clash'           // 亮拳
  | 'foeWin'          // 对手赢了这回合
  | 'youWin'          // 你赢了这回合
  | 'gameWin'         // 你赢下整局
  | 'gameLose';       // 你输掉整局

/** 心情 → 语气（合成档靠 rate/pitch 差异化"音色"·手册 §0 口径）。 */
const MOOD_VOICE: Record<Mood, Pick<VoiceParams, 'rate' | 'pitch'>> = {
  stubborn: { rate: 0.92, pitch: 0.95 },   // 执拗：慢、平
  reckless: { rate: 1.18, pitch: 1.12 },   // 上头：快、高
  playful: { rate: 1.06, pitch: 1.18 },    // 玩心：轻快、上扬
  moody: { rate: 0.98, pitch: 0.88 },      // 阴晴不定：偏低、拖
  sharp: { rate: 1.02, pitch: 1.0 },       // 精明：不多不少
};

/**
 * 台词表（`事件 × 语言`）。写成**约会对象的口吻**，不是敌人的口吻——
 * 这游戏的对手是约会对象，说话该像在玩，不像在打架（owner 2026-08-07 定的定位）。
 */
const LINES: Record<VoiceEvent, Record<Lang, string>> = {
  roundStart: { zh: '来吧，看你这次出什么。', en: 'Come on, show me what you have.' },
  foeFull: { zh: '我可攒满了哦。', en: 'I am fully charged, you know.' },
  clash: { zh: '一、二、三！', en: 'One, two, three!' },
  foeWin: { zh: '看吧，我说中了。', en: 'See? I called it.' },
  youWin: { zh: '哎呀，被你看穿了。', en: 'Ah, you read me.' },
  gameWin: { zh: '这局算你赢，下次不让着你了。', en: 'You win this one. Next time I go all out.' },
  gameLose: { zh: '我赢啦——再来一局？', en: 'I win! One more round?' },
};

/**
 * 建一条语音链。没有 `speechSynthesis`（headless / 探针 / SSR）时 `TtsVoicePort` 自己返回 false，
 * 链走到底仍是 false —— 调用方据此接兜底（本作兜底 = 音效 + 屏上文字，见宿主）。
 */
export function createVoice(charId: string, mood: Mood, lang: Lang): {
  port: VoicePort;
  /** 说一句（返回 false = 这台机器发不出声，调用方该走兜底）。 */
  say: (event: VoiceEvent, l: Lang) => boolean;
  setLang: (l: Lang) => void;
  stop: () => void;
  dispose: () => void;
} {
  let cur = lang;
  const port = createVoiceChain([new TtsVoicePort()]);
  return {
    port,
    say: (event, l): boolean => port.speak({
      charId, event, text: LINES[event][l],
      params: { lang: l === 'zh' ? 'zh-CN' : 'en-US', ...MOOD_VOICE[mood] },
    }),
    setLang: (l): void => { cur = l; void cur; },
    stop: (): void => port.stop(),
    dispose: (): void => port.dispose(),
  };
}

/** 台词文本（给字幕兜底用——发不出声也要让玩家看见他说了什么）。 */
export const voiceLine = (event: VoiceEvent, lang: Lang): string => LINES[event][lang];
