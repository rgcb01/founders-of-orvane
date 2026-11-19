import {applyTrade,type TradeAction,type Offer} from './trade';
import type {Board} from './index';
import {emptyResources,type Player,type Resource,type Resources,type SetupState,type Settlement,type Road} from './setup';

export const RESOURCES:Resource[]=['forest','pasture','field','hill','mountain'];
export type BuildKind='road'|'settlement'|'city';
export interface Building extends Settlement {kind:'settlement'|'city'}
export const COSTS:Record<BuildKind,Resources>={
 road:{forest:1,pasture:0,field:0,hill:1,mountain:0},
 settlement:{forest:1,pasture:1,field:1,hill:1,mountain:0},
 city:{forest:0,pasture:0,field:2,hill:0,mountain:3}
};
export interface GameState {
 players:Player[];settlements:Building[];roads:Road[];bank:Resources;
 active:number;turn:number;phase:'roll'|'action';dice:[number,number]|null;
 lastProduction:Resources[];shortages:Resource[];offer:Offer|null;
}
export type GameAction=TradeAction
 | {kind:'roll';playerId:number;dice:[number,number]}
 | {kind:'build';playerId:number;build:BuildKind;id:string}
 | {kind:'end';playerId:number};
export function startGame(board:Board,setup:SetupState):GameState {
 if(setup.phase!=='complete')throw new Error('Setup is incomplete');
 const capacity=board.size==='standard'?19:24;
 const bank=emptyResources();
 for(const k of RESOURCES){
   bank[k]=capacity-setup.players.reduce((sum,p)=>sum+p.resources[k],0);
   if(bank[k]<0)throw new Error('Starting resources exceed bank');
 }
 return {players:setup.players.map(p=>({...p,resources:{...p.resources}})),settlements:setup.settlements.map(s=>({...s,kind:'settlement'})),roads:setup.roads.map(r=>({...r})),bank,active:setup.players[0].id,turn:1,phase:'roll',dice:null,lastProduction:setup.players.map(()=>emptyResources()),shortages:[],offer:null};
}
export function affordable(resources:Resources,kind:BuildKind):boolean {
 return RESOURCES.every(k=>resources[k]>=COSTS[kind][k]);
}
export function legalBuilds(board:Board,state:GameState,kind:BuildKind):string[]{
 if(state.phase!=='action'||state.offer)return [];
 const player=state.players.find(p=>p.id===state.active)!;
 if(!affordable(player.resources,kind))return [];
 const mine=state.settlements.filter(s=>s.playerId===player.id);
 const ownRoads=state.roads.filter(r=>r.playerId===player.id);
 const ownEdges=new Set(ownRoads.map(r=>r.edgeId));
 const ownVertices=new Set(mine.map(s=>s.vertexId));
 const blocked=new Set(state.settlements.filter(s=>s.playerId!==player.id).map(s=>s.vertexId));
 const network=new Set(board.edges.filter(e=>ownEdges.has(e.id)).flatMap(e=>[e.a,e.b]));
 if(kind==='city')return mine.filter(s=>s.kind==='settlement').map(s=>s.vertexId).filter(()=>mine.filter(s=>s.kind==='city').length<4);
 if(kind==='road'){
   if(ownRoads.length>=15)return [];
   const occupied=new Set(state.roads.map(r=>r.edgeId));
   return board.edges.filter(e=>!occupied.has(e.id)&&[e.a,e.b].some(v=>!blocked.has(v)&&(ownVertices.has(v)||network.has(v)))).map(e=>e.id);
 }
 if(mine.filter(s=>s.kind==='settlement').length>=5)return [];
 const occupied=new Set(state.settlements.map(s=>s.vertexId));
 const tooClose=new Set(occupied);
 for(const e of board.edges){
   if(occupied.has(e.a))tooClose.add(e.b);
   if(occupied.has(e.b))tooClose.add(e.a);
 }
 return board.vertices.filter(v=>network.has(v.id)&&!tooClose.has(v.id)).map(v=>v.id);
}
export function produce(board:Board,state:GameState,total:number):Pick<GameState,'players'|'bank'|'lastProduction'|'shortages'> {
 const demand=state.players.map(()=>emptyResources());
 const bank={...state.bank};
 const players=state.players.map(p=>({...p,resources:{...p.resources}}));
 const shortages:Resource[]=[];
 for(const t of board.tiles){
   if(t.number!==total||t.terrain==='desert')continue;
   const resource=t.terrain;
   for(const s of state.settlements){
     if(!t.vertices.includes(s.vertexId))continue;
     const i=players.findIndex(p=>p.id===s.playerId);
     demand[i][resource]+=s.kind==='city'?2:1;
   }
 }
 const lastProduction=players.map(()=>emptyResources());
 for(const k of RESOURCES){
   const totalDemand=demand.reduce((sum,p)=>sum+p[k],0);
   const claimants=demand.filter(p=>p[k]>0).length;
   if(totalDemand>bank[k]){
     shortages.push(k);
     if(claimants>1)continue;
   }
   for(let i=0;i<players.length;i++){
     const grant=Math.min(bank[k],demand[i][k]);
     bank[k]-=grant;players[i].resources[k]+=grant;lastProduction[i][k]=grant;
   }
 }
 return {players,bank,lastProduction,shortages};
}
export function applyGame(board:Board,state:GameState,action:GameAction):GameState {
 if(action.kind!=='roll'&&action.kind!=='build'&&action.kind!=='end')return applyTrade(board,state,action);
 if(state.offer)throw new Error('Resolve pending offer first');
 if(action.playerId!==state.active)throw new Error('Not the active player');
 if(action.kind==='roll'){
   if(state.phase!=='roll'||action.dice.length!==2||action.dice.some(n=>!Number.isInteger(n)||n<1||n>6))throw new Error('Illegal roll');
   const total=action.dice[0]+action.dice[1];
   // Seven produces nothing until robber/discard actions are implemented.
   return {...state,...produce(board,state,total),phase:'action',dice:[...action.dice]};
 }
 if(state.phase!=='action')throw new Error('Roll before acting');
 if(action.kind==='end'){
   const i=state.players.findIndex(p=>p.id===state.active);
   return {...state,active:state.players[(i+1)%state.players.length].id,turn:state.turn+1,phase:'roll',dice:null,lastProduction:state.players.map(()=>emptyResources()),shortages:[]};
 }
 if(!legalBuilds(board,state,action.build).includes(action.id))throw new Error('Illegal construction');
 const bank={...state.bank};
 const players=state.players.map(p=>{
   if(p.id!==state.active)return p;
   const resources={...p.resources};
   for(const k of RESOURCES){resources[k]-=COSTS[action.build][k];bank[k]+=COSTS[action.build][k];}
   return {...p,resources};
 });
 if(action.build==='road')return {...state,players,bank,roads:[...state.roads,{edgeId:action.id,playerId:state.active}]};
 if(action.build==='settlement')return {...state,players,bank,settlements:[...state.settlements,{vertexId:action.id,playerId:state.active,kind:'settlement'}]};
 return {...state,players,bank,settlements:state.settlements.map(s=>s.vertexId===action.id?{...s,kind:'city'}:s)};
}
export function rollDice(random:()=>number=Math.random):[number,number]{
 return [1+Math.floor(random()*6),1+Math.floor(random()*6)];
}
