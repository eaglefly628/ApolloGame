import {describe,it,expect} from 'vitest';
import {createCharacterMotor,stepCharacterMotor,type CharacterMotorConfigV1,type CharacterMotorObstacle} from './character-motor.js';
const config=():CharacterMotorConfigV1=>({version:1,unitsPerMeter:10000,tickRate:60,body:{kind:'capsule',radiusQ:2000,standingHeightQ:18000,crouchedHeightQ:10000,skinQ:2},maxWalkSpeedQps:20000,maxRunSpeedQps:40000,maxCrouchSpeedQps:10000,accelQps2:40000,brakeQps2:60000,airControlQps2:20000,gravityQps2:98000,jumpSpeedQps:40000,terminalFallSpeedQps:100000,recoverTicks:2,collision:{kind:'static-aabb',maxObstacles:16,maxContacts:8,maxSlideIterations:8,maxDeltaQ:1000000}});
const floor:CharacterMotorObstacle={kind:'static-aabb',id:'floor',min:{x:-1000000,y:-10000,z:-1000000},max:{x:1000000,y:0,z:1000000}};
const wall:CharacterMotorObstacle={kind:'static-aabb',id:'wall',min:{x:5000,y:-10000,z:-1000000},max:{x:5001,y:50000,z:1000000}};
const spawn=(c=config(),obstacles=[floor])=>createCharacterMotor(c,{positionQ:{x:0,y:0,z:0},stance:'standing'},obstacles);
const root=(x:number,z=0)=>({requestId:'actor:instance1:tick1',deltaQ:{x,z}});
describe('authoritative root displacement through existing motor',()=>{
 it('accepts exact horizontal root displacement without acceleration or double integration',()=>{
  const c=config(),s=spawn(c),before=JSON.stringify(s),r=stepCharacterMotor(c,s,{obstacles:[floor],rootMotion:root(123,456)});
  expect(r.result.desiredDeltaQ).toEqual({x:123,y:0,z:456});expect(r.result.acceptedDeltaQ).toEqual(r.result.desiredDeltaQ);
  expect(r.state.positionQ).toEqual({x:123,y:0,z:456});expect(r.state.positionRemainderQ).toEqual({x:0,y:0,z:0});expect(JSON.stringify(s)).toBe(before);
 });
 it('cannot tunnel through a one-Q wall; rejected root distance is not carried as movement debt',()=>{
  const c=config(),obstacles=[floor,wall],r=stepCharacterMotor(c,spawn(c,obstacles),{obstacles,rootMotion:root(20000)});
  expect(r.result.desiredDeltaQ.x).toBe(20000);expect(r.state.positionQ.x).toBeGreaterThanOrEqual(2996);expect(r.state.positionQ.x).toBeLessThanOrEqual(3000);
  expect(r.result.blockedReasons).toContain('collision');expect(r.state.velocityMicroQps.x).toBe(0);
  const stopped=stepCharacterMotor(c,r.state,{obstacles,rootMotion:root(0)});expect(stopped.state.positionQ.x).toBe(r.state.positionQ.x);
 });
 it('retains tangential root displacement while a wall blocks the other axis',()=>{
  const c=config(),obstacles=[floor,wall],r=stepCharacterMotor(c,spawn(c,obstacles),{obstacles,rootMotion:root(20000,15000)});
  expect(r.state.positionQ.x).toBeLessThanOrEqual(3000);expect(r.state.positionQ.z).toBe(15000);
 });
 it('keeps gravity, jumps, land events and support owned by the motor',()=>{
  const c=config();let s=spawn(c);const events=[];
  for(let i=0;i<120;i++){const r=stepCharacterMotor(c,s,{obstacles:[floor],rootMotion:{...root(20),requestId:'actor:1:'+i},jump:{seq:1}});s=r.state;events.push(...r.events);}
  expect(s.positionQ.x).toBe(2400);expect(s.mode).toBe('grounded');expect(events.map(e=>e.kind)).toEqual(['jump','land']);
 });
 it('rejects fresh and persistent velocity move conflicts instead of adding both authorities',()=>{
  const c=config(),s=spawn(c),move={seq:1,xQ:10000,zQ:0,gait:'walk' as const,stance:'standing' as const};
  expect(()=>stepCharacterMotor(c,s,{obstacles:[floor],rootMotion:root(30),move})).toThrow(/exclusive/);
  const walking=stepCharacterMotor(c,s,{obstacles:[floor],move}).state;
  expect(()=>stepCharacterMotor(c,walking,{obstacles:[floor],rootMotion:root(30)})).toThrow(/exclusive/);
  const switched=stepCharacterMotor(c,walking,{obstacles:[floor],rootMotion:root(30),move:{...move,seq:2,xQ:0}});
  expect(switched.result.desiredDeltaQ.x).toBe(30);
 });
 it('drops old horizontal fractional integration residues on explicit authority change',()=>{
  const c=config(),s=JSON.parse(JSON.stringify(spawn(c)));s.positionRemainderQ.x=999999;s.positionRemainderQ.z=-999999;
  const r=stepCharacterMotor(c,s,{obstacles:[floor],rootMotion:root(1,-1)});expect(r.result.acceptedDeltaQ).toEqual({x:1,y:0,z:-1});
 });
 it('rejects malformed or excessive displacement without changing the previous snapshot',()=>{
  const c=config(),s=spawn(c),before=JSON.stringify(s);
  for(const invalid of [null,{requestId:'',deltaQ:{x:0,z:0}},{...root(.5)},{...root(1),deltaQ:{x:1,y:0,z:0}},root(1000001),root(200000)])
   expect(()=>stepCharacterMotor(c,s,{obstacles:[floor],rootMotion:invalid as any})).toThrow();
  expect(JSON.stringify(s)).toBe(before);
 });
 it('round-trips snapshot restore with the same collision and accepted displacement',()=>{
  const c=config(),obstacles=[floor,wall],s=stepCharacterMotor(c,spawn(c,obstacles),{obstacles,rootMotion:root(100,200)}).state;
  const input={obstacles,rootMotion:root(20000,5000)};
  expect(stepCharacterMotor(c,s,input)).toEqual(stepCharacterMotor(c,JSON.parse(JSON.stringify(s)),JSON.parse(JSON.stringify(input))));
 });
});
