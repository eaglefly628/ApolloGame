import { defineCapability } from '@engine/core/define-capability.js';
import type { Component, IWorld } from '@engine/core/types.js';
import type { ConditionExpr, State, Text, Flag, Resource, ResourceModify } from '@engine/protocol/components.js';
import { findByComponentId, getComponentById } from '@engine/core/query.js';
import { evaluateCondition } from '@skills/tier2/index.js';

// ═══════════════════════════════════════════════════════════════
//  dialogue —— 通用「叙事/对话运行器」共享模块（Tier 3 解释器型机制；R15）。
//
//  数据驱动旗舰：把原 game-b/dialogue-runner.ts（游戏专属代码）泛化为引擎通用 capability。
//  关键变化：**对话脚本不再是闭包注入的代码常量，而是世界里的一份数据组件 DialogueScript**。
//  任何 VN/RPG/Galgame 只喂一棵声明式对话图（JSON）+ 一个 State 游标，运行器读图驱动 state/text/effect。
//
//  为什么需要一个「解释器」而非现成 Condition→Event→Effect：
//    - effect-apply 只能 set-state 到**固定值**，做不到「跳到当前节点的 next」（next 是逐节点的数据依赖转移）；
//    - 无系统能「按 State.current 查脚本表 → 写 Text.content」（表驱动文本）。
//  对话运行器是这类「读数据图、推进游标、驱动派生状态」的图遍历解释器的第一个（周期表缺失的一格）。
//
//  数据流（与原 runner 等价，债已还清）：
//    DialogueAdvance（line 节点）→ State.current = node.next
//    DialogueChoose{index}（choice 节点）→ 校验 option.requires（条件树）→ 按 id 全局写 ResourceModify
//      + 置 Flag + State.current = option.next
//    每 tick → 按（可能已更新的）State.current 把当前节点文本写进 Text.content
//
//  定序（R10/R11）：诚实声明 reads:['State','Resource','Flag']，runsBefore:['resource-apply','state-sync']
//  打破 RMW 伪环；ResourceModify 按 resourceId 全局路由（resource-apply 结算）。确定性：只读/写确定状态。
// ═══════════════════════════════════════════════════════════════

// ── 对话脚本数据 schema（引擎的叙事数据契约；游戏只填这份 JSON）──────────────────
export interface DialogueEffect {
  resource: string; // 目标 Resource 的 id（按 id 全局路由）
  amount: number;
}
export interface DialogueChoiceOption {
  text: string;
  effects?: DialogueEffect[];
  setFlag?: string; // 目标 Flag 的 id
  next: string;
  requires?: ConditionExpr; // 出现/可选的条件门（检定/阈值解锁）
}
export type DialogueNode =
  | { kind: 'line'; speaker: string; emotion?: string; text: string; next: string | null }
  | { kind: 'choice'; speaker?: string; emotion?: string; prompt?: string; options: DialogueChoiceOption[] };
export type DialogueGraph = Record<string, DialogueNode>;

export const DIALOGUE_FSM = 'dialogue';

// ── 组件 ──────────────────────────────────────────────────────────────────
// 对话脚本（数据）：一棵声明式节点图 + 关联的状态机 id。挂在对话实体上（与 State/Text 同实体）。
export interface DialogueScript extends Component {
  readonly type: 'DialogueScript';
  fsmId: string; // 关联的对话状态机 id（= 同实体 State.fsmId）
  nodes: DialogueGraph; // 节点图（line/choice）
}
// 推进到下一节点的请求（read-then-consume）。
export interface DialogueAdvance extends Component {
  readonly type: 'DialogueAdvance';
}
// 选择某选项的请求（read-then-consume）。
export interface DialogueChoose extends Component {
  readonly type: 'DialogueChoose';
  index: number;
}

// 当前节点渲染成文本（line=「说话人：台词」；choice=「说话人 + 提示」）。
export function renderNodeText(node: DialogueNode): string {
  if (node.kind === 'line') return `${node.speaker}：${node.text}`;
  return `${node.speaker ?? ''}${node.prompt ?? ''}`;
}

// 选项是否可选：无 requires 恒真；有则按条件树求值（检定/阈值/flag 门控通用）。
export function optionAvailable(world: IWorld, opt: DialogueChoiceOption): boolean {
  return opt.requires === undefined || evaluateCondition(world, opt.requires);
}

// 便捷：按 id 取某资源当前值（UI 属性面板/测试读用）。
export function resourceValue(world: IWorld, id: string): number | undefined {
  return getComponentById<Resource>(world, 'Resource', 'id', id)?.current;
}

