// Deterministic, bounded two-action tactical search. No unrevealed cards or random rolls.
import type {Board} from './index';
import type {Resource,Resources} from './setup';
import {RESOURCES,COSTS,legalBuilds,type GameAction,type GameState} from './economy';
import {tradeRate} from './trade';
import {playerScore,longestRoad,awardHolder} from './victory';
import {PERSONALITIES,type BotPersonality} from './personality';
export const PLANNER_LIMITS={settlements:3,cities:3,roads:4,trades:6,second:10} as const;
type Choice=Extract<GameAction,{kind:'build'|'bankTrade'}>;
const pips=(n:number|null)=>n===null?0:6-Math.abs(7-n);
const hand=(s:GameState,id:number)=>s.players[id].resources;
const sum=(x:Resources)=>RESOURCES.reduce((n,k)=>n+x[k],0);
function production(board:Board,s:GameState,id:number):Resources{
 const out={forest:0,pasture:0,field:0,hill:0,mountain:0};
 for(const b of s.settlements)if(b.playerId===id)for(const t of board.tiles){
  if(t.id!==s.development.robber&&t.terrain!=='desert'&&t.vertices.includes(b.vertexId))out[t.terrain]+=pips(t.number)*(b.kind==='city'?2:1);
 }
 return out;
}
function buildValue(board:Board,id:string,kind:'settlement'|'city',s:GameState,player:number):number{
 const rate=production(board,s,player);
 const tiles=board.tiles.filter(t=>t.terrain!=='desert'&&t.id!==s.development.robber&&t.vertices.includes(id));
 return tiles.reduce((n,t)=>n+pips(t.number)*(1.5+(rate[t.terrain as Resource]<4?1.1:rate[t.terrain as Resource]<10?.5:0)),0)*(kind==='city'?1.2:1);
}
function frontier(board:Board,s:GameState,id:number):number{
 const occupied=new Set(s.settlements.map(b=>b.vertexId)),blocked=new Set(occupied);
 for(const e of board.edges)if(occupied.has(e.a))blocked.add(e.b);else if(occupied.has(e.b))blocked.add(e.a);
 const reachable=new Set(s.roads.filter(r=>r.playerId===id).flatMap(r=>{const e=board.edges.find(e=>e.id===r.edgeId);return e?[e.a,e.b]:[];}));
 return board.vertices.filter(v=>reachable.has(v.id)&&!blocked.has(v.id)).reduce((n,v)=>Math.max(n,buildValue(board,v.id,'settlement',s,id)),0);
}
function value(board:Board,s:GameState,id:number,style:typeof PERSONALITIES[BotPersonality]):number{
 if(s.winner===id)return 100000;
 const score=playerScore(s,id,true).total,prod=production(board,s,id),h=hand(s,id);
 const income=RESOURCES.reduce((n,k)=>n+prod[k]*(k==='mountain'?1.2:1),0);
 const cards=RESOURCES.reduce((n,k)=>n+Math.min(h[k],3)*(prod[k]<5?2.1:1.5)+Math.max(0,h[k]-3)*.42,0);
 const near=(cost:Resources,weight:number)=>{const missing=RESOURCES.reduce((n,k)=>n+Math.max(0,cost[k]-h[k])/(1+prod[k]/10),0);return weight/(1+missing);};
 const build={...s,phase:'action' as const,offer:null,players:s.players.map(p=>p.id===id?{...p,resources:{forest:24,pasture:24,field:24,hill:24,mountain:24}}:p)};
 const hasCity=legalBuilds(board,build,'city').length>0,hasSettlement=legalBuilds(board,build,'settlement').length>0;
 let potential=0;
 if(hasCity)potential+=near(COSTS.city,4*style.city);
 if(hasSettlement)potential+=near(COSTS.settlement,5*style.settlement);
 const routes=s.roads.filter(r=>r.playerId===id).length;
 const frontierScore=frontier(board,s,id);
 return score*31+income*1.55+cards+potential+Math.min(routes,10)*.65+Math.min(10,frontierScore)*.45*style.road;
}
function legalChoices(board:Board,s:GameState,id:number,style:typeof PERSONALITIES[BotPersonality]):Choice[]{
 if(s.phase!=='action'||s.offer||s.active!==id)return [];
 const scored:{a:Choice;score:number}[]=[];
 for(const kind of ['settlement','city'] as const){
  for(const site of legalBuilds(board,s,kind)){
   scored.push({a:{kind:'build',build:kind,id:site,playerId:id},score:buildValue(board,site,kind,s,id)*(kind==='city'?style.city:style.settlement)});
  }
 }
 const builds=(k:'city'|'settlement',limit:number)=>scored.filter(x=>x.a.kind==='build'&&x.a.build===k).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.a);
 const roads=legalBuilds(board,s,'road').map(edge=>{
  const e=board.edges.find(e=>e.id===edge)!;
  // Prefer routes approaching unoccupied, unblocked productive vertices.
  const occupied=new Set(s.settlements.map(v=>v.vertexId)),blocked=new Set(occupied);
  for(const x of board.edges){if(occupied.has(x.a))blocked.add(x.b);if(occupied.has(x.b))blocked.add(x.a);}
  const available=[e.a,e.b].filter(v=>!blocked.has(v));
  const best=Math.max(0,...available.map(v=>buildValue(board,v,'settlement',s,id)));
  const roadLength=longestRoad(board,{settlements:s.settlements,roads:[...s.roads,{playerId:id,edgeId:edge}]},id);
  const award=awardHolder({...s.awards.roadLengths,[id]:roadLength},5,s.awards.longestRoad)===id&&s.awards.longestRoad!==id?40:0;
  return {a:{kind:'build',build:'road',id:edge,playerId:id} as Choice,score:best*.7+roadLength*1.5+award};
 }).sort((a,b)=>b.score-a.score).slice(0,PLANNER_LIMITS.roads).map(x=>x.a);
 const bankTrades:{a:Choice;score:number}[]=[];const h=hand(s,id);
 for(const give of RESOURCES)for(const want of RESOURCES)if(give!==want&&s.bank[want]>0){
  const rate=tradeRate(board,s,id,give);if(h[give]<rate)continue;
  const after={...h,[give]:h[give]-rate,[want]:h[want]+1},prior=production(board,s,id);
  const utility=(after[want]===COSTS.city[want]&&want!=='give'?5:0)+(after[want]===COSTS.settlement[want]?3:0)+(prior[want]<prior[give]?1:0);
  bankTrades.push({a:{kind:'bankTrade',playerId:id,give,want},score:utility+h[give]-rate});
 }
 bankTrades.sort((a,b)=>b.score-a.score);
 return [...builds('settlement',PLANNER_LIMITS.settlements),...builds('city',PLANNER_LIMITS.cities),...roads,...bankTrades.slice(0,PLANNER_LIMITS.trades).map(x=>x.a)];
}
// Equivalent to the deterministic resource/build portion of the engine, without refreshing all awards for every hypothetical node.
function simulate(board:Board,s:GameState,a:Choice):GameState{
 const id=a.playerId,h=hand(s,id),bank={...s.bank},next={...h};
 if(a.kind==='bankTrade'){
  const rate=tradeRate(board,s,id,a.give);next[a.give]-=rate;next[a.want]++;bank[a.give]+=rate;bank[a.want]--;
 }else{
  for(const k of RESOURCES){next[k]-=COSTS[a.build][k];bank[k]+=COSTS[a.build][k];}
 }
 const players=s.players.map(p=>p.id===id?{...p,resources:next}:p);
 if(a.kind==='bankTrade')return {...s,players,bank};
 if(a.build==='road')return {...s,players,bank,roads:[...s.roads,{edgeId:a.id,playerId:id}]};
 if(a.build==='settlement')return {...s,players,bank,settlements:[...s.settlements,{vertexId:a.id,playerId:id,kind:'settlement'}]};
 return {...s,players,bank,settlements:s.settlements.map(b=>b.vertexId===a.id?{...b,kind:'city' as const}:b)};
}
export function planExpertAction(board:Board,s:GameState,personality:BotPersonality):GameAction|null{
 if(s.phase!=='action'||s.offer)return null;
 const id=s.active,style=PERSONALITIES[personality],baseline=value(board,s,id,style);
 const moves=legalChoices(board,s,id,style);
 if(!moves.length)return null;
 let winner:Choice|null=null,high=baseline+1.5;
 for(const first of moves){
  const after=simulate(board,s,first),initial=value(board,after,id,style),firstIsTrade=first.kind==='bankTrade';
  let merit=initial-(firstIsTrade?1.1:.3);
  if(first.kind==='build'&&first.build==='road'){
   const length=longestRoad(board,after,id);
   if(awardHolder({...after.awards.roadLengths,[id]:length},5,after.awards.longestRoad)===id&&after.awards.longestRoad!==id)merit+=62;
  }
  // Two legal actions in the same action window: trade -> city, road -> settlement, etc.
  const follow=legalChoices(board,after,id,style).slice(0,PLANNER_LIMITS.second);
  for(const second of follow){
    if(firstIsTrade&&second.kind==='bankTrade'&&second.give===first.want&&second.want===first.give)continue;
    const afterSecond=simulate(board,after,second);
    const continuation=baseline+(value(board,afterSecond,id,style)-baseline)*.86-1.5-(firstIsTrade?1.1:0);
    if(continuation>merit)merit=continuation;
  }
  if(merit>high){high=merit;winner=first;}
 }
 return winner;
}
