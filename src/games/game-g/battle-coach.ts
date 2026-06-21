import { World } from '@engine/core/world.js';
import type { IWorld } from '@engine/core/types.js';
import type { Coachmark, Flag } from '@engine/protocol/components.js';

// 战斗新手引导（甲·owner 2026-06-21·选「为 game-g 接 ECS coachmark 能力」）：用引擎通用 coachmark 能力
// (REQ-ARCH-COACH) 表达——线性·情境首触·首通即教，seen_* 进 save 看过不再弹。本模块只建「承载引导的小 World」
// + 步骤数据；驱动(game-g.tsx)按当前 step 置 Flag、玩家做对应操作即推进。纯表现·不进战斗 hash。
export interface BattleCoachStep { flag: string; anchor: string; text: string; on: 'draw' | 'draw-poker' | 'draw-tengang' | 'deploy' | 'endturn' | 'cast' | 'roll'; needsTengang?: boolean }

// 步骤序列（doc28 §三 + owner 2026-06-21 重排）：抽天罗→抽扑克→结束 ▸ 打天罡→结束 ▸ 放牌→结束(推进/相遇) ▸ 点🎲掷骰看结果。
//   动作**同回合互斥**（一回合只选一类·同类无限）：抽天罡+抽扑克同属「抽」可连做；打天罡/放牌各自一回合 → 之间都隔【结束回合】。
//   掷骰步在掷命对决特写里出（高亮🎲钮）——驱动按 perfClash 在场+未揭晓时才显。
export const BATTLE_COACH: readonly BattleCoachStep[] = [
  { flag: 'seen_combat_draw_tg', anchor: 'combat-draw', text: '👉 第一步【抽牌】：点【抽牌】，再点【✦摸天罡】——先摸一张天罡战法（持续加成牌）。每回合只能选一类动作，同类可连做；源泉每回合 +1。', on: 'draw-tengang' },
  { flag: 'seen_combat_draw_pk', anchor: 'combat-draw', text: '👉 再点【🎴摸扑克】——摸一张扑克兵牌（上场打仗用）。抽牌同类可连摸，攒齐再行动。', on: 'draw-poker' },
  { flag: 'seen_combat_end1', anchor: 'combat-end', text: '👉 点【结束回合】：源泉 +1、双方兵线一起推进一格。下回合换别的动作。', on: 'endturn' },
  { flag: 'seen_combat_cast', anchor: 'combat-cast', text: '👉 这一轮【打天罡】：施放刚摸到的天罡战法，整局为你加成。', on: 'cast', needsTengang: true },
  { flag: 'seen_combat_end2', anchor: 'combat-end', text: '👉 再点【结束回合】，进入下一轮。', on: 'endturn' },
  { flag: 'seen_combat_deploy', anchor: 'combat-deploy', text: '👉 【放牌】：先点一张兵牌、再点一路（上/中/下）部署。按点数花源泉——先放点数小的兵（2~4 免费、5~7 收 1 费）。', on: 'deploy' },
  { flag: 'seen_combat_end3', anchor: 'combat-end', text: '👉 再点【结束回合】：兵沿路前进，前锋相遇就触发【掷命对决】。', on: 'endturn' },
  { flag: 'seen_combat_roll', anchor: 'combat-roll', text: '👉 点【🎲掷骰】掷命——看这一场的战斗结果（按胜率掷点·正面活/反面亡）。看明白就毕业啦！', on: 'roll' },
];

// 第一条未看过的引导步（全看过 → null）。needsTengang 步仅当手里真有天罡可打时才出（无 → 跳过·不卡死）。
export function nextCoachStep(seen: Record<string, boolean> | undefined, opts?: { hasTengang?: boolean }): BattleCoachStep | null {
  for (const s of BATTLE_COACH) {
    if (seen?.[s.flag]) continue;
    if (s.needsTengang && opts && !opts.hasTengang) continue; // 手里无天罡 → 跳过打天罡相关步
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
