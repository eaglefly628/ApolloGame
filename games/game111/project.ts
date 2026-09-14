// game111 —— 世界 → UI 投影（只读·纯函数·宿主层）。
//
// 为什么单独一层：UI 侧（`ui.ts`）**零世界访问**——它只吃 `TownView` 这样的 POD。
// 这样 UI 可以无世界单测（24 例里那几条就是），也不会有人在 LayoutNode 里偷偷读组件。
import type { IWorld } from '@zerocraft/engine/engine/core/types.js';
import type { Resource, State, Flag } from '@zerocraft/engine/engine/protocol/components.js';
import { recall } from '@zerocraft/engine/skills/tier2/memory.js';
import type { Intent } from '@zerocraft/engine/engine/protocol/agent.js';
import { NPCS, NEEDS, TITLES, AGENT_NPC_IDS, needId, zoneFsm, affinityId, titleFlag } from './world-data.js';
import { ACTION_TEXT, FEED_TEXT, labelOf, type TownView, type NpcView, type FeedItem } from './ui.js';

function resourceOf(world: IWorld, id: string): number {
  for (const [eid] of world.query('Resource')) {
    const r = world.getComponent<Resource>(eid, 'Resource');
    if (r?.id === id) return r.current;
  }
  return 0;
}
function stateOf(world: IWorld, fsmId: string): string {
  for (const [eid] of world.query('State')) {
    const s = world.getComponent<State>(eid, 'State');
    if (s?.fsmId === fsmId) return s.current;
  }
  return '';
}
function flagOn(world: IWorld, id: string): boolean {
  for (const [eid] of world.query('Flag')) {
    const f = world.getComponent<Flag>(eid, 'Flag');
    if (f?.id === id) return f.active;
  }
  return false;
}

/** 模板填空：`{o}` → 宾语人话。没有宾语就把 `{o}` 抹掉（不留空洞的花括号）。 */
export function fill(tpl: string, object?: string): string {
  return tpl.replace('{o}', labelOf(object));
}

const NAME_OF = new Map(NPCS.map((n) => [n.id, n.name]));

/** 把世界投影成一屏可渲染的数据。`lastTurn` = 上一回合的结算产物（用于「本回合做了什么」）。 */
export function buildTownView(
  world: IWorld,
  turn: number,
  lastTurn?: { resolved: readonly Intent[]; filled: readonly string[] },
  opts: { busy?: boolean; justUnlocked?: string } = {},
): TownView {
  const actionOf = new Map<string, { text: string; fallback: boolean }>();
  for (const it of lastTurn?.resolved ?? []) {
    const tpl = ACTION_TEXT[it.verb] ?? it.verb;
    actionOf.set(it.npcId, {
      text: fill(tpl, it.args?.[0] !== undefined ? String(it.args[0]) : undefined),
      fallback: (lastTurn?.filled ?? []).includes(it.npcId),
    });
  }

  const npcs: NpcView[] = AGENT_NPC_IDS.map((id): NpcView => {
    const needs: Record<string, number> = {};
    for (const n of NEEDS) needs[n.key] = resourceOf(world, needId(id, n.key));
    const act = actionOf.get(id);
    return {
      id,
      name: NAME_OF.get(id) ?? id,
      zone: stateOf(world, zoneFsm(id)),
      needs,
      affinity: resourceOf(world, affinityId(id)),
      ...(act ? { lastAction: act.text, fallback: act.fallback } : {}),
    };
  });

  // 小星书 = NPC 拿记忆发的帖（素材原话）。按强度取各人 top-3，合并后按回合降序。
  const feed: FeedItem[] = [];
  for (const id of AGENT_NPC_IDS) {
    for (const m of recall(world, `npc-${id}`, { k: 3, now: turn })) {
      const tag = m.tags[0] ?? 'talk';
      feed.push({
        id: m.id,
        who: NAME_OF.get(id) ?? id,
        text: fill(FEED_TEXT[tag] ?? FEED_TEXT.talk, m.object),
        turn: m.turn,
        strength: m.strength,
        source: m.source,
      });
    }
  }
  // 回合降序；同回合按条目 id 升序兜底（确定性·不留「同分看谁先来」）。
  feed.sort((a, b) => (b.turn - a.turn) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    turn,
    npcs,
    feed,
    titles: TITLES.filter((t) => flagOn(world, titleFlag(t.id))).map((t) => t.id),
    ...(opts.justUnlocked !== undefined ? { justUnlocked: opts.justUnlocked } : {}),
    ...(opts.busy === true ? { busy: true } : {}),
  };
}
