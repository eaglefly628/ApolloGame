// Sample host only: the world and all visual motion are engine component data.
import type {WorldBlueprint} from '@zerocraft/engine/assembly/demo.assembly.js';
import navigation from './navigation.json';
import { navigationGridCapability } from '@zerocraft/engine/skills/tier2/navigation-grid.js';
import { crowdAvoidanceCapability } from '@zerocraft/engine/skills/tier2/crowd-avoidance.js';
import { pathfindCapability } from '@zerocraft/engine/skills/tier2/pathfind.js';
import { faceRotateCapability } from '@zerocraft/engine/skills/tier2/face-rotate.js';
import { pathFollowCapability } from '@zerocraft/engine/skills/tier2/path-follow.js';
import { motionApplyCapability } from '@zerocraft/engine/skills/tier1/motion-apply.js';
import { collisionResolveCapability } from '@zerocraft/engine/skills/tier2/collision-resolve.js';
import { overlapDetectCapability } from '@zerocraft/engine/atom-skills/overlap-detect/index.js';
const entities:WorldBlueprint['entities']=navigation.entities as WorldBlueprint['entities'];
let seq=0;
function block(x:number,y:number,z:number,w:number,h:number,d:number,color:number){entities['block-'+seq++]={Transform3D:{x,y,z},Mesh3D:{shape:'box',width:w,height:h,depth:d},Material3D:{preset:'matte',color,shading:'toon',toonSteps:3}};}
function model(key:string,x:number,z:number,scale=1,rotY=0){const id=key+'-'+seq++;entities[id]={Transform3D:{x,y:0,z,rotY,scale},Model3D:{modelKey:'mechanism/'+key}};return id;}
function vectorLines(id:string){const prefix='crowd-vector-'+id;
 for(const [name,color,width,opacity] of [['desired',0x38d8ff,.055,.95],['raw',0xffa53d,.035,.72],['actual',0x7aff75,.065,.98],['avoid',0xf96bdb,.045,.92]] as const)
  entities[prefix+':'+name]={Line3D:{points:[],color,width,opacity}};
 return prefix;}
entities.camera={Camera3D:{yaw:.32,pitch:.83,distance:62,projection:'ortho',orthoSize:16,pivotX:0,pivotY:0,pivotZ:0,near:.1,far:160}};
entities.sun={Light3D:{kind:'directional',color:0xfff1d8,intensity:1.6,castShadow:true}};
entities.fill={Light3D:{kind:'ambient',color:0xdce6ff,intensity:.65}};
block(0,-.3,0,65,.5,65,0x95a76c);
block(0,-.015,-13,70,.1,7,0x5b9ba6);
block(-1,.012,0,4,.03,33,0xc5a16a);
block(0,.014,0,30,.03,3.5,0xb99a68);
// Low timber bridge and rails; scene dressing uses Mesh3D + toon material.
block(-1,.2,-13,4,.35,9,0xa47b48);
for(const x of [-3,1]){block(x,.8,-13,.15,.13,9,0x735235);for(const z of [-16,-14,-12,-10])block(x,.5,z,.13,1,.13,0x735235);}
for(const [x,z]of [[-14,-4],[-18,-5],[-17,-.7]])model('house',x,z,1.05,-.2);
for(const [x,z,w,d]of [[-13,11,8,5],[15,-8,7,4]]){block(x,.02,z,w,.07,d,0xbaaf52);for(let i=0;i<8;i++)block(x-w/2+.5+i*w/8,.17,z,.10,.27,d-.3,0xe3cc63);for(const sz of [-1,1])block(x,.02,z+sz*d/2,w+.4,.06,.25,0x729ba2);}
for(let i=0;i<26;i++){const side=i%2?-1:1;const x=side*(14+(i*7%8)),z=-18+(i*11%37);model('tree',x,z,.75+(i%4)*.2,i*.7);}
for(let i=0;i<16;i++){const x=(i%2?-1:1)*(16+i%7),z=-20+(i*9%39);model('rock',x,z,.65+(i%3)*.4,i);}
for(const [x,z]of [[-6,5],[6,1],[9,7],[-3,-6],[11,-4]])model('pickup',x,z);
for(let i=0;i<45;i++){const x=-22+(i*13%45),z=-19+(i*17%40);if(Math.abs(x)<9&&Math.abs(z)<8)continue;block(x,.03,z,.4,.03,.3,i%2?0xa6b77a:0x879e60);}
// Two vertical groups and two horizontal groups share a crossing; grid rejoin, ORCA and hard collision guide them.
entities['vertical-route']={Line3D:{points:[[0,.06,-14],[0,.06,14]],width:.09,color:0xf8f1cf,opacity:.78}};
entities['horizontal-route']={Line3D:{points:[[-12,.06,0],[12,.06,0]],width:.09,color:0xf8f1cf,opacity:.78}};
// Multi-source flow goals form an attractor corridor around each authored route.
entities['ox-flow-vertical']={NavigationProfile:{gridId:'navigation-map',radius:.8,goals:Array.from({length:29},(_,i)=>({x:0,y:i-14}))}};
entities['ox-flow-horizontal']={NavigationProfile:{gridId:'navigation-map',radius:.8,goals:Array.from({length:25},(_,i)=>({x:i-12,y:0}))}};
entities['cart-flow-horizontal']={NavigationProfile:{gridId:'navigation-map',radius:2.5,goals:Array.from({length:21},(_,i)=>({x:i-10,y:4}))}};
const hero=model('turtle',-10,4,.8,0);
const heroVectors=vectorLines(hero);
entities[hero]={Transform:{x:-10,y:4,rotation:0,scaleX:1,scaleY:1},Model3D:{modelKey:'mechanism/turtle',scale:.8},
  AnimState3D:{clip:'mechanical-loop',loop:true,speedAtVelocity:.045},FaceRotate:{source:'velocity'},PathFollow:{waypoints:[{x:-10,y:4},{x:10,y:4}],speed:.045,index:1,loop:true,arriveRadius:.08,lookAhead:6},
  CrowdAvoidance:{radius:2.5,maxSpeed:.045,timeHorizon:35,neighborDistance:10,maxNeighbors:20,yieldAfterTicks:55,minRadiusScale:.65,radiusStep:.025,priorityMode:'mass-stall',desiredInertia:.9,flowGuide:{fieldId:'cart-flow-horizontal',weight:0,repathDistance:2.5,pathfindDistance:5,releaseDistance:2.5,occupancyPenalty:.2,pathfindPeriod:60},zeroEscape:false,debugVectorPrefix:heroVectors,debugVectorScale:50,debugVectorY:2.8},
  Trail3D:{segments:120,width:.07,color:0xf6bd6c,minDist:.08,fade:.55},Shape:{kind:'circle',radius:2.5,category:1,mask:3},Mass:{value:12}};
