import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,RESOURCES,COSTS} from '@orvane/engine';
import {gameVisual,setupVisual,visualDuration,pendingIncome} from './visualEvents';
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
 it('shows only public offered bundles and does not expose hidden card purchases',()=>{
  const {board,game}=fixture();const give={forest:1,pasture:0,field:0,hill:0,mountain:0},want={forest:0,pasture:0,field:1,hill:0,mountain:0};
  const offered={...game,offer:{from:0,to:1,give,want}};
  expect(gameVisual(board,game,offered)).toEqual([{kind:'offer',playerId:0,other:1,give:'🪵×1',want:'🌾×1',giveCards:give,wantCards:want}]);
  const purchased={...game,development:{...game.development,deck:game.development.deck.slice(1)}};
  expect(gameVisual(board,game,purchased)).toEqual([{kind:'card',playerId:0,card:null,symbol:'🃏'}]);
 });
 it('queues solo income after production and delays displayed credits',()=>{
  const {board,game}=fixture();const t=board.tiles.find(t=>t.number!==null&&game.settlements.some(b=>b.playerId===0&&t.vertices.includes(b.vertexId)))!;
  const a=Math.min(6,t.number!-1),b=t.number!-a;
  const next=applyGame(board,game,{kind:'roll',playerId:0,dice:[a,b]});
  const queue=gameVisual(board,game,next,true);
  expect(queue.map(e=>e.kind)).toEqual(['dice','production','income']);
  for(const k of RESOURCES)expect(pendingIncome(queue,k)).toBe(next.lastProduction[0][k]);
  expect(gameVisual(board,game,next,false).some(e=>e.kind==='income')).toBe(false);
 });
 it('reveals played action cards only',()=>{
  const {board,game}=fixture();const before={...game,development:{...game.development,hands:{...game.development.hands,0:[{id:99,kind:'knight' as const,boughtTurn:0}]}}};
  const next={...before,development:{...before.development,played:true,hands:{...before.development.hands,0:[]}}};
  expect(gameVisual(board,before,next)[0]).toEqual({kind:'card',playerId:0,card:'knight',symbol:'🃏'});
 });
 it('shows spend before a paid road but never for a free road',()=>{
  const {board,game}=fixture();const id=board.edges.find(e=>!game.roads.some(r=>r.edgeId===e.id))!.id;
  const roads=[...game.roads,{edgeId:id,playerId:0}];
  const next={...game,roads,bank:Object.fromEntries(RESOURCES.map(k=>[k,game.bank[k]+COSTS.road[k]])) as typeof game.bank,players:game.players.map(p=>p.id===0?{...p,resources:Object.fromEntries(RESOURCES.map(k=>[k,p.resources[k]-COSTS.road[k]])) as typeof p.resources}:p)};
  expect(gameVisual(board,game,next).map(e=>e.kind)).toEqual(['spend','road']);
  expect(gameVisual(board,game,{...game,roads}).map(e=>e.kind)).toEqual(['road']);
 });
 it('animates a stolen card without showing its resource type',()=>{
  const {board,game}=fixture();const tile=board.tiles.find(t=>t.id!==game.development.robber)!;
  const next={...game,development:{...game.development,robber:tile.id},players:game.players.map(p=>({...p,resources:{...p.resources,forest:p.resources.forest+(p.id===0?1:p.id===1?-1:0)}}))};
  expect(gameVisual(board,game,next).at(-1)).toEqual({kind:'steal',playerId:0,other:1,symbol:'🂠'});
 });
 it('has readable default durations and instant turbo',()=>{
  const event={kind:'dice' as const,playerId:0,dice:[1,2] as [number,number]};
  expect(visualDuration(event,'relaxed')).toBeGreaterThan(visualDuration(event,'normal'));expect(visualDuration(event,'turbo')).toBe(0);expect(visualDuration(event,'relaxed',true)).toBeLessThan(visualDuration(event,'relaxed'));
 });
});
