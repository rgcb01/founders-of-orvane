import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,applySetup,activePlayer,legalSettlements,legalRoads,startGame,applyGame,legalBuilds,produce,RESOURCES,COSTS,rollDice,type GameState,type Board,type BuildKind,type PlayerCount} from './index';

function fixture(count:PlayerCount=6){
 const board=generateBoard('economy-'+count,count<=4?'standard':'extended');
 let setup=createSetup(board,count);
 while(setup.phase!=='complete'){
   const playerId=activePlayer(setup)!;
   setup=applySetup(board,setup,{kind:'settlement',id:legalSettlements(board,setup)[0],playerId});
   setup=applySetup(board,setup,{kind:'road',id:legalRoads(board,setup)[0],playerId});
 }
 return {board,state:startGame(board,setup)};
}
function conserve(s:GameState,capacity:number){
 for(const k of RESOURCES)expect(s.bank[k]+s.players.reduce((sum,p)=>sum+p.resources[k],0)).toBe(capacity);
}
function fund(s:GameState):GameState{
 const bank={...s.bank};
 const players=s.players.map(p=>{
   if(p.id!==s.active)return p;
   const resources={...p.resources};
   for(const k of RESOURCES){bank[k]-=5;resources[k]+=5;}
   return {...p,resources};
 });
 return {...s,bank,players,phase:'action'};
}
describe('economy',()=>{
 for(const count of [3,4,5,6] as PlayerCount[]){
   it('conserves resources through setup and 100 turns for '+count,()=>{
     let {board,state}=fixture(count);const cap=count<=4?19:24;
     conserve(state,cap);
     for(let i=0;i<100;i++){
       state=applyGame(board,state,{kind:'roll',playerId:state.active,dice:[i%6+1,(i*5+2)%6+1]});
       conserve(state,cap);
       state=applyGame(board,state,{kind:'end',playerId:state.active});
       expect(state.active).toBe((i+1)%count);
     }
   });
 }
 it('rejects out-of-turn actions, duplicate rolls and invalid dice',()=>{
   const {board,state}=fixture();
   expect(()=>applyGame(board,state,{kind:'end',playerId:0})).toThrow();
   expect(()=>applyGame(board,state,{kind:'roll',playerId:1,dice:[1,1]})).toThrow();
   expect(()=>applyGame(board,state,{kind:'roll',playerId:0,dice:[0,6]})).toThrow();
   const rolled=applyGame(board,state,{kind:'roll',playerId:0,dice:[3,4]});
   expect(rolled.players).toEqual(state.players);
   expect(()=>applyGame(board,rolled,{kind:'roll',playerId:0,dice:[1,1]})).toThrow();
   expect(rollDice(()=>0)).toEqual([1,1]);
   expect(rollDice(()=>.999)).toEqual([6,6]);
 });
 it('pays all construction costs back to bank and upgrades cities',()=>{
   const {board,state}=fixture();
   let s=fund(state);
   const city=legalBuilds(board,s,'city')[0];
   const upgraded=applyGame(board,s,{kind:'build',playerId:0,build:'city',id:city});
   expect(upgraded.settlements.find(b=>b.vertexId===city)?.kind).toBe('city');
   for(const k of RESOURCES)expect(upgraded.bank[k]).toBe(s.bank[k]+COSTS.city[k]);
   conserve(upgraded,24);
   expect(()=>applyGame(board,upgraded,{kind:'build',playerId:0,build:'city',id:city})).toThrow();
   const road=legalBuilds(board,s,'road')[0];
   s=applyGame(board,s,{kind:'build',playerId:0,build:'road',id:road});
   expect(s.roads.some(r=>r.edgeId===road&&r.playerId===0)).toBe(true);
   expect(()=>applyGame(board,s,{kind:'build',playerId:0,build:'road',id:road})).toThrow();
   conserve(s,24);
 });
 it('requires funds, distance and connected roads for settlements',()=>{
   const {board,state}=fixture();
   let s=fund(state);
   const target=board.vertices.find(v=>!s.settlements.some(b=>b.vertexId===v.id)&&!board.edges.some(e=>(e.a===v.id&&s.settlements.some(b=>b.vertexId===e.b))||(e.b===v.id&&s.settlements.some(b=>b.vertexId===e.a))))!;
   const edge=board.edges.find(e=>e.a===target.id||e.b===target.id)!;
   s={...s,roads:[{edgeId:edge.id,playerId:0}]};
   expect(legalBuilds(board,s,'settlement')).toContain(target.id);
   const built=applyGame(board,s,{kind:'build',playerId:0,build:'settlement',id:target.id});
   expect(built.settlements.some(b=>b.vertexId===target.id&&b.playerId===0)).toBe(true);
   conserve(built,24);
   expect(legalBuilds(board,{...s,roads:[]},'settlement')).toEqual([]);
   expect(legalBuilds(board,{...s,players:s.players.map(p=>({...p,resources:{forest:0,pasture:0,field:0,hill:0,mountain:0}}))},'settlement')).toEqual([]);
 });
 it('blocks continuation through opponent buildings and enforces piece caps',()=>{
   const {board,state}=fixture();
   const s=fund(state);
   const e=board.edges.find(e=>board.edges.some(x=>x.id!==e.id&&(x.a===e.b||x.b===e.b)))!;
   const next=board.edges.find(x=>x.id!==e.id&&(x.a===e.b||x.b===e.b))!;
   const blocked={...s,roads:[{edgeId:e.id,playerId:0}],settlements:[{vertexId:e.b,playerId:1,kind:'settlement' as const}]};
   expect(legalBuilds(board,blocked,'road')).not.toContain(next.id);
   const capped={...s,roads:board.edges.slice(0,15).map(e=>({edgeId:e.id,playerId:0}))};
   expect(legalBuilds(board,capped,'road')).toEqual([]);
 });
 it('produces one per settlement and two per city, handles shortages',()=>{
   const {board,state}=fixture();
   const tile=board.tiles.find(t=>t.terrain!=='desert')!;
   const k=tile.terrain as typeof RESOURCES[number];
   const s={...state,settlements:[{vertexId:tile.vertices[0],playerId:0,kind:'city' as const},{vertexId:tile.vertices[3],playerId:1,kind:'settlement' as const}]};
   // Isolate the tile so adjacent matching tokens cannot add demand.
   const isolated:Board={...board,tiles:[tile]};
   const p=produce(isolated,s,tile.number!);
   expect(p.lastProduction[0][k]).toBe(2);expect(p.lastProduction[1][k]).toBe(1);
   const scarce=produce(isolated,{...s,bank:{...s.bank,[k]:2}},tile.number!);
   expect(scarce.lastProduction.every(r=>r[k]===0)).toBe(true);
   expect(scarce.shortages).toContain(k);
   const single=produce(isolated,{...s,settlements:[s.settlements[0]],bank:{...s.bank,[k]:1}},tile.number!);
   expect(single.lastProduction[0][k]).toBe(1);
 });
});
