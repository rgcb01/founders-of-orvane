import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,RESOURCES} from '@orvane/engine';
import {gameVisual,setupVisual,visualDuration} from './visualEvents';
function fixture(){
 const board=generateBoard('visual');let setup=createSetup(board,4);
 while(setup.phase!=='complete'){const playerId=activePlayer(setup)!;setup=applySetup(board,setup,{kind:'settlement',playerId,id:legalSettlements(board,setup)[0]});setup=applySetup(board,setup,{kind:'road',playerId,id:legalRoads(board,setup)[0]});}
 return {board,game:startGame(board,setup,()=>.5)};
}
describe('visual events',()=>{
 it('keeps dice before production and never animates ungranted resources',()=>{
  const {board,game}=fixture();const t=board.tiles.find(t=>t.number!==null&&game.settlements.some(b=>t.vertices.includes(b.vertexId)))!;
  const a=Math.min(6,t.number!-1),b=t.number!-a;
  const next=applyGame(board,game,{kind:'roll',playerId:0,dice:[a,b]});
  const events=gameVisual(board,game,next);expect(events[0].kind).toBe('dice');
  const p=events.find(e=>e.kind==='production');expect(p).toBeDefined();
  if(p?.kind==='production')for(const [i,player] of next.players.entries())for(const k of RESOURCES)expect(p.flights.filter(f=>f.playerId===player.id&&f.resource===k).reduce((n,f)=>n+f.count,0)).toBe(next.lastProduction[i][k]);
 });
 it('captures placement by vertex and road id',()=>{
  const {board}=fixture();const s=createSetup(board,4);const id=legalSettlements(board,s)[0];const next=applySetup(board,s,{kind:'settlement',playerId:0,id});expect(setupVisual(s,next)).toEqual([{kind:'settlement',playerId:0,id}]);
 });
 it('keeps robber movement public without exposing stolen resource',()=>{
  const {board,game}=fixture();const tile=board.tiles.find(t=>t.id!==game.development.robber)!;
  const next={...game,development:{...game.development,robber:tile.id}};
  expect(gameVisual(board,game,next)).toEqual([{kind:'robber',playerId:0,from:game.development.robber,to:tile.id}]);
 });
 it('has readable default durations and instant turbo',()=>{
  const event={kind:'dice' as const,playerId:0,dice:[1,2] as [number,number]};
  expect(visualDuration(event,'relaxed')).toBeGreaterThan(visualDuration(event,'normal'));expect(visualDuration(event,'turbo')).toBe(0);expect(visualDuration(event,'relaxed',true)).toBeLessThan(visualDuration(event,'relaxed'));
 });
});
