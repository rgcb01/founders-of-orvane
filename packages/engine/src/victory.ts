import type {Board,Edge} from './index';
import type {GameState} from './economy';

export interface Awards {longestRoad:number|null;largestArmy:number|null;roadLengths:Record<number,number>}
export interface Score {buildings:number;road:number;army:number;hidden:number;total:number}
export const VICTORY_TARGET=10;
// Longest trail: edges cannot repeat; vertices may repeat; opposing buildings terminate traversal.
export function longestRoad(board:Board,state:Pick<GameState,'roads'|'settlements'>,playerId:number):number{
 const owned=new Set(state.roads.filter(r=>r.playerId===playerId).map(r=>r.edgeId));
 const blocked=new Set(state.settlements.filter(s=>s.playerId!==playerId).map(s=>s.vertexId));
 const graph=new Map<string,Edge[]>();
 for(const e of board.edges.filter(e=>owned.has(e.id)))for(const v of [e.a,e.b])graph.set(v,[...(graph.get(v)??[]),e]);
 let best=0;
 const used=new Set<string>();
 function dfs(v:string,n:number){
   best=Math.max(best,n);
   if(n>0&&blocked.has(v))return;
   for(const e of graph.get(v)??[]){
     if(used.has(e.id))continue;
     used.add(e.id);dfs(e.a===v?e.b:e.a,n+1);used.delete(e.id);
   }
 }
 for(const v of graph.keys())dfs(v,0);
 return best;
}
export function awardHolder(values:Record<number,number>,minimum:number,previous:number|null):number|null{
 const max=Math.max(0,...Object.values(values));
 if(max<minimum)return null;
 const leaders=Object.keys(values).map(Number).filter(id=>values[id]===max);
 if(previous!==null&&leaders.includes(previous))return previous;
 return leaders.length===1?leaders[0]:null;
}
export function refreshAwards(board:Board,s:GameState):Awards{
 const roadLengths=Object.fromEntries(s.players.map(p=>[p.id,longestRoad(board,s,p.id)]));
 return {roadLengths,longestRoad:awardHolder(roadLengths,5,s.awards.longestRoad),largestArmy:awardHolder(s.development.knights,3,s.awards.largestArmy)};
}
export function playerScore(s:GameState,id:number,revealHidden=false):Score{
 const buildings=s.settlements.filter(b=>b.playerId===id).reduce((n,b)=>n+(b.kind==='city'?2:1),0);
 const road=s.awards.longestRoad===id?2:0,army=s.awards.largestArmy===id?2:0;
 const hidden=revealHidden?s.development.hands[id].filter(c=>c.kind==='victory').length:0;
 return {buildings,road,army,hidden,total:buildings+road+army+hidden};
}
export function evaluateVictory(board:Board,s:GameState):GameState{
 const next={...s,awards:refreshAwards(board,s)};
 // Mandatory robber/discard or card effects finish before the action window resumes.
 if((next.phase==='action'||next.phase==='roll')&&playerScore(next,next.active,true).total>=VICTORY_TARGET)
   return {...next,phase:'finished',winner:next.active};
 return next;
}
