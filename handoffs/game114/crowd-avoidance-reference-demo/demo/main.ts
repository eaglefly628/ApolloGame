import {Engine} from '@zerocraft/engine/runtime/engine.js';
import {ThreeRenderer} from '@zerocraft/engine/renderer/three-renderer.js';
import {AssetManager,ModelAssetLoader,ImageAssetLoader} from '@zerocraft/engine/assets/index.js';
import {sampleBlueprint} from './scene';
import {mountUI,apolloOnyx} from '@zerocraft/engine/ui/components/index.js';
import {buildControls} from './controls-ui';
import {ScenarioControls} from './scenario-controls';
const entities=sampleBlueprint.entities;
const ml=new ModelAssetLoader(),il=new ImageAssetLoader();
const assets=new AssetManager({load:d=>d.kind==='model'?ml.load(d):il.load(d)});
assets.register({kind:'texture',key:'mechanism/grass',src:'textures/grass.png',colorSpace:'srgb'});
entities['block-0'].Material3D={preset:'matte',shading:'toon',toonSteps:3,map:'mechanism/grass',tiling:{repeat:12}};
for(const key of ['turtle','house','tree','rock','ox','pickup'])assets.register({kind:'model',key:'mechanism/'+key,src:'models/'+key+'.glb'});
await assets.loadAll();
const engine=new Engine();engine.load(sampleBlueprint);
const host=document.getElementById('stage')!;
const renderer=new ThreeRenderer({width:innerWidth,height:innerHeight,background:0x95a76c,assets,dprCap:1.5,shadowMapSize:4096});
engine.attachRenderer(renderer,host);engine.start();
const controls=new ScenarioControls(engine.world);
const uiHost=document.getElementById('controls')!;
const ui=mountUI(uiHost,buildControls(controls.state),{},apolloOnyx,{
  enqueueAction(name){controls.dispatch(name);ui.update(buildControls(controls.state));sampleInfo.agentCount=controls.state.oxen;sampleInfo.linesVisible=controls.state.linesVisible;sampleInfo.flowView=controls.state.flowView;sampleInfo.flowMarks=controls.state.flowMarks;sampleInfo.occupancyMarks=controls.state.occupancyMarks;},
});
const unsubscribe=engine.subscribe(()=>{if(controls.ensureFlowView()){ui.update(buildControls(controls.state));sampleInfo.flowMarks=controls.state.flowMarks;sampleInfo.occupancyMarks=controls.state.occupancyMarks;}});
// Lifecycle diagnostics for automated browser verification, no sim modifications.
const sampleInfo={engine:'ApolloGame ThreeRenderer',modelCount:6,entityCount:Object.keys(entities).length,agentCount:controls.state.oxen,linesVisible:controls.state.linesVisible,flowView:controls.state.flowView,flowMarks:controls.state.flowMarks,occupancyMarks:controls.state.occupancyMarks,camera:'fixed orthographic',animation:'GLB walk + PathFollow / ORCA',navigation:'static cost-aware corridor FlowField; soft dynamic occupancy affects A* route rejoin only; 16 oxen and one cart'};
Object.assign(window,{sampleReady:true,sampleInfo});
addEventListener('resize',()=>renderer.resize(innerWidth,innerHeight));
addEventListener('pagehide',()=>{unsubscribe();ui();engine.stop();renderer.destroy();},{once:true});
