import {RESOURCES,tradeRate,type Board,type GameState} from '@orvane/engine';
export interface MatchMetrics {produced:number;trades:number;bankTrades:number;roads:number;settlements:number;cities:number;longestRoad:number;largestArmy:boolean}
export const EMPTY_METRICS:MatchMetrics={produced:0,trades:0,bankTrades:0,roads:0,settlements:0,cities:0,longestRoad:0,largestArmy:false};
export function validMetrics(v:unknown):v is MatchMetrics{
 if(!v||typeof v!=='object')return false;const m=v as MatchMetrics;
 return (['produced','trades','bankTrades','roads','settlements','cities','longestRoad'] as const).every(k=>Number.isSafeInteger(m[k])&&m[k]>=0)&&m.longestRoad<=15&&m.cities<=4&&typeof m.largestArmy==='boolean';
}
export function advanceMetrics(board:Board,old:MatchMetrics,before:GameState|null,after:GameState|null):MatchMetrics{
 if(!after||before?.phase==='finished')return old;
 const result={...old,longestRoad:Math.max(old.longestRoad,after.awards.roadLengths[0]??0),largestArmy:old.largestArmy||after.awards.largestArmy===0,cities:Math.max(old.cities,after.settlements.filter(s=>s.playerId===0&&s.kind==='city').length)};
 if(!before)return result;
 // A primary roll always starts with dice=null; paired turns never roll.
 if(before.phase==='roll'&&before.dice===null&&after.dice!==null&&before.turn===after.turn)result.produced+=RESOURCES.reduce((n,k)=>n+after.lastProduction[0][k],0);
 result.roads+=after.roads.filter(x=>x.playerId===0&&!before.roads.some(y=>y.edgeId===x.edgeId)).length;
 result.settlements+=after.settlements.filter(x=>x.playerId===0&&!before.settlements.some(y=>y.vertexId===x.vertexId)).length;
 const offer=before.offer;
 if(offer&&!after.offer&&(offer.from===0||offer.to===0)&&before.turn===after.turn){
   const accepted=before.players.every(p=>RESOURCES.every(k=>after.players[p.id].resources[k]-p.resources[k]===(p.id===offer.from?offer.want[k]-offer.give[k]:p.id===offer.to?offer.give[k]-offer.want[k]:0)));
   if(accepted)result.trades++;
 }
 if(!before.offer&&!after.offer&&before.active===0&&before.phase==='action'&&before.turn===after.turn){
   const delta=RESOURCES.map(k=>({k,n:after.players[0].resources[k]-before.players[0].resources[k]}));
   const give=delta.find(x=>x.n<0),want=delta.find(x=>x.n>0);
   if(give&&want&&want.n===1&&-give.n===tradeRate(board,before,0,give.k)&&delta.filter(x=>x.n!==0).length===2&&delta.every(x=>after.bank[x.k]-before.bank[x.k]===-x.n)&&before.development.played===after.development.played&&before.development.deck.length===after.development.deck.length)result.bankTrades++;
 }
 return result;
}
