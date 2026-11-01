import {describe,it,expect} from 'vitest';
import {yawDirectionQ,directionYawUnits,advanceYaw,worldToLocalQ,localToWorldQ} from './yaw-fixed.js';
describe('versioned integer yaw basis',()=>{
 it('calibrates +Z forward and positive turn towards +X',()=>{
  expect(yawDirectionQ(0)).toEqual({xQ:0,zQ:1000000});
  expect(yawDirectionQ(16384)).toEqual({xQ:1000000,zQ:0});
  expect(yawDirectionQ(32768)).toEqual({xQ:0,zQ:-1000000});
  expect(yawDirectionQ(49152)).toEqual({xQ:-1000000,zQ:0});
  expect(worldToLocalQ(10000,0,16384)).toEqual({lateralQ:0,forwardQ:10000});
  expect(localToWorldQ(10000,0,16384)).toEqual({xQ:0,zQ:-10000});
 });
 it('quantizes directions with a retained zero heading and exact quadrants',()=>{
  expect(directionYawUnits(0,0,123)).toBe(123);
  for(const [x,z,yaw] of [[0,1,0],[1,0,16384],[0,-1,32768],[-1,0,49152],[1,1,8192],[1,-1,24576],[-1,-1,40960],[-1,1,57344]])expect(directionYawUnits(x,z,0)).toBe(yaw);
  for(let yaw=0;yaw<65536;yaw+=64){const d=yawDirectionQ(yaw);expect(directionYawUnits(d.xQ,d.zQ,0)).toBe(yaw);}
 });
 it('bounds interpolation norm error and restores local coordinates at game scale',()=>{
  for(let yaw=0;yaw<65536;yaw+=17){const d=yawDirectionQ(yaw);expect(Math.abs(d.xQ*d.xQ+d.zQ*d.zQ-1e12)).toBeLessThan(12000000);const w=localToWorldQ(23456,-12345,yaw),l=worldToLocalQ(w.xQ,w.zQ,yaw);expect(Math.abs(l.lateralQ-23456)).toBeLessThanOrEqual(1);expect(Math.abs(l.forwardQ+12345)).toBeLessThanOrEqual(1);}
 });
 it('chooses short wrap and explicit positive half-turn',()=>{
  expect(advanceYaw(65530,10,600,60,0)).toEqual({yawUnits:4,remainder:0,errorUnits:6});
  expect(advanceYaw(10,65530,600,60,0)).toEqual({yawUnits:0,remainder:0,errorUnits:-6});
  expect(advanceYaw(0,32768,600,60,0).yawUnits).toBe(10);
 });
 it('retains tick integration remainder and clears it on target contact',()=>{
  for(const rate of [30,60,120]){let s={yawUnits:0,remainder:0};for(let i=0;i<rate;i++)s=advanceYaw(s.yawUnits,20000,1001,rate,s.remainder);expect(s.yawUnits).toBe(1001);expect(s.remainder).toBe(0);}
  expect(advanceYaw(0,1,1000,60,59)).toEqual({yawUnits:1,remainder:0,errorUnits:0});
  const start=advanceYaw(0,20000,1001,60,0),restored=JSON.parse(JSON.stringify(start));expect(advanceYaw(restored.yawUnits,20000,1001,60,restored.remainder)).toEqual(advanceYaw(start.yawUnits,20000,1001,60,start.remainder));
 });
 it('rejects bad input before computing',()=>{
  for(const yaw of [-1,65536,0.5,NaN])expect(()=>yawDirectionQ(yaw)).toThrow();
  expect(()=>worldToLocalQ(Infinity,0,0)).toThrow();expect(()=>directionYawUnits(1e9+1,0,0)).toThrow();expect(()=>advanceYaw(0,1,10,60,60)).toThrow();
 });
});
