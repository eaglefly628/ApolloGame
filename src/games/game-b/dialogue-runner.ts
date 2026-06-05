import { defineCapability } from '@engine/core/define-capability.js';
import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import type { IWorld, Component } from '@engine/core/types.js';
import type { State, Text, Flag, Resource, ResourceModify } from '@engine/protocol/components.js';
import { evaluateCondition } from '@skills/tier2/index.js';
import type { DialogueScript, DialogueNode, ChoiceOption } from './data/dialogue.js';

// ═══════════════════════════════════════════════════════════════
//  对话运行器 —— Game B 游戏层胶水（不属引擎/共享层）。
//  v0.2：选项条件门控（检定/阈值解锁），全走现成原子；技术债已还清。
//
//  数据流：
//    DialogueAdvance → 改 State.current（state-sync 随后发 StateChanged）
//    DialogueChoose  → 校验选项 requires(条件树) → 写 ResourceModify(按 id 全局路由) + 置 Flag + 跳转
//    每 tick → 按 State.current 把当前行写进 Text.content
//
//  债务清算（用主程新落地的正规接口，不再 hack）：
//    R10：诚实声明 reads:['State','Resource','Flag']，用 runsBefore 显式定序打破 RMW 伪环
//         （读 Resource 做门控 + 写 ResourceModify 给 resource-apply，本会成环 → runsBefore 解）。
//    R11：ResourceModify 按 resourceId 全局路由（scope:'global'），不再假设 entityId===resourceId。
// ═══════════════════════════════════════════════════════════════

export const DIALOGUE_FSM = 'dialogue';

export interface DialogueAdvance extends Component {
  readonly type: 'DialogueAdvance';
}
export interface DialogueChoose extends Component {
  readonly type: 'DialogueChoose';
  index: number;
}

export function renderNodeText(node: DialogueNode): string {
  if (node.kind === 'line') return `${node.speaker}：${node.text}`;
  return `${node.speaker ?? ''}${node.prompt ?? ''}`;
}

// 选项是否可选：无 requires 恒真；有则按条件树求值（检定/阈值/flag 门控通用）。
export function optionAvailable(world: IWorld, opt: ChoiceOption): boolean {
  return opt.requires === undefined || evaluateCondition(world, opt.requires);
}

export function createDialogueRunnerCapability(script: DialogueScript): CapabilityDefinition {
  return defineCapability({
    id: 'gameb-dialogue-runner',
    version: '0.2.0',
    describe: {
      name: 'dialogue-runner',
      summary: '数据驱动对话运行器：推进节点、渲染当前行、选择结算（含 requires 条件门控）。',
      semantic: ['narrative', 'dialogue', 'glue'],
      whenToUse: 'VN/乙游对话循环。Game B 游戏层胶水，用现成原子组合，不碰引擎。',
      examples: [
        '推进：DialogueAdvance → State.current = node.next',
        '选择：DialogueChoose{index} → 校验 requires → ResourceModify(好感) + Flag + 跳转',
      ],
    },
    components: {
      provides: {
        DialogueAdvance: { category: 'event', describe: '请求推进到下一对话节点', fields: {} },
        DialogueChoose: {
          category: 'event',
          describe: '请求选择某个选项',
          fields: { index: { type: 'number', describe: '选项下标' } },
        },
      },
      // 诚实声明：读 State(推进/渲染) + Resource/Flag(门控求值)；写 State/Text/Flag/ResourceModify。
      reads: ['State', 'Resource', 'Flag'],
      writes: ['State', 'Text', 'Flag', 'ResourceModify'],
      consumes: ['DialogueAdvance', 'DialogueChoose'],
    },
    config: {},
    systems: [
      {
        id: 'dialogue-runner',
        reads: ['State', 'Resource', 'Flag'],
        writes: ['State', 'Text', 'Flag', 'ResourceModify'],
        consumes: ['DialogueAdvance', 'DialogueChoose'],
        // R10：显式定序打破 RMW 伪环——本系统读 Resource/State 又产 ResourceModify、改 State，
        // 须排在 resource-apply(应用修改) 与 state-sync(发切换事件) 之前。
        runsBefore: ['resource-apply', 'state-sync'],
        execute(world: IWorld) {
          let dlgId: string | undefined;
          for (const [id] of world.query('State')) {
            const s = world.getComponent<State>(id, 'State');
            if (s && s.fsmId === DIALOGUE_FSM) {
              dlgId = id;
              break;
            }
          }
          if (!dlgId) return;
          const st = world.getComponent<State>(dlgId, 'State')!;
          const node = script[st.current];
          if (!node) return;

          // ① 处理输入事件 → 改 State.current
          if (world.hasComponent(dlgId, 'DialogueAdvance') && node.kind === 'line' && node.next) {
            st.current = node.next;
          }
          const choose = world.getComponent<DialogueChoose>(dlgId, 'DialogueChoose');
          if (choose && node.kind === 'choice') {
            const opt = node.options[choose.index];
            if (opt && optionAvailable(world, opt)) {
              // 每个效果的 ResourceModify 挂到它目标资源自己的实体上（按 id 定位，不假设命名）。
              // 各效果指向不同资源=不同实体，天然不互相覆盖；无孤儿实体。（一实体一组件的约束见 R14）
              for (const e of opt.effects ?? []) {
                const target = findResourceEntity(world, e.resource);
                if (target) {
                  const mod: ResourceModify = { type: 'ResourceModify', resourceId: e.resource, amount: e.amount };
                  world.addComponent(target, mod);
                }
              }
              if (opt.setFlag) {
                const fl = findFlag(world, opt.setFlag);
                if (fl) fl.active = true;
              }
              st.current = opt.next;
            }
          }

          // ② 按（可能已更新的）current 渲染 Text
          const shown = script[st.current];
          const txt = world.getComponent<Text>(dlgId, 'Text');
          if (shown && txt) txt.content = renderNodeText(shown);
        },
      },
    ],
  });
}

function findFlag(world: IWorld, id: string): Flag | undefined {
  for (const [e] of world.query('Flag')) {
    const f = world.getComponent<Flag>(e, 'Flag');
    if (f && f.id === id) return f;
  }
  return undefined;
}

function findResourceEntity(world: IWorld, id: string): string | undefined {
  for (const [e] of world.query('Resource')) {
    const r = world.getComponent<Resource>(e, 'Resource');
    if (r && r.id === id) return e;
  }
  return undefined;
}

// 便捷：按 id 取某资源当前值（UI/测试读属性面板用）。
export function resourceValue(world: IWorld, id: string): number | undefined {
  for (const [e] of world.query('Resource')) {
    const r = world.getComponent<Resource>(e, 'Resource');
    if (r && r.id === id) return r.current;
  }
  return undefined;
}
