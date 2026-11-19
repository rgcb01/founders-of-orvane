import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame} from '@orvane/engine';
import {botDelay,matchEvent,setupEvent,PACES} from './matchUX';
function fixture(){
 const board=generateBoard('ux');let setup=createSetup(board,4);
 while(setup.phase!=='complete'){const playerId=activePlayer(setup)!;setup=applySetup(board,setup,{kind:'settlement',playerId,id:legalSettlements(board,setup)[0]});setup=applySetup(board,setup,{kind:'road',playerId,id:legalRoads(board,setup)[0]});}
 return {board,game:startGame(board,setup,()=>.5)};
}
describe('readable match UX',()=>{
 it('keeps pacing separate from rules and supports manual steps',()=>{
  const {board,game}=fixture();const next=applyGame(board,game,{kind:'roll',playerId:0,dice:[1,1]});
  expect(botDelay('relaxed',next)).toBe(PACES.relaxed.rollDelay);
  expect(botDelay('relaxed',game)).toBeGreaterThan(botDelay('normal',game));
  expect(botDelay('normal',game)).toBeGreaterThan(botDelay('turbo',game));
  expect(botDelay('relaxed',game,true)).toBe(0);
 });
 it('reports roll, production, turn and robber without leaking hidden hands',()=>{
  const {board,game}=fixture();const next=applyGame(board,game,{kind:'roll',playerId:0,dice:[1,1]});
  expect(matchEvent(game,next,1)).toContain('rolled 1+1 = 2');
  expect(matchEvent(game,next,1)).toContain('You:');
  expect(matchEvent(next,applyGame(board,next,{kind:'end',playerId:0}),1)).toContain('Player 2');
  expect(matchEvent(game,applyGame(board,game,{kind:'roll',playerId:0,dice:[3,4]}),1)).toContain('Robber');
  expect(matchEvent(game,game,1)).toBeNull();
 });
 it('reports initial placement',()=>{
  const {board}=fixture();const setup=createSetup(board,4);
  expect(setupEvent(null,setup)).toContain('island');
  const next=applySetup(board,setup,{kind:'settlement',playerId:0,id:legalSettlements(board,setup)[0]});
  expect(setupEvent(setup,next)).toContain('placed a settlement');
 });
});
