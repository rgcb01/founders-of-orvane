import {describe,it,expect} from 'vitest';
import {adaptResolution,resolutionCap,resolutionStart,nextFrameDeadline,TARGET_FPS,FRAME_MS,type ResolutionState} from './adaptiveResolution';
const repeat=(s:ResolutionState,n:number,ms:number,fps:number,target=30)=>{for(let i=0;i<n;i++)s=adaptResolution(s,ms,fps,target);return s;};
describe('adaptive 3D resolution',()=>{
 it('honors device pixel ratio and manual quality caps',()=>{
  expect(resolutionCap(3,'high')).toBe(2);expect(resolutionCap(3,'medium')).toBe(1.5);
  expect(resolutionCap(3,'low')).toBe(1);expect(resolutionCap(.8,'high')).toBe(.8);
  expect(resolutionCap(NaN,'high')).toBe(1);
 });
 it('degrades only after sustained pressure and stops at the lower limit',()=>{
  const initial=resolutionStart(2);
  expect(repeat(initial,1,20,20).ratio).toBe(2);
  expect(repeat(initial,2,20,20).ratio).toBe(1.75);
  expect(repeat(initial,40,20,20).ratio).toBe(.75);
  expect(repeat(resolutionStart(.6),40,20,20).ratio).toBe(.6);
 });
 it('recovers gradually but never exceeds the cap',()=>{
  const low=repeat(resolutionStart(1.5),20,20,20);
  expect(repeat(low,3,4,30).ratio).toBe(.75);
  expect(repeat(low,4,4,30).ratio).toBe(1);
  expect(repeat(low,40,4,30).ratio).toBe(1.5);
 });
 it('uses cadence relative to the current target and ignores invalid samples',()=>{
  const initial=resolutionStart(1.5);
  expect(repeat(initial,2,5,10,20).ratio).toBe(1.25);
  expect(repeat(initial,12,5,10,10).ratio).toBe(1.5);
  expect(repeat(initial,10,NaN,10).ratio).toBe(1.5);
 });
 it('preserves adapted resolution when the scene changes, within new caps',()=>{
  const prior=repeat(resolutionStart(2),4,20,20);
  expect(resolutionStart(2,prior).ratio).toBe(1.5);
  expect(resolutionStart(1,prior)).toEqual({cap:1,ratio:1,slow:0,fast:0});
 });
});

describe('60 FPS display cadence',()=>{
 const submissions=(hz:number)=>{let due=0,count=0;for(let i=0;i<hz*5;i++){const now=i*1000/hz;const next=nextFrameDeadline(now,due);if(next!==null){due=next;count++;}}return count;};
 it('targets a 16.67ms frame budget on 60Hz and 120Hz displays',()=>{
  expect(TARGET_FPS).toBe(60);expect(FRAME_MS).toBeCloseTo(16.667,2);
  expect(submissions(60)).toBe(300);expect(submissions(120)).toBe(300);
 });
 it('does not try to catch up with multiple frames on a slower display',()=>{
  expect(submissions(30)).toBe(150);
  expect(nextFrameDeadline(500,10)).toBeGreaterThan(500);
 });
 it('reduces resolution when 60 FPS is not sustained',()=>{
  const initial=resolutionStart(1.5);
  expect(repeat(initial,2,13,60,60).ratio).toBe(1.25);
  expect(repeat(initial,2,5,48,60).ratio).toBe(1.25);
  expect(repeat(initial,10,5,59,60).ratio).toBe(1.5);
 });
});
