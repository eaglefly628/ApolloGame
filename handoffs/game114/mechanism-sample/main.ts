import {Engine} from '@zerocraft/engine/runtime/engine.js';
import {ThreeRenderer} from '@zerocraft/engine/renderer/three-renderer.js';
import {AssetManager,ModelAssetLoader,ImageAssetLoader,parseAssetIndex,registerAssetIndex} from '@zerocraft/engine/assets/index.js';
import {sampleBlueprint} from './scene';
import {gardenBlueprint,gardenCoverage} from './garden-scene';
import {playBlueprint,playCartId} from './play-scene';
import gardenAssets from './garden-assets.json';
import {KeyboardInputSource} from '@zerocraft/engine/net/host/local-input.js';
import {mountUI,apolloOnyx} from '@zerocraft/engine/ui/components/index.js';
import {buildControls} from './controls-ui';
import {ScenarioControls} from './scenario-controls';
const scene=new URLSearchParams(location.search).get('scene');
const stress=scene==='stress', garden=scene==='garden', play=!stress&&!garden;
const blueprint=stress?sampleBlueprint:garden?gardenBlueprint:playBlueprint;
const entities=blueprint.entities;
const ml=new ModelAssetLoader(),il=new ImageAssetLoader();
const assets=new AssetManager({load:d=>d.kind==='model'?ml.load(d):il.load(d)});
assets.register({kind:'texture',key:'mechanism/grass',src:'textures/grass.png',colorSpace:'srgb'});
registerAssetIndex(assets,parseAssetIndex(gardenAssets));
if(stress)entities['block-0'].Material3D={preset:'matte',shading:'toon',toonSteps:3,map:'mechanism/grass',tiling:{repeat:12}};
for(const key of ['turtle','house','tree','rock','ox','pickup'])assets.register({kind:'model',key:'mechanism/'+key,src:'models/'+key+'.glb'});
await assets.loadAll();
const input=play?new KeyboardInputSource('p1'):undefined;
const engine=new Engine({input});engine.load(blueprint);
const host=document.getElementById('stage')!;
const renderer=new ThreeRenderer({width:innerWidth,height:innerHeight,background:stress?0x95a76c:0xb8ab84,assets,dprCap:1.5,shadowMapSize:4096});
engine.attachRenderer(renderer,host);engine.start();
const controls=new ScenarioControls(engine.world,play?36:64,play,play?'play':garden?'garden':'stress');
const uiHost=document.getElementById('controls')!;
const ui=mountUI(uiHost,buildControls(controls.state,play),{},apolloOnyx,{
  enqueueAction(name){controls.dispatch(name);ui.update(buildControls(controls.state,play));sampleInfo.agentCount=controls.state.oxen;sampleInfo.linesVisible=controls.state.linesVisible;sampleInfo.flowView=controls.state.flowView;sampleInfo.flowMarks=controls.state.flowMarks;sampleInfo.occupancyMarks=controls.state.occupancyMarks;},
});
const unsubscribe=engine.subscribe(()=>{if(controls.ensureFlowView()){ui.update(buildControls(controls.state,play));sampleInfo.flowMarks=controls.state.flowMarks;sampleInfo.occupancyMarks=controls.state.occupancyMarks;}});
// Lifecycle diagnostics for automated browser verification, no sim modifications.
const sampleInfo={engine:'ApolloGame ThreeRenderer',scene:play?'nine-tile crossing patrol':garden?'storybook garden stress':'open stress field',modelCount:6,entityCount:Object.keys(entities).length,agentCount:controls.state.oxen,linesVisible:controls.state.linesVisible,flowView:controls.state.flowView,flowMarks:controls.state.flowMarks,occupancyMarks:controls.state.occupancyMarks,blockedPercent:stress?0:100*gardenCoverage.blockedCells/gardenCoverage.totalCells,camera:play?'30-degree tilted orthographic':'15-degree tilted orthographic',animation:play?'NPC PathFollow + ORCA':'GLB walk + PathFollow / ORCA',navigation:'cost-aware grid with static cottage collision, soft dynamic occupancy and A* route rejoin',playCartId:play?playCartId:null};
Object.assign(window,{sampleReady:true,sampleInfo});
addEventListener('resize',()=>renderer.resize(innerWidth,innerHeight));
addEventListener('pagehide',()=>{unsubscribe();ui();input?.dispose();engine.stop();renderer.destroy();},{once:true});
