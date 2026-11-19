import {describe,it,expect} from 'vitest';
import {generateBoard,createSetup,activePlayer,legalSettlements,legalRoads,applySetup,type PlayerCount} from './index';

describe('initial placement',()=>{
 for(const count of [3,4,5,6] as PlayerCount[]){
  it('completes snake order for '+count+' players',()=>{
   const board=generateBoard('setup-'+count,count<=4?'standard':'extended');
   let state=createSetup(board,count);
   const order=[...state.players.map(p=>p.id),...state.players.map(p=>p.id).reverse()];
   expect(state.order).toEqual(order);
   for(const playerId of order){
     expect(activePlayer(state)).toBe(playerId);
     const vertex=legalSettlements(board,state)[0];
     const old=state;
     expect(()=>applySetup(board,state,{kind:'road',id:board.edges[0].id,playerId})).toThrow();
     state=applySetup(board,state,{kind:'settlement',id:vertex,playerId});
     expect(old.settlements.length+1).toBe(state.settlements.length);
     expect(state.phase).toBe('road');
     const edge=legalRoads(board,state)[0];
     const e=board.edges.find(x=>x.id===edge)!;
     expect([e.a,e.b]).toContain(vertex);
     state=applySetup(board,state,{kind:'road',id:edge,playerId});
   }
   expect(state.phase).toBe('complete');
   expect(activePlayer(state)).toBeNull();
   expect(state.settlements).toHaveLength(count*2);
   expect(state.roads).toHaveLength(count*2);
   for(const p of state.players){
     const own=state.settlements.filter(s=>s.playerId===p.id);
     expect(own).toHaveLength(2);
     expect(state.roads.filter(s=>s.playerId===p.id)).toHaveLength(2);
     const tiles=board.vertices.find(v=>v.id===own[1].vertexId)!.tiles.map(id=>board.tiles.find(t=>t.id===id)!);
     for(const resource of Object.keys(p.resources) as (keyof typeof p.resources)[])expect(p.resources[resource]).toBe(tiles.filter(t=>t.terrain===resource).length);
   }
   const occupied=new Set(state.settlements.map(s=>s.vertexId));
   expect(board.edges.some(e=>occupied.has(e.a)&&occupied.has(e.b))).toBe(false);
   expect(()=>applySetup(board,state,{kind:'settlement',id:board.vertices[0].id,playerId:0})).toThrow();
  });
 }
 it('rejects occupied or adjacent vertices, incorrect player and disconnected roads',()=>{
   const board=generateBoard('rules');let state=createSetup(board,4);
   const v=legalSettlements(board,state)[0];
   expect(()=>applySetup(board,state,{kind:'settlement',id:v,playerId:1})).toThrow();
   state=applySetup(board,state,{kind:'settlement',id:v,playerId:0});
   const wrong=board.edges.find(e=>e.a!==v&&e.b!==v)!;
   expect(()=>applySetup(board,state,{kind:'road',id:wrong.id,playerId:0})).toThrow();
   state=applySetup(board,state,{kind:'road',id:legalRoads(board,state)[0],playerId:0});
   expect(legalSettlements(board,state)).not.toContain(v);
   for(const e of board.edges.filter(e=>e.a===v||e.b===v))expect(legalSettlements(board,state)).not.toContain(e.a===v?e.b:e.a);
   expect(()=>applySetup(board,state,{kind:'settlement',id:v,playerId:1})).toThrow();
 });
 it('rejects board/count mismatches',()=>expect(()=>createSetup(generateBoard('x'),6)).toThrow());
});
