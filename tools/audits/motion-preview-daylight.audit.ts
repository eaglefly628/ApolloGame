import { motionPreviewTheme } from '../motion-preview/theme.js';
import { mountUI } from '../../src/ui/components/index.js';
import { buildPreview } from '../motion-preview/layout.js';
const daylight = true;
mountUI(document.getElementById('root')!,buildPreview({skins:[{id:'Y Bot',status:'draft'},{id:'Amy',status:'draft'}],clips:Array.from({length:2445},(_,index)=>({id:`synthetic-${String(index+1).padStart(4,'0')}`,status:'draft',source:{mixamoName:`合成动作 ${index+1}`,description:index%2?'Walking forward':'Standing idle'}})),query:'',category:'',emotion:'',page:0,paused:false,message:'',viewportWidth:document.getElementById('root')!.clientWidth || window.innerWidth}),{},motionPreviewTheme(daylight));