entities['cart-route']={Line3D:{points:[[-10,.06,4],[10,.06,4]],width:.07,color:0xf6bd6c,opacity:.65}};
const trailColors={upper:0x71d5ff,lower:0xffc36b,left:0xf99fc7,right:0x96e795};
export type OxGroup = keyof typeof trailColors;
export const oxTemplateIds: Record<OxGroup,string[]>={upper:[],lower:[],left:[],right:[]};
for(const route of navigation.routes){
 const [x,z]=route.spawn;const ox=model('ox',x,z,.95,0);
 oxTemplateIds[route.group as OxGroup].push(ox);
 const oxVectors=vectorLines(ox);
 entities[ox]={Transform:{x,y:z,rotation:0,scaleX:1,scaleY:1},Model3D:{modelKey:'mechanism/ox',scale:.95},
  AnimState3D:{clip:'walk',speed:1,loop:true,speedAtVelocity:route.speed},FaceRotate:{source:'velocity'},PathFollow:{waypoints:route.waypoints.map(([px,pz])=>({x:px,y:pz})),speed:route.speed,index:route.index,loop:true,arriveRadius:.08,lookAhead:3},
  Trail3D:{segments:100,width:.05,color:trailColors[route.group as OxGroup],minDist:.08,fade:.5},CrowdAvoidance:{radius:.8,maxSpeed:route.speed,timeHorizon:37,neighborDistance:8,maxNeighbors:16,yieldAfterTicks:60,minRadiusScale:1,radiusStep:.025,priorityMode:'mass-stall',flowGuide:{fieldId:route.group==='upper'||route.group==='lower'?'ox-flow-vertical':'ox-flow-horizontal',weight:0,repathDistance:2.5,pathfindDistance:3.5,releaseDistance:1.25,occupancyPenalty:.45,pathfindPeriod:45,edgeRepathSlots:2},zeroEscape:true,debugVectorPrefix:oxVectors,debugVectorScale:38,debugVectorY:1.35},
  Shape:{kind:'circle',radius:.8,category:1,mask:3},Mass:{value:1}};
}
export const sampleBlueprint:WorldBlueprint={capabilities:[navigationGridCapability,pathfindCapability,pathFollowCapability,crowdAvoidanceCapability,faceRotateCapability,motionApplyCapability,overlapDetectCapability,collisionResolveCapability],entities};
