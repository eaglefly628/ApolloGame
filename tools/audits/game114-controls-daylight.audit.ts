import { mountUI } from '../../src/ui/components/index.js';
import { daylight } from '../../games/game-i/themes.js';
import { buildControls } from '../../handoffs/game114/mechanism-sample/controls-ui.js';

mountUI(document.getElementById('root')!, buildControls({ oxen: 32, linesVisible: true, flowView: 'vertical', flowMarks: 84, occupancyMarks: 240 }), {}, daylight);
