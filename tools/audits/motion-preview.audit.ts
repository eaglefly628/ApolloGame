import { mountUI, apolloOnyx, apolloBrocade } from '../../src/ui/components/index.js';
import { buildPreview } from '../motion-preview/layout.js';
const daylight = new URLSearchParams(location.search).has('daylight');
mountUI(document.getElementById('root')!,buildPreview({skins:[{id:'Y Bot',status:'draft'},{id:'Amy',status:'draft'}],clips:['idle','walk','reach'].map(id=>({id,status:'draft',descZh:'基础动作，等待视觉复核。',category:'idle',emotion:['neutral'],tags:[]})),query:'',category:'',emotion:'',page:0,paused:false,message:''}),{},daylight?apolloBrocade:apolloOnyx);
