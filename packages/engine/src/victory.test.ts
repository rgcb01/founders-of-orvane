import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,playerScore,longestRoad,awardHolder,refreshAwards,evaluateVictory,emptyResources,chooseFirstPlayer,type GameState,type Board,type Edge,type PlayerCount} from './index';
function fixture(count:PlayerCount=6,first=0){
 const board=generateBoard('victory-'+count,count<=4?'standard':'extended');let setup=createSetup(board,count,first);
 while(setup.phase!=='complete'){const playerId=activePlayer(setup)!;setup=applySetup(board,setup,{kind:'settlement',playerId,id:legalSettlements(board,setup)[0]});setup=applySetup(board,setup,{kind:'road',playerId,id:legalRoads(board,setup)[0]});}
 return {board,state:startGame(board,setup,()=>.99)};
}
function graph(pairs:[string,string][]):Board{
 const edges:Edge[]=pairs.map(([a,b],i)=>({id:String(i),a,b,tiles:[]}));
 return {...generateBoard('graph'),edges};
}
describe('victory awards and paired players',()=>{
 it('counts a chain, branch, cycle, and an interrupted trail correctly',()=>{
   const chain=graph([['a','b'],['b','c'],['c','d'],['d','e'],['e','f']]);
   const roads=chain.edges.map(e=>({edgeId:e.id,playerId:0}));
   expect(longestRoad(chain,{roads,settlements:[]},0)).toBe(5);
   expect(longestRoad(chain,{roads,settlements:[{vertexId:'c',playerId:1,kind:'settlement'}]},0)).toBe(3);
   expect(longestRoad(chain,{roads,settlements:[{vertexId:'c',playerId:0,kind:'settlement'}]},0)).toBe(5);
   const branch=graph([['a','b'],['b','c'],['c','d'],['c','e'],['e','f']]);
   expect(longestRoad(branch,{roads,settlements:[]},0)).toBe(4);
   const cycle=graph([['a','b'],['b','c'],['c','d'],['d','a'],['a','e']]);
   expect(longestRoad(cycle,{roads,settlements:[]},0)).toBe(5);
   expect(longestRoad(cycle,{roads:roads.slice(0,3),settlements:[]},0)).toBe(3);
 });
 it('awards minimums, incumbent ties, transfers and clears ties without incumbent',()=>{
   expect(awardHolder({0:4,1:3},5,null)).toBeNull();
   expect(awardHolder({0:5,1:5},5,null)).toBeNull();
   expect(awardHolder({0:5,1:5},5,0)).toBe(0);
   expect(awardHolder({0:5,1:6},5,0)).toBe(1);
   expect(awardHolder({0:4,1:5,2:5},5,0)).toBeNull();
   expect(awardHolder({0:3,1:2},3,null)).toBe(0);
   const {board,state}=fixture();const next={...state,development:{...state.development,knights:{...state.development.knights,1:3}}};
   expect(refreshAwards(board,next).largestArmy).toBe(1);
 });
 it('ends immediately on active player victory; hides VP cards until revealed',()=>{
   const {board,state}=fixture();
   const s:GameState={...state,phase:'action',settlements:state.settlements.map(b=>b.playerId===0?{...b,kind:'city'}:b),development:{...state.development,knights:{...state.development.knights,0:3},hands:{...state.development.hands,0:Array.from({length:4},(_,i)=>({id:i,kind:'victory' as const,boughtTurn:1}))}}};
   const won=evaluateVictory(board,s);
   expect(won.winner).toBe(0);expect(won.phase).toBe('finished');
   expect(playerScore(won,0).total).toBe(6);expect(playerScore(won,0,true).total).toBe(10);
   expect(()=>applyGame(board,won,{kind:'end',playerId:0})).toThrow();
   const notYet=evaluateVictory(board,{...s,active:1});expect(notYet.winner).toBeNull();
   const whenActive=evaluateVictory(board,{...notYet,active:0});expect(whenActive.winner).toBe(0);
 });
 for(const n of [5,6] as PlayerCount[])it('pairs third seat and rotates correctly for '+n,()=>{
   const {board,state}=fixture(n);let s=state;
   for(let i=0;i<n;i++){
     expect(s.active).toBe(i);expect(s.phase).toBe('roll');
     s=applyGame(board,s,{kind:'roll',playerId:i,dice:[1,1]});
     s=applyGame(board,s,{kind:'end',playerId:i});
     expect(s.active).toBe((i+3)%n);expect(s.primary).toBe(i);expect(s.paired).toBe(true);expect(s.phase).toBe('action');
     expect(()=>applyGame(board,s,{kind:'roll',playerId:s.active,dice:[1,1]})).toThrow();
     expect(()=>applyGame(board,s,{kind:'offer',playerId:s.active,to:i,give:{...emptyResources(),forest:1},want:{...emptyResources(),hill:1}})).toThrow(/supply/);
     s=applyGame(board,s,{kind:'end',playerId:s.active});
     expect(s.round).toBe(i+2);
   }
   expect(s.active).toBe(0);
 });
 it('allows paired bank trade and a card bought on an earlier action window',()=>{
   const {board,state}=fixture();let s=applyGame(board,state,{kind:'roll',playerId:0,dice:[1,1]});
   s=applyGame(board,s,{kind:'end',playerId:0});
   const actor=s.active;
   s={...s,players:s.players.map(p=>p.id===actor?{...p,resources:{...p.resources,forest:5}}:p),development:{...s.development,hands:{...s.development.hands,[actor]:[{id:999,kind:'monopoly',boughtTurn:s.turn-1}]}}};
   s=applyGame(board,s,{kind:'bankTrade',playerId:actor,give:'forest',want:'hill'});
   s=applyGame(board,s,{kind:'playCard',playerId:actor,cardId:999,resource:'forest'});
   expect(s.development.played).toBe(true);expect(s.phase).toBe('action');
 });
 it('paired player can win before next roll',()=>{
   const {board,state}=fixture();const s:GameState={...state,phase:'action',settlements:state.settlements.map(b=>b.playerId===3?{...b,kind:'city'}:b),development:{...state.development,knights:{...state.development.knights,3:3},hands:{...state.development.hands,3:Array.from({length:4},(_,i)=>({id:i,kind:'victory' as const,boughtTurn:1}))}}};
   const won=applyGame(board,s,{kind:'end',playerId:0});expect(won.winner).toBe(3);expect(won.phase).toBe('finished');
 });
 it('supports nonzero starting player and rerolls ties',()=>{
   const seq=[.5,.5,.5,.5,0,0,.1,.1,.9,.9];let i=0;
   expect(chooseFirstPlayer(3,()=>seq[i++])).toBe(1);
   const {state}=fixture(5,2);expect(state.active).toBe(2);expect(state.primary).toBe(2);
 });
});
