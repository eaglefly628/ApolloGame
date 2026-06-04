import { defineCapability } from '@engine/core/define-capability.js';
import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import type { IWorld, Component } from '@engine/core/types.js';
import type { State, Text, Flag, ResourceModify } from '@engine/protocol/components.js';
import type { DialogueScript, DialogueNode } from './data/dialogue.js';

// ═══════════════════════════════════════════════════════════════
//  对话运行器 —— Game B 游戏层胶水（不属引擎/共享层）。
//  验证命题：state + resource + flag + text 四个现成原子，靠这一层薄胶水
//  就能涌现出一个 VN 核心循环（推进对话 / 选择 / 好感结算 / 分支跳转）。
//
//  数据流（全部走现成原子的事件链，runner 不私存任何可变状态）：
//    DialogueAdvance → 改 State.current（state-sync 随后发 StateChanged）
//    DialogueChoose  → 写 ResourceModify(好感) [resource-apply 结算] + 置 Flag + 跳转
//    每 tick → 按 State.current 把当前行写进 Text.content
// ═══════════════════════════════════════════════════════════════

export const DIALOGUE_FSM = 'dialogue';

// 游戏层一次性事件（非引擎组件）：UI/测试注入到 dialogue 实体，runner consume 后 World 自动删除。
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

export function createDialogueRunnerCapability(script: DialogueScript): CapabilityDefinition {
  return defineCapability({
    id: 'gameb-dialogue-runner',
    version: '0.1.0',
    describe: {
      name: 'dialogue-runner',
      summary: '数据驱动对话运行器：按 State 推进节点、渲染当前行、选择结算好感/flag/分支。',
      semantic: ['narrative', 'dialogue', 'glue'],
      whenToUse: 'VN/乙游对话循环。Game B 游戏层胶水，用现成原子组合，不碰引擎。',
      examples: [
        '推进：DialogueAdvance → State.current = node.next',
        '选择：DialogueChoose{index} → ResourceModify(好感) + Flag + 跳转',
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
      // runner 是 dialogue State 的权威写者（读自身写入），故 reads 留空以免与 state-sync 在 State 上判成环。
      reads: [],
      writes: ['State', 'Text', 'Flag', 'ResourceModify'],
      consumes: ['DialogueAdvance', 'DialogueChoose'],
    },
    config: {},
    systems: [
      {
        id: 'dialogue-runner',
        reads: [],
        writes: ['State', 'Text', 'Flag', 'ResourceModify'],
        consumes: ['DialogueAdvance', 'DialogueChoose'],
        execute(world: IWorld) {
          // 定位对话状态机实体
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
            if (opt) {
              for (const e of opt.effects ?? []) {
                // 资源实体存在才发修改事件（约定 entityId === resourceId）；resource-apply 随后结算。
                if (world.getComponent(e.resource, 'Resource')) {
                  const mod: ResourceModify = { type: 'ResourceModify', resourceId: e.resource, amount: e.amount };
                  world.addComponent(e.resource, mod);
                }
              }
              if (opt.setFlag) {
                const fl = world.getComponent<Flag>(opt.setFlag, 'Flag');
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
