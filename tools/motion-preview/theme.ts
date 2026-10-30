import {workbenchTheme} from '../motion-workbench/theme.js';
import { apolloBrocade, type UITheme } from '../../src/ui/components/index.js';
/** Keep the house skin; readable control text uses the house foreground on daylight surfaces. */
export function motionPreviewTheme(daylight = false): UITheme {
  return daylight ? {...apolloBrocade, sub:apolloBrocade.text, jade:apolloBrocade.text} : workbenchTheme();
}
