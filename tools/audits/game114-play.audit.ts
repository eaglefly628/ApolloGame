import { mountUI, apolloOnyx } from '../../src/ui/components/index.js';
import { validateLayoutNode } from '../../src/ui/components/validate.js';
import { buildControls } from '../../handoffs/game114/mechanism-sample/controls-ui.js';
import type { ScenarioControlState } from '../../handoffs/game114/mechanism-sample/scenario-controls.js';

const state: ScenarioControlState = { oxen: 8, linesVisible: true, flowView: 'off',
  flowMarks: 0, occupancyMarks: 0, occupancyPenalty: 0 };
const tree = buildControls(state, true);
const issues = validateLayoutNode(tree);
if (issues.length) throw new Error(`game114 play HUD layout issues: ${JSON.stringify(issues)}`);
mountUI(document.getElementById('root')!, tree, {}, apolloOnyx);
