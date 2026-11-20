import {describe,it,expect} from 'vitest';
import {localPoint,clampPan,worldAt,panAroundWorld,dragPan,mid,distance,clampZoom,MIN_ZOOM,MAX_ZOOM,nearestVertex,nearestEdge,segmentDistance,type Rect,type Bounds} from './touchCamera';
const b:Bounds={x:40,y:50,w:600,h:420},portrait:Rect={left:0,top:100,width:430,height:600};
describe('mobile camera gestures',()=>{
 it('preserves the board world point beneath a moving pinch midpoint',()=>{
  const anchorClient={x:190,y:380},anchor=worldAt(b,portrait,1,{x:0,y:0},anchorClient);
  const newCenter={x:207,y:410},z=2.35;
  const pan=panAroundWorld(b,portrait,anchor,newCenter,z);
  const same=worldAt(b,portrait,z,pan,newCenter);
  expect(same.x).toBeCloseTo(anchor.x,5);expect(same.y).toBeCloseTo(anchor.y,5);
 });
 it('handles landscape letterboxing without distorted camera scale',()=>{
  const landscape={left:0,top:0,width:932,height:430};
  const point={x:466,y:215};expect(localPoint(b,landscape,point)).toEqual({x:300,y:210});
  const anchor=worldAt(b,landscape,2,{x:0,y:0},point),pan=panAroundWorld(b,landscape,anchor,{x:516,y:215},2);
  expect(pan.x).toBeLessThan(0);
  expect(worldAt(b,landscape,2,pan,{x:516,y:215}).x).toBeCloseTo(anchor.x);
 });
 it('dragging follows the finger and stays clamped near island edges',()=>{
  const moved=dragPan(b,portrait,2,{x:0,y:0},{x:200,y:300},{x:250,y:300});
  expect(moved.x).toBeLessThan(0);
  expect(Math.abs(dragPan(b,portrait,1,{x:0,y:0},{x:0,y:0},{x:100000,y:0}).x)).toBeLessThan(b.w/2);
 });
 it('snaps imprecise fingers only to legal sites, ignoring closer illegal sites',()=>{
   const points=new Map([['v1',{x:0,y:0}],['v2',{x:40,y:0}],['v3',{x:0,y:30}]]);
   expect(nearestVertex(points,new Set(['v2']),{x:5,y:0},20)).toBeNull();
   expect(nearestVertex(points,new Set(['v2']),{x:25,y:0},20)).toBe('v2');
   const edges=[{id:'illegal',a:'v1',b:'v2'},{id:'good',a:'v1',b:'v3'}];
   expect(nearestEdge(edges,points,new Set(['good']),{x:5,y:14},14)).toBe('good');
   expect(nearestEdge(edges,points,new Set(['illegal']),{x:5,y:14},10)).toBeNull();
   expect(segmentDistance({x:20,y:20},{x:0,y:0},{x:40,y:0})).toBe(20);
 });
 it('clamps zoom and calculates two-finger centroid/distance',()=>{
  expect(clampZoom(0)).toBe(MIN_ZOOM);expect(clampZoom(9)).toBe(MAX_ZOOM);
  expect(mid({x:0,y:2},{x:10,y:6})).toEqual({x:5,y:4});
  expect(distance({x:3,y:4},{x:0,y:0})).toBe(5);
  expect(clampPan(b,1,{x:1e8,y:-1e8}).x).toBeLessThanOrEqual(b.w*.12);
 });
});
