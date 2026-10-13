import { mountUI, apolloOnyx } from '../../src/ui/components/index.js';
import { buildControls } from '../../handoffs/game114/mechanism-sample/controls-ui.js';

mountUI(document.getElementById('root')!, buildControls({ oxen: 32, linesVisible: true, flowView: 'vertical', flowMarks: 84, occupancyMarks: 240 }), {}, apolloOnyx);
