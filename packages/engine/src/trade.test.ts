import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,tradeRate,emptyResources,RESOURCES,type Resource,type GameState} from './index';
function fixture(){
 const board=generateBoard('harbors');
 let setup=createSetup(board,4);
 while(setup.phase!=='complete'){
  const playerId=activePlayer(setup)!;
  setup=applySetup(board,setup,{kind:'settlement',id:legalSettlements(board,setup)[0],playerId});
  setup=applySetup(board,setup,{kind:'road',id:legalRoads(board,setup)[0],playerId});
 }
 let state=startGame(board,setup);
 const bank={...state.bank};
 const players=state.players.map(p=>{const resources={...p.resources};if(p.id<2)for(const k of RESOURCES){resources[k]+=5;bank[k]-=5;}return {...p,resources};});
 state={...state,players,bank,settlements:[],phase:'action'};
 return {board,state};
}
const bundle=(k:Resource,n:number)=>({...emptyResources(),[k]:n});
function conserve(s:GameState){for(const k of RESOURCES)expect(s.bank[k]+s.players.reduce((n,p)=>n+p.resources[k],0)).toBe(19);}
describe('harbors and trade',()=>{
 it('places deterministic nonoverlapping coastal ports with correct inventory',()=>{
  for(const size of ['standard','extended'] as const)for(let i=0;i<30;i++){
   const b=generateBoard('port-'+i,size);
   expect(b.harbors).toHaveLength(size==='standard'?9:11);
   expect(b.harbors.filter(h=>h.resource===null)).toHaveLength(size==='standard'?4:5);
   expect(b.harbors.filter(h=>h.resource==='pasture')).toHaveLength(size==='standard'?1:2);
   const endpoints=b.harbors.flatMap(h=>{const e=b.edges.find(e=>e.id===h.edgeId)!;expect(e.tiles).toHaveLength(1);return [e.a,e.b];});
   expect(new Set(endpoints).size).toBe(endpoints.length);
   expect(generateBoard('port-'+i,size).harbors).toEqual(b.harbors);
  }
 });
 it('uses best rate from owned settlement or city, not roads or opponents',()=>{
  const {board,state}=fixture();
  const port=board.harbors.find(h=>h.resource==='forest')!;
  const edge=board.edges.find(e=>e.id===port.edgeId)!;
  expect(tradeRate(board,state,0,'forest')).toBe(4);
  expect(tradeRate(board,{...state,roads:[{edgeId:edge.id,playerId:0}]},0,'forest')).toBe(4);
  const s={...state,settlements:[{vertexId:edge.a,playerId:0,kind:'city' as const}]};
  expect(tradeRate(board,s,0,'forest')).toBe(2);expect(tradeRate(board,s,1,'forest')).toBe(4);
  const generic=board.edges.find(e=>e.id===board.harbors.find(h=>h.resource===null)!.edgeId)!;
  expect(tradeRate(board,{...s,settlements:[...s.settlements,{vertexId:generic.a,playerId:0,kind:'settlement'}]},0,'field')).toBe(3);
 });
 it('bank exchange conserves supply, rejects invalid actions and empty bank',()=>{
  const {board,state}=fixture();
  const s=applyGame(board,state,{kind:'bankTrade',playerId:0,give:'forest',want:'hill'});
  expect(s.players[0].resources.forest).toBe(state.players[0].resources.forest-4);
  expect(s.players[0].resources.hill).toBe(state.players[0].resources.hill+1);conserve(s);
  expect(()=>applyGame(board,state,{kind:'bankTrade',playerId:1,give:'forest',want:'hill'})).toThrow();
  expect(()=>applyGame(board,state,{kind:'bankTrade',playerId:0,give:'forest',want:'forest'})).toThrow();
  expect(()=>applyGame(board,{...state,bank:{...state.bank,hill:0}},{kind:'bankTrade',playerId:0,give:'forest',want:'hill'})).toThrow();
 });
 it('negotiates multi-card offers, counters, accepts atomically and prevents turn changes',()=>{
  const {board,state}=fixture();
  const s=applyGame(board,state,{kind:'offer',playerId:0,to:1,give:bundle('forest',2),want:bundle('hill',1)});
  expect(()=>applyGame(board,s,{kind:'end',playerId:0})).toThrow();
  expect(()=>applyGame(board,s,{kind:'accept',playerId:2})).toThrow();
  const counter=applyGame(board,s,{kind:'counter',playerId:1,give:bundle('hill',2),want:bundle('forest',3)});
  const accepted=applyGame(board,counter,{kind:'accept',playerId:0});
  expect(accepted.offer).toBeNull();expect(accepted.players[0].resources.forest).toBe(state.players[0].resources.forest-3);
  expect(accepted.players[1].resources.hill).toBe(state.players[1].resources.hill-2);
  expect(accepted.bank).toEqual(state.bank);conserve(accepted);
  expect(applyGame(board,s,{kind:'reject',playerId:1}).offer).toBeNull();
  expect(applyGame(board,s,{kind:'cancel',playerId:0}).offer).toBeNull();
 });
 it('rejects zero, fractional, negative, overlapping, and unaffordable offers',()=>{
  const {board,state}=fixture();
  for(const give of [bundle('forest',0),bundle('forest',-1),bundle('forest',1.5),bundle('forest',24),bundle('hill',1)])expect(()=>applyGame(board,state,{kind:'offer',playerId:0,to:1,give,want:bundle('hill',1)})).toThrow();
  const s=applyGame(board,state,{kind:'offer',playerId:0,to:1,give:bundle('forest',1),want:bundle('hill',24)});
  expect(()=>applyGame(board,s,{kind:'accept',playerId:1})).toThrow();
 });
});
