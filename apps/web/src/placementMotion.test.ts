import {describe,it,expect} from 'vitest';
import {placementPose} from './placementMotion';
describe('miniature placement',()=>{
 it('starts elevated, contacts the board, rebounds and finishes at rest',()=>{
  expect(placementPose(0)).toEqual({lift:.68,scaleY:1});
  expect(placementPose(.62).lift).toBeCloseTo(0);
  expect(placementPose(.75).lift).toBeGreaterThan(0);
  expect(placementPose(1).lift).toBeCloseTo(0);
  expect(placementPose(1).scaleY).toBeCloseTo(1);
 });
 it('never penetrates the board and clamps elapsed time',()=>{
  for(let i=-10;i<=110;i++){const p=placementPose(i/100);expect(p.lift).toBeGreaterThanOrEqual(0);expect(p.scaleY).toBeGreaterThan(.95);}
 });
});
