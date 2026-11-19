import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,type GameState} from '@orvane/engine';
import {gameCue,setupCue} from './soundEvents';
function fixture(){
 const board=generateBoard('audio');let setup=createSetup(board,4);
 while(setup.phase!=='complete'){const playerId=activePlayer(setup)!;setup=applySetup(board,setup,{kind:'settlement',playerId,id:legalSettlements(board,setup)[0]});setup=applySetup(board,setup,{kind:'road',playerId,id:legalRoads(board,setup)[0]});}
 return {board,state:startGame(board,setup,()=>.5)};
}
describe('sound event classification',()=>{
 it('recognizes start, dice, turn and no-op',()=>{
  const {board,state}=fixture();expect(gameCue(null,state,1)).toBe('start');expect(gameCue(state,state,1)).toBeNull();
  const rolled=applyGame(board,state,{kind:'roll',playerId:0,dice:[1,1]});expect(gameCue(state,rolled,1)).toBe('dice');
  const next=applyGame(board,rolled,{kind:'end',playerId:0});expect(gameCue(rolled,next,1)).toBe('turn');
 });
 it('prioritizes victory and distinguishes human defeat',()=>{
  const {state}=fixture();const won:GameState={...state,winner:0,phase:'finished'};expect(gameCue(state,won,1)).toBe('victory');expect(gameCue(state,{...won,winner:1},1)).toBe('defeat');
 });
 it('recognizes setup placement and robber warning',()=>{
  const {board,state}=fixture();const s=createSetup(board,4);const p=applySetup(board,s,{kind:'settlement',playerId:0,id:legalSettlements(board,s)[0]});
  expect(setupCue(s,p)).toBe('settlement');expect(gameCue(state,applyGame(board,state,{kind:'roll',playerId:0,dice:[3,4]}),1)).toBe('robber');
 });
});
