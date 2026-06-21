import { World } from '@engine/core/world.js';
import type { IWorld } from '@engine/core/types.js';
import type { Coachmark, Flag } from '@engine/protocol/components.js';

// 战斗新手引导（甲·owner 2026-06-21·选「为 game-g 接 ECS coachmark 能力」）：用引擎通用 coachmark 能力
// (REQ-ARCH-COACH) 表达——线性·情境首触·首通即教，seen_* 进 save 看过不再弹。本模块只建「承载引导的小 World」
// + 步骤数据；驱动(game-g.tsx)按当前 step 置 Flag、玩家做对应操作即推进。纯表现·不进战斗 hash。
export interface BattleCoachStep { flag: string; anchor: string; text: string; on: 'draw' | 'deploy' | 'endturn' | 'cast'; needsTengang?: boolean }

// 步骤序列（doc28 §三教学序 + owner 2026-06-21 修「放牌断掉」bug）：抽牌 → 结束回合 → 放牌 → 再结束回合(推进/掷命) → 打天罡。
// 关键修正：原来**放牌打头**，但甲改「按点数收费」后，起手只有 1 源泉、起手 3 张牌可能都 ≥2 费 → **turn1 放不出 → 引导断掉**。
//   改成 doc28 §三的「先抽牌」：抽牌固定 1 费=起手源泉，**turn1 必可抽**；攒到 turn2 再放（点数小的兵免费/便宜·总能放出）。
//   动作**同回合互斥**（一回合只选一类·同类无限）→ 抽/放/打天罡之间都隔一个【结束回合】。cast 步仅当手里真有天罡才出（驱动按手牌活检·无则跳过·不卡死）。
export const BATTLE_COACH: readonly BattleCoachStep[] = [
  { flag: 'seen_combat_draw', anchor: 'combat-draw', text: '👉 第一步【抽牌】：花 1 点召唤源泉（右上角源泉）从牌库摸一张兵牌。每回合只能选一类动作（抽/放/打天罡/弃），同类可连做；源泉每回合自动 +1。', on: 'draw' },
  { flag: 'seen_combat_endturn', anchor: 'combat-end', text: '👉 点【结束回合】：源泉 +1、双方兵线一起推进一格。下回合就能放牌啦。', on: 'endturn' },
  { flag: 'seen_combat_deploy', anchor: 'combat-deploy', text: '👉 【放牌】：先点一张兵牌、再点一路（上/中/下）部署。按点数花源泉——**先放点数小的兵（2~4 点免费、5~7 点 1 费）**，源泉不够就先放便宜的。放完还能顺手翻一道机关门(箭头)调度兵线。', on: 'deploy' },
  { flag: 'seen_combat_endturn2', anchor: 'combat-end', text: '👉 再点【结束回合】：兵沿路前进一格，前锋相遇就触发【掷命对决】（比战力算胜率·正面活/反面亡）。', on: 'endturn' },
  { flag: 'seen_combat_tiangang', anchor: 'combat-cast', text: '👉 手里有天罡时点【打天罡】：施放持续战法、整局为你加成。看明白就毕业啦！', on: 'cast', needsTengang: true },
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
