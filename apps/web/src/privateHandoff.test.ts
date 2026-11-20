import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,activePlayer,applySetup,legalSettlements,legalRoads,startGame,applyGame} from '@orvane/engine';
import {needsHandoff,privateHandSeat} from './privateHandoff';
describe('local pass-and-play handoff',()=>{
 it('preserves single-human behavior',()=>{
  for(const actor of [null,0,1,2]){expect(needsHandoff(1,actor,null)).toBe(false);expect(privateHandSeat(1,actor,null)).toBe(0);}
 });
 it('never reveals a different human hand or a bot hand',()=>{
  expect(needsHandoff(3,0,null)).toBe(true);expect(privateHandSeat(3,0,null)).toBeNull();
  expect(privateHandSeat(3,0,0)).toBe(0);expect(privateHandSeat(3,1,0)).toBeNull();
  expect(needsHandoff(3,1,0)).toBe(true);expect(privateHandSeat(3,1,1)).toBe(1);
  expect(privateHandSeat(3,4,1)).toBeNull();expect(needsHandoff(3,4,1)).toBe(false);
  expect(privateHandSeat(3,null,1)).toBeNull();
 });
 it('changes the actor on a legal setup turn and allows a fresh private handoff',()=>{
  const board=generateBoard('pass-device'),s=createSetup(board,3);
  const original=activePlayer(s)!,one=applySetup(board,s,{kind:'settlement',playerId:original,id:legalSettlements(board,s)[0]});
  const two=applySetup(board,one,{kind:'road',playerId:original,id:legalRoads(board,one)[0]});
  expect(activePlayer(two)).not.toBe(original);
  expect(needsHandoff(3,activePlayer(two),original)).toBe(true);
  let finished=two;
  while(finished.phase!=='complete'){
   const id=activePlayer(finished)!;finished=applySetup(board,finished,{kind:'settlement',playerId:id,id:legalSettlements(board,finished)[0]});finished=applySetup(board,finished,{kind:'road',playerId:id,id:legalRoads(board,finished)[0]});
  }
  const game=startGame(board,finished,()=>.5);
  const rolled=applyGame(board,game,{kind:'roll',playerId:game.active,dice:[1,1]});
  expect(privateHandSeat(3,rolled.active,null)).toBeNull();
 });
});
