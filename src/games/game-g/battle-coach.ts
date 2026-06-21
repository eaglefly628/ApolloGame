import { World } from '@engine/core/world.js';
import type { IWorld } from '@engine/core/types.js';
import type { Coachmark, Flag } from '@engine/protocol/components.js';

// 战斗新手引导（甲·owner 2026-06-21·选「为 game-g 接 ECS coachmark 能力」）：用引擎通用 coachmark 能力
// (REQ-ARCH-COACH) 表达——线性·情境首触·首通即教，seen_* 进 save 看过不再弹。本模块只建「承载引导的小 World」
// + 步骤数据；驱动(game-g.tsx)按当前 step 置 Flag、玩家做对应操作即推进。纯表现·不进战斗 hash。
export interface BattleCoachStep { flag: string; anchor: string; text: string; on: 'draw' | 'deploy' | 'endturn' | 'cast' }

// 步骤序列（owner 2026-06-21 改流程）：第一回合先**放牌**(+顺手翻机关门) → **结束回合**(推进/掷命) → 第二回合**抽牌**(普通/天罡) → 打天罡。
// 自然手感：开局已有起手牌，先铺场再说；抽牌是第二回合补充。cast 步无天罡可跳过（驱动判定）。
export const BATTLE_COACH: readonly BattleCoachStep[] = [
  { flag: 'seen_combat_deploy', anchor: 'combat-deploy', text: '👉 第一步【放牌】：先点一张手牌，再点一路（上/中/下）把战士部署上去。按牌点数花源泉（小牌免费·大牌贵）·有源泉就能继续放；放完还能顺手翻一道机关门(箭头)调度兵线。', on: 'deploy' },
  { flag: 'seen_combat_endturn', anchor: 'combat-end', text: '👉 铺好场点【结束回合】：双方兵线一起推进一格，前锋相遇就触发【掷命对决】（正面活/反面亡）。', on: 'endturn' },
  { flag: 'seen_combat_draw', anchor: 'combat-draw', text: '👉 第二回合可【抽牌】：花 1 点召唤源泉（右上角源泉）从牌库摸一张——普通兵牌或天罡战法都能摸。源泉每回合自动 +1，悠着用。', on: 'draw' },
  { flag: 'seen_combat_tiangang', anchor: 'combat-cast', text: '👉 点【打天罡】：施放持续战法，整局为你加成。看明白就毕业啦！', on: 'cast' },
];

// 第一条未看过的引导步（全看过 → null）。
export function nextCoachStep(seen: Record<string, boolean> | undefined, opts?: { hasTengang?: boolean }): BattleCoachStep | null {
  for (const s of BATTLE_COACH) {
    if (seen?.[s.flag]) continue;
    if (s.on === 'cast' && opts && !opts.hasTengang) continue; // 无天罡 → 跳过天罡步
    return s;
  }
  return null;
}

// 建一个仅承载引导的小 World（一个 Coachmark + 驱动其可见的 Flag）。setStep 切换当前步/可见性。
export function makeCoachWorld(): { world: IWorld; setStep: (s: BattleCoachStep | null, visible: boolean) => void } {
  const world = new World();
  world.createEntity('coach-flag'); world.addComponent<Flag>('coach-flag', { type: 'Flag', id: 'combat_coach', active: false });
  world.createEntity('coach-mark'); world.addComponent<Coachmark>('coach-mark', { type: 'Coachmark', anchor: 'combat-deploy', text: '', visibleWhen: 'combat_coach', pad: 6, placement: 'auto' }); // auto：气泡放空间大的一侧·避免盖住顶部的结束回合钮
  const setStep = (s: BattleCoachStep | null, visible: boolean): void => {
    const flag = world.getComponent<Flag>('coach-flag', 'Flag'); const mark = world.getComponent<Coachmark>('coach-mark', 'Coachmark');
    if (!flag || !mark) return;
    if (s) { mark.anchor = s.anchor; mark.text = s.text; }
    flag.active = !!s && visible; // 当前步存在且当下该显（玩家可操作回合·非特写/忙）才亮
  };
  return { world, setStep };
}
