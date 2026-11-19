import type {Board,Terrain} from './index';

export type PlayerCount=3|4|5|6;
export type Resource=Exclude<Terrain,'desert'>;
export type Resources=Record<Resource,number>;
export interface Player {id:number;name:string;color:string;resources:Resources}
export interface Settlement {vertexId:string;playerId:number}
export interface Road {edgeId:string;playerId:number}
export interface SetupState {
 players:Player[];order:number[];step:number;phase:'settlement'|'road'|'complete';
 pendingVertex:string|null;settlements:Settlement[];roads:Road[];
}
export type SetupAction={kind:'settlement'|'road';id:string;playerId:number};
export const COLORS=['#e05b4f','#477fe4','#f1c44f','#45b782','#ad78dc','#f0a0be'];
export function emptyResources():Resources{return {forest:0,pasture:0,field:0,hill:0,mountain:0};}
export function createSetup(board:Board,count:PlayerCount,firstPlayer=0):SetupState {
 if(![3,4,5,6].includes(count))throw new Error('Invalid player count');
 if((count<=4)!==(board.size==='standard'))throw new Error('Board size does not match player count');
 const players=Array.from({length:count},(_,id)=>({id,name:'Player '+(id+1),color:COLORS[id],resources:emptyResources()}));
 if(!Number.isInteger(firstPlayer)||firstPlayer<0||firstPlayer>=count)throw new Error('Invalid first player');
 const ids=Array.from({length:count},(_,i)=>(i+firstPlayer)%count);
 return {players,order:[...ids,...ids.slice().reverse()],step:0,phase:'settlement',pendingVertex:null,settlements:[],roads:[]};
}
export function activePlayer(state:SetupState):number|null{return state.phase==='complete'?null:state.order[state.step];}
export function legalSettlements(board:Board,state:SetupState):string[]{
 if(state.phase!=='settlement')return [];
 const blocked=new Set(state.settlements.map(s=>s.vertexId));
 for(const e of board.edges){
   if(state.settlements.some(s=>s.vertexId===e.a))blocked.add(e.b);
   if(state.settlements.some(s=>s.vertexId===e.b))blocked.add(e.a);
 }
 return board.vertices.filter(v=>!blocked.has(v.id)).map(v=>v.id);
}
export function legalRoads(board:Board,state:SetupState):string[]{
 if(state.phase!=='road'||state.pendingVertex===null)return [];
 const occupied=new Set(state.roads.map(r=>r.edgeId));
 return board.edges.filter(e=>(e.a===state.pendingVertex||e.b===state.pendingVertex)&&!occupied.has(e.id)).map(e=>e.id);
}
export function applySetup(board:Board,state:SetupState,action:SetupAction):SetupState {
 if(activePlayer(state)!==action.playerId)throw new Error('Not the active player');
 if(action.kind==='settlement'){
   if(!legalSettlements(board,state).includes(action.id))throw new Error('Illegal settlement');
   let players=state.players;
   if(state.step>=state.players.length){
     const vertex=board.vertices.find(v=>v.id===action.id)!;
     const grant=emptyResources();
     for(const id of vertex.tiles){
       const t=board.tiles.find(t=>t.id===id)!;
       if(t.terrain!=='desert')grant[t.terrain]++;
     }
     players=players.map(p=>p.id===action.playerId?{...p,resources:{forest:p.resources.forest+grant.forest,pasture:p.resources.pasture+grant.pasture,field:p.resources.field+grant.field,hill:p.resources.hill+grant.hill,mountain:p.resources.mountain+grant.mountain}}:p);
   }
   return {...state,players,phase:'road',pendingVertex:action.id,settlements:[...state.settlements,{vertexId:action.id,playerId:action.playerId}]};
 }
 if(!legalRoads(board,state).includes(action.id))throw new Error('Illegal road');
 const step=state.step+1;
 return {...state,step,phase:step===state.order.length?'complete':'settlement',pendingVertex:null,roads:[...state.roads,{edgeId:action.id,playerId:action.playerId}]};
}

export function chooseFirstPlayer(count:PlayerCount,random:()=>number=Math.random):number{
 let candidates=Array.from({length:count},(_,i)=>i);
 // Tied highest players reroll. Randomness is injected for reproducible tests.
 while(candidates.length>1){
   const rolls=candidates.map(id=>({id,total:2+Math.floor(random()*6)+Math.floor(random()*6)}));
   const highest=Math.max(...rolls.map(r=>r.total));candidates=rolls.filter(r=>r.total===highest).map(r=>r.id);
 }
 return candidates[0];
}
