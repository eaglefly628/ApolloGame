// dokiworld/game108 · SDK 接线层（薄·**零玩法逻辑**·手册 dokiworld-pack.md「薄接线零规则」）。
// 只做两个投影：启动参数 → 游戏配置（locale/卡片角色），终局机读态 → GameResult。
// 玩法一概在 games/game108 的 blueprint 数据 + 引擎能力里；本文件不写一条规则。
import { createAppClient } from '@dokiworld/app-sdk';
import { createGameResult } from '@dokiworld/app-sdk/game-result';
import { mount, setCard, setWorldObserver } from '../../../games/game108/index.js';
import { fromPlatformCard, MOODS, type Mood } from '../../../games/game108/card-character.js';
import { saveLang } from '../../../games/game108/strings.js';
import { toGameResult } from './to-game-result.mjs';

const APP_ID = 'game108';

/**
 * input contract `doki.game.game108-input/1`（本 App 自定·manifest.runtime.input）：
 *   { card?: PlatformCharacterDraft 形状的平台角色卡, mood?: 五心情之一 }
 * 全部可缺省：缺卡 = 游戏内置兜底卡；坏卡（桥判 usable:false）同缺省——绝不因输入炸屏。
 */
interface Game108Input {
  card?: Record<string, unknown>;
  mood?: string;
}

// manifest.runtime.extensions = []，此处对应**不声明任何 extension**（规范 §5：两边必须一致）。
const app = createAppClient<Game108Input>({ appId: APP_ID });

type Projection = ReturnType<typeof toGameResult>;
let latest: Projection | undefined;   // 最近一帧的机读投影（onPrepareExit 报「当时分」用）
let completed = false;                // complete 只发一次（协议按 resultId 去重·SDK 负责重试）

app.connect({
  onInit: ({ locale, input }) => {
    // 投影①：locale → 游戏语言（游戏自己从 localStorage 读，同真 UI 的语言开关一条路）。
    saveLang(String(locale ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh');
    // 投影②：平台角色卡 → 对局角色（走引擎卡桥 fromPlatformCard，不自己解析平台字段）。
    const data = input?.data ?? {};
    const mood: Mood = (MOODS as readonly string[]).includes(data.mood ?? '') ? (data.mood as Mood) : 'stubborn';
    if (data.card && typeof data.card === 'object') {
      const { card, usable } = fromPlatformCard(data.card as never, mood);
      if (usable) setCard(card);
    }
    // 投影③：终局机读态 → GameResult。观察口每帧递一次 world（只读·与验收剧本同读法），
    // GameFlow 走到 p1win/p2win 那一帧 complete 一次。
    setWorldObserver((world) => {
      latest = toGameResult(world);
      if (latest.terminal && !completed) {
        completed = true;
        void app.complete(createGameResult({
          normalizedScore: latest.normalizedScore,
          outcome: latest.outcome,
          metrics: latest.metrics,
        })).catch(() => { /* ack 超时由 SDK 重试语义兜底；接线层不再造第二套重试 */ });
      }
    });
    document.querySelector('#standby')?.remove();
    const stage = document.querySelector('#stage');
    if (stage instanceof HTMLElement) mount(stage);
  },
  // 中途退出：报 exited + 当时分（规范 §8）。已正常 complete 过就不再带 output（不双报）。
  onPrepareExit: () => ({
    isDirty: false,
    canSuspend: false,
    ...(completed || !latest ? {} : {
      output: createGameResult({
        normalizedScore: latest.normalizedScore,
        outcome: 'exited',
        metrics: latest.metrics,
      }),
    }),
  }),
});
