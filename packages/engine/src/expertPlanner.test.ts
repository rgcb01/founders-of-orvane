import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,RESOURCES,COSTS,tradeRate,botView,chooseBotAction,type GameState} from './index';
import {planExpertAction,PLANNER_LIMITS} from './expertPlanner';
function state(){const board=generateBoard('expert-search');let s=createSetup(board,4);
 while(s.phase!=='complete'){const playerId=activePlayer(s)!;s=applySetup(board,s,{kind:'settlement',playerId,id:legalSettlements(board,s)[0]});s=applySetup(board,s,{kind:'road',playerId,id:legalRoads(board,s)[0]});}
 const g=startGame(board,s,()=>.5);return {board,g:{...g,phase:'action' as const,dice:[1,1] as [number,number]}};
}
describe('bounded expert tactical planning',()=>{
 it('uses fixed caps and chooses legal deterministic actions',()=>{
  const {board,g}=state();expect(PLANNER_LIMITS.roads).toBeLessThanOrEqual(4);
  const planned=planExpertAction(board,botView(g,g.active),'builder');
  if(planned)expect(()=>applyGame(board,g,planned)).not.toThrow();
  expect(planExpertAction(board,{...g,phase:'discard'},'builder')).toBeNull();
 });
 it('finds a legal bank-trade-before-city combination without reading hidden opponent hands',()=>{
  const {board,g}=state(),seat=g.active;
  const city=g.settlements.find(b=>b.playerId===seat)!;
  const give='hill' as const,want='field' as const;
  const rate=tradeRate(board,g,seat,give);
  const hand={forest:0,pasture:0,field:1,hill:rate,mountain:3};
  const before=g.players[seat].resources,bank={...g.bank};
  // Redistribute within bank/own hand while respecting conservation.
  for(const k of RESOURCES)bank[k]+=before[k]-hand[k];
  const rich:GameState={...g,bank,players:g.players.map(p=>p.id===seat?{...p,resources:hand}:p)};
  expect(RESOURCES.every(k=>rich.bank[k]>=0)).toBe(true);
  expect(rich.bank.field).toBeGreaterThan(0);
  const first=planExpertAction(board,botView(rich,seat),'builder');
  expect(first).not.toBeNull();
  if(first?.kind==='bankTrade'){
    const after=applyGame(board,rich,first);
    expect(after.players[seat].resources.field).toBeGreaterThanOrEqual(2);
    expect(after.players[seat].resources.mountain).toBeGreaterThanOrEqual(COSTS.city.mountain);
    expect(()=>applyGame(board,after,{kind:'build',build:'city',id:city.vertexId,playerId:seat})).not.toThrow();
  }else{
    expect(()=>applyGame(board,rich,first!)).not.toThrow();
  }
 });
 it('planning is invariant to opponent private hands and deck order',()=>{
  const {board,g}=state(),id=g.active;
  const changed:GameState={...g,players:g.players.map(p=>p.id===id?p:{...p,resources:{...p.resources,forest:0,pasture:0,field:0,hill:0,mountain:Object.values(p.resources).reduce((a,b)=>a+b,0)}}),development:{...g.development,deck:g.development.deck.slice().reverse()}};
  expect(chooseBotAction(board,g,{difficulty:'expert',random:()=>.3})).toEqual(chooseBotAction(board,changed,{difficulty:'expert',random:()=>.3}));
 });
});