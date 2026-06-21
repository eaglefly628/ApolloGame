import { World } from '@engine/core/world.js';
import type { IWorld } from '@engine/core/types.js';
import type { Coachmark, Flag } from '@engine/protocol/components.js';

// 战斗新手引导（甲·owner 2026-06-21·选「为 game-g 接 ECS coachmark 能力」）：用引擎通用 coachmark 能力
// (REQ-ARCH-COACH) 表达——线性·情境首触·首通即教，seen_* 进 save 看过不再弹。本模块只建「承载引导的小 World」
// + 步骤数据；驱动(game-g.tsx)按当前 step 置 Flag、玩家做对应操作即推进。纯表现·不进战斗 hash。
export interface BattleCoachStep { flag: string; anchor: string; text: string; on: 'draw' | 'deploy' | 'endturn' | 'cast' }

// 步骤序列（教 抽牌(+能量) → 放牌 → 推进/掷命 → 打天罡·一路点到底）。cast 步无天罡可跳过（驱动判定）。
export const BATTLE_COACH: readonly BattleCoachStep[] = [
  { flag: 'seen_combat_draw', anchor: 'combat-draw', text: '👉 先点【抽牌】：花 1 点召唤源泉从牌库摸一张牌。源泉=你的能量，每回合自动 +1（看左下能量条），悠着用。', on: 'draw' },
  { flag: 'seen_combat_deploy', anchor: 'combat-deploy', text: '👉 点【放牌】：先选一张手牌，再点一路，把战士部署到放牌区（免费·有牌就能一直放）。', on: 'deploy' },
  { flag: 'seen_combat_endturn', anchor: 'combat-end', text: '👉 点【结束回合】：双方兵线一起推进，前锋相遇就触发【掷命对决】。', on: 'endturn' },
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