export const dialogueCapability = defineCapability({
  id: 't3-dialogue',
  version: '1.0.0',

  describe: {
    name: 'dialogue',
    summary: '数据驱动对话/叙事运行器：读 DialogueScript 节点图 + State 游标，推进节点、渲染当前行、选择结算（含 requires 条件门控 + effects/flag）。',
    semantic: ['tier3', 'narrative', 'dialogue', 'interpreter'],
    whenToUse:
      'VN/乙游/RPG 对话循环。给对话实体挂 DialogueScript{fsmId,nodes} + State + Text；UI 发 DialogueAdvance/DialogueChoose。整个剧情 = 一棵 JSON 节点图（数据），无游戏专属代码。',
    examples: [
      '推进：line 节点 + DialogueAdvance → State.current = node.next',
      '选择：DialogueChoose{index} → 校验 requires → ResourceModify(好感) + Flag + 跳转 option.next',
      '渲染：每 tick 按 State.current 把当前节点文本写进 Text.content',
    ],
  },

  components: {
    provides: {
      DialogueScript: {
        category: 'config',
        describe: '声明式对话节点图（数据）+ 关联状态机 id。nodes 为 {nodeId: line|choice} 的图。',
        fields: {
          fsmId: { type: 'string', describe: '关联的对话状态机 id（= 同实体 State.fsmId）' },
          nodes: { type: 'string', describe: '节点图 Record<nodeId, DialogueNode>（line: speaker/text/next；choice: options[{text,effects?,setFlag?,next,requires?}]）' },
        },
      },
      DialogueAdvance: { category: 'event', describe: '请求推进到下一对话节点（line 节点用）', fields: {} },
      DialogueChoose: {
        category: 'event',
        describe: '请求选择某个选项（choice 节点用）',
        fields: { index: { type: 'number', describe: '选项下标' } },
      },
    },
    reads: ['DialogueScript', 'State', 'Resource', 'Flag'],
    writes: ['State', 'Text', 'Flag', 'ResourceModify'],
    consumes: ['DialogueAdvance', 'DialogueChoose'],
  },

  config: {},

  systems: [
    {
      id: 'dialogue',
      reads: ['DialogueScript', 'State', 'Resource', 'Flag'],
      writes: ['State', 'Text', 'Flag', 'ResourceModify'],
      consumes: ['DialogueAdvance', 'DialogueChoose'],
      // R10：显式定序打破 RMW 伪环——本系统读 Resource/State 又产 ResourceModify、改 State，
      // 须排在 resource-apply（应用修改）与 state-sync（发切换事件）之前。
      runsBefore: ['resource-apply', 'state-sync'],
      execute(world: IWorld) {
        // 对话实体 = 同时挂 DialogueScript + State 且 fsmId 一致的实体（支持多对话机各跑各的脚本）。
        for (const [eid] of world.query('DialogueScript', 'State')) {
          const script = world.getComponent<DialogueScript>(eid, 'DialogueScript')!;
          const st = world.getComponent<State>(eid, 'State')!;
          if (st.fsmId !== script.fsmId) continue;
          const nodes = script.nodes;
          const node = nodes[st.current];
          if (!node) continue;

          // ① 处理输入事件 → 改 State.current
          if (world.hasComponent(eid, 'DialogueAdvance') && node.kind === 'line' && node.next) {
            st.current = node.next;
          }
          const choose = world.getComponent<DialogueChoose>(eid, 'DialogueChoose');
          if (choose && node.kind === 'choice') {
            const opt = node.options[choose.index];
            if (opt && optionAvailable(world, opt)) {
              // 每个效果的 ResourceModify 挂到它目标资源各自的实体上（按 id 定位，不假设命名）。
              // 各效果指向不同资源=不同实体，天然不互相覆盖；无孤儿实体（一实体一组件的约束见 R14）。
              for (const e of opt.effects ?? []) {
                const target = findByComponentId(world, 'Resource', 'id', e.resource);
                if (target) {
                  world.addComponent(target, { type: 'ResourceModify', resourceId: e.resource, amount: e.amount } as ResourceModify);
                }
              }
              if (opt.setFlag) {
                const fl = getComponentById<Flag>(world, 'Flag', 'id', opt.setFlag);
                if (fl) fl.active = true;
              }
              st.current = opt.next;
            }
          }

          // ② 按（可能已更新的）current 渲染 Text
          const shown = nodes[st.current];
          const txt = world.getComponent<Text>(eid, 'Text');
          if (shown && txt) txt.content = renderNodeText(shown);
        }
      },
    },
  ],
});
