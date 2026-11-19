import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,robberVictims,freeRoadSites,emptyResources,RESOURCES,produce,type GameState,type CardKind,type PlayerCount,type Resource} from './index';
function fixture(count:PlayerCount=4){
 const board=generateBoard('dev-'+count,count<=4?'standard':'extended');let setup=createSetup(board,count);
 while(setup.phase!=='complete'){const playerId=activePlayer(setup)!;setup=applySetup(board,setup,{kind:'settlement',playerId,id:legalSettlements(board,setup)[0]});setup=applySetup(board,setup,{kind:'road',playerId,id:legalRoads(board,setup)[0]});}
 return {board,state:startGame(board,setup,()=>.99)};
}
function card(s:GameState,kind:CardKind):GameState{return {...s,turn:2,development:{...s.development,hands:{...s.development.hands,[s.active]:[{id:99,kind,boughtTurn:1}]}}};}
function fund(s:GameState,id:number,k:Resource,n:number):GameState{return {...s,bank:{...s.bank,[k]:s.bank[k]-n},players:s.players.map(p=>p.id===id?{...p,resources:{...p.resources,[k]:p.resources[k]+n}}:p)};}
function conserve(s:GameState,cap=19){for(const k of RESOURCES)expect(s.bank[k]+s.players.reduce((n,p)=>n+p.resources[k],0)).toBe(cap);}
describe('robber and cards',()=>{
 it('has 25/34 cards with correct deck counts and starts robber in desert',()=>{
  for(const count of [4,6] as const){const {board,state}=fixture(count);const d=state.development;expect(d.deck).toHaveLength(count===4?25:34);expect(d.deck.filter(k=>k==='knight')).toHaveLength(count===4?14:20);expect(d.deck.filter(k=>k==='victory')).toHaveLength(5);expect(board.tiles.find(t=>t.id===d.robber)?.terrain).toBe('desert');}
 });
 it('seven requires exact half-discard, movement and valid random steal; no early end',()=>{
  const {board,state}=fixture();let s=fund(state,1,'forest',9);
  s=applyGame(board,s,{kind:'roll',playerId:0,dice:[3,4]});expect(s.phase).toBe('discard');
  expect(()=>applyGame(board,s,{kind:'end',playerId:0})).toThrow();
  const n=s.development.discards[1];expect(n).toBeGreaterThan(3);
  expect(()=>applyGame(board,s,{kind:'discard',playerId:1,resources:emptyResources()})).toThrow();
  s=applyGame(board,s,{kind:'discard',playerId:1,resources:{...emptyResources(),forest:n}});
  expect(s.phase).toBe('robber');conserve(s);
  const t=board.tiles.find(t=>t.id!==s.development.robber&&robberVictims(board,s,t.id).includes(1))!;
  const before=Object.values(s.players[1].resources).reduce((a,b)=>a+b,0);
  s=applyGame(board,s,{kind:'moveRobber',playerId:0,tileId:t.id,victim:1,random:0});
  expect(s.phase).toBe('action');expect(s.development.robber).toBe(t.id);expect(Object.values(s.players[1].resources).reduce((a,b)=>a+b,0)).toBe(before-1);conserve(s);
  expect(produce({...board,tiles:[t]},s,t.number!).lastProduction.every(p=>Object.values(p).every(n=>n===0))).toBe(true);
 });
 it('buys cards with correct cost, prevents same-turn use, and resets played flag',()=>{
  const {board,state}=fixture();let s={...state,phase:'action' as const};
  let f:GameState=s;for(const k of ['pasture','field','mountain'] as const)f=fund(f,0,k,2);
  const bought=applyGame(board,f,{kind:'buyCard',playerId:0});
  expect(bought.development.deck.length).toBe(f.development.deck.length-1);conserve(bought);
  expect(()=>applyGame(board,bought,{kind:'playCard',playerId:0,cardId:bought.development.hands[0][0].id})).toThrow();
  const next=applyGame(board,{...bought,development:{...bought.development,played:true}},{kind:'end',playerId:0});expect(next.development.played).toBe(false);
 });
 it('knight before rolling resumes roll, does not cause discards and counts knights',()=>{
  const {board,state}=fixture();let s=applyGame(board,card(state,'knight'),{kind:'playCard',playerId:0,cardId:99});
  expect(s.phase).toBe('robber');expect(s.development.knights[0]).toBe(1);expect(s.development.discards).toEqual({});
  const tile=board.tiles.find(t=>t.id!==s.development.robber)!;
  s=applyGame(board,s,{kind:'moveRobber',playerId:0,tileId:tile.id,victim:robberVictims(board,s,tile.id)[0]??null,random:.5});expect(s.phase).toBe('roll');conserve(s);
 });
 it('free roads cost nothing and must connect',()=>{
  const {board,state}=fixture();let s=applyGame(board,card(state,'roads'),{kind:'playCard',playerId:0,cardId:99});
  expect(s.phase).toBe('freeRoad');const bad=board.edges.find(e=>!freeRoadSites(board,s).includes(e.id))!;
  expect(()=>applyGame(board,s,{kind:'freeRoad',playerId:0,edgeId:bad.id})).toThrow();
  for(let i=0;i<2;i++)s=applyGame(board,s,{kind:'freeRoad',playerId:0,edgeId:freeRoadSites(board,s)[0]});
  expect(s.roads.length).toBe(state.roads.length+2);expect(s.bank).toEqual(state.bank);expect(s.phase).toBe('roll');
 });
 it('plenty and monopoly move real resources without creating cards',()=>{
  const {board,state}=fixture();const p=applyGame(board,card(state,'plenty'),{kind:'playCard',playerId:0,cardId:99,resources:['forest','forest']});
  expect(p.bank.forest).toBe(state.bank.forest-2);conserve(p);
  const s=fund(state,1,'hill',3);const m=applyGame(board,card(s,'monopoly'),{kind:'playCard',playerId:0,cardId:99,resource:'hill'});
  expect(m.players.slice(1).every(p=>p.resources.hill===0)).toBe(true);conserve(m);
  expect(()=>applyGame(board,{...p,development:{...p.development,hands:{...p.development.hands,0:[{id:98,kind:'knight',boughtTurn:1}]}}},{kind:'playCard',playerId:0,cardId:98})).toThrow();
 });
});
