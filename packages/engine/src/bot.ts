import type {Board} from './index';
import {emptyResources,activePlayer,legalSettlements,legalRoads,type SetupState,type SetupAction,type Resource,type Resources} from './setup';
import {RESOURCES,COSTS,legalBuilds,rollDice,type GameState,type GameAction,type BuildKind} from './economy';
import {canBuy,canPlay,freeRoadSites,robberVictims,CARD_COST} from './development';
import {tradeRate} from './trade';
import {playerScore,longestRoad} from './victory';

export type Difficulty='easy'|'normal'|'hard'|'expert';
export interface BotOptions {difficulty:Difficulty;random?:()=>number;offers?:number}
const rich={forest:24,pasture:24,field:24,hill:24,mountain:24};
const sum=(r:Resources)=>RESOURCES.reduce((n,k)=>n+r[k],0);
const pips=(n:number|null)=>n===null?0:6-Math.abs(7-n);
const bundle=(k:Resource,n=1)=>({...emptyResources(),[k]:n});
const deficit=(hand:Resources,cost:Resources)=>RESOURCES.reduce((n,k)=>n+Math.max(0,cost[k]-hand[k]),0);
function best<T>(items:T[],score:(x:T)=>number):T|undefined{
 let winner:T|undefined,high=-Infinity;for(const x of items){const value=score(x);if(value>high){high=value;winner=x;}}return winner;
}
function quality(board:Board,id:string,owned:string[]=[]):number{
 const v=board.vertices.find(v=>v.id===id)!;
 const tiles=board.tiles.filter(t=>v.tiles.includes(t.id)&&t.terrain!=='desert');
 const prior=new Set(board.tiles.filter(t=>owned.some(x=>t.vertices.includes(x))).map(t=>t.terrain));
 const variety=new Set(tiles.map(t=>t.terrain));
 const harbor=board.harbors.some(h=>{const e=board.edges.find(e=>e.id===h.edgeId)!;return e.a===id||e.b===id;});
 return tiles.reduce((n,t)=>n+pips(t.number),0)+variety.size*1.6+[...variety].filter(k=>!prior.has(k)).length*2.1+(harbor?1.4:0);
}
function vacant(board:Board,occupied:Set<string>):string[]{
 const blocked=new Set(occupied);
 for(const e of board.edges){if(occupied.has(e.a))blocked.add(e.b);if(occupied.has(e.b))blocked.add(e.a);}
 return board.vertices.filter(v=>!blocked.has(v.id)).map(v=>v.id);
}
function expansion(board:Board,playerId:number,buildings:{vertexId:string;playerId:number}[],roads:{edgeId:string;playerId:number}[],candidates:string[]):{id:string;value:number}|undefined{
 const own=buildings.filter(b=>b.playerId===playerId).map(b=>b.vertexId);
 const targets=new Set(vacant(board,new Set(buildings.map(b=>b.vertexId))));
 const blocked=new Set(buildings.filter(b=>b.playerId!==playerId).map(b=>b.vertexId));
 const used=new Set(roads.map(r=>r.edgeId));
 const network=new Set(board.edges.filter(e=>roads.some(r=>r.playerId===playerId&&r.edgeId===e.id)).flatMap(e=>[e.a,e.b]));
 for(const v of own)network.add(v);
 const adjacency=new Map<string,{id:string;to:string}[]>();
 for(const e of board.edges){if(used.has(e.id))continue;for(const [a,b] of [[e.a,e.b],[e.b,e.a]])adjacency.set(a,[...(adjacency.get(a)??[]),{id:e.id,to:b}]);}
 const scores=new Map<string,number>();
 for(const id of candidates){
   const e=board.edges.find(x=>x.id===id)!;
   const queue=[e.a,e.b].filter(v=>!network.has(v)&&!blocked.has(v)).map(v=>({v,depth:1}));
   const seen=new Set(queue.map(x=>x.v));let value=-20;
   while(queue.length){
     const {v,depth}=queue.shift()!;
     if(targets.has(v)&&!network.has(v))value=Math.max(value,quality(board,v,own)/(depth+.3)-depth*1.7);
     if(depth>=4)continue;
     for(const n of adjacency.get(v)??[]){if(n.id===id||seen.has(n.to)||blocked.has(n.to)||network.has(n.to))continue;seen.add(n.to);queue.push({v:n.to,depth:depth+1});}
   }
   scores.set(id,value);
 }
 const id=best(candidates,x=>scores.get(x)!);return id===undefined?undefined:{id,value:scores.get(id)!};
}
export function chooseSetupAction(board:Board,s:SetupState,options:BotOptions):SetupAction|null{
 const playerId=activePlayer(s);if(playerId===null)return null;
 const random=options.random??Math.random;
 const own=s.settlements.filter(b=>b.playerId===playerId).map(b=>b.vertexId);
 const sites=s.phase==='settlement'?legalSettlements(board,s):legalRoads(board,s);
 if(!sites.length)throw new Error('No setup action');
 const id=options.difficulty==='easy'?sites[Math.floor(random()*sites.length)]:s.phase==='settlement'?best(sites,x=>quality(board,x,own)+random()*(options.difficulty==='normal'?4:options.difficulty==='expert'?0:.5))!:expansion(board,playerId,s.settlements,s.roads,sites)?.id??sites[0];
 return {kind:s.phase==='settlement'?'settlement':'road',id,playerId};
}
// A policy sees its own hand, public card counts, board, bank, and public awards.
// Do not inspect opponent resource composition, hidden victory cards or deck order.
export function botView(s:GameState,actor:number):GameState{
 return {...s,players:s.players.map(p=>p.id===actor?{...p,resources:{...p.resources}}:{...p,resources:{...emptyResources(),forest:sum(p.resources)}}),
 development:{...s.development,deck:Array(s.development.deck.length).fill('knight'),hands:Object.fromEntries(s.players.map(p=>[p.id,p.id===actor?s.development.hands[p.id].map(c=>({...c})):[]]))}};
}
export function decisionPlayer(s:GameState):number|null{
 if(s.phase==='finished')return null;
 if(s.offer)return s.offer.to;
 if(s.phase==='discard')return s.players.find(p=>s.development.discards[p.id]>0)?.id??null;
 return s.active;
}
type Goal={cost:Resources;weight:number};
function goals(board:Board,s:GameState,id:number):Goal[]{
 // Hypothetical funds expose legal geometry without relying on future rolls.
 const probe={...s,active:id,offer:null,phase:'action' as const,players:s.players.map(p=>p.id===id?{...p,resources:rich}:p)};
 const list:Goal[]=[];
 const settled=legalBuilds(board,probe,'settlement'),cities=legalBuilds(board,probe,'city'),roads=legalBuilds(board,probe,'road');
 const path=expansion(board,id,s.settlements,s.roads,roads);
 if(settled.length)list.push({cost:COSTS.settlement,weight:12});
 if(cities.length)list.push({cost:COSTS.city,weight:11});
 if(path&&path.value>0&&!settled.length)list.push({cost:COSTS.road,weight:8});
 if(s.development.deck.length)list.push({cost:CARD_COST,weight:7});
 if(roads.length)list.push({cost:COSTS.road,weight:4});
 return list;
}
function handValue(hand:Resources,gs:Goal[]):number{
 return gs.reduce((n,g)=>n+g.weight/(1+deficit(hand,g.cost))**2,0)+RESOURCES.reduce((n,k)=>n+Math.min(hand[k],3)*.22+Math.max(0,hand[k]-3)*.04,0);
}
function simulateHand(hand:Resources,give:Resources,want:Resources):Resources{
 const result=emptyResources();for(const k of RESOURCES)result[k]=hand[k]-give[k]+want[k];return result;
}
export function chooseBotAction(board:Board,raw:GameState,options:BotOptions):GameAction|null{
 const id=decisionPlayer(raw);if(id===null)return null;
 const s=botView(raw,id),random=options.random??Math.random,difficulty=options.difficulty;
 const hand=s.players.find(p=>p.id===id)!.resources,gs=goals(board,s,id),base=handValue(hand,gs);
 const value=(h:Resources)=>handValue(h,gs);
 if(s.offer){
   const o=s.offer,affordable=RESOURCES.every(k=>hand[k]>=o.want[k]);
   const gain=affordable?value(simulateHand(hand,o.want,o.give))-base:-Infinity;
   const leader=playerScore(s,o.from).total>=8;
   if(affordable&&gain>(leader?2.0:difficulty==='easy'?-.25:.1))return {kind:'accept',playerId:id};
   if((options.offers??0)<2&&difficulty!=='easy'&&sum(o.want)>1){
     const k=best(RESOURCES.filter(k=>o.want[k]>0&&hand[k]>0),k=>value(simulateHand(hand,bundle(k),o.give)));
     if(k&&value(simulateHand(hand,bundle(k),o.give))>base+.5)return {kind:'counter',playerId:id,give:bundle(k),want:o.give};
   }
   return {kind:'reject',playerId:id};
 }
 if(s.phase==='discard'){
   const resources=emptyResources(),remaining={...hand};
   for(let n=0;n<s.development.discards[id];n++){
     const k=best(RESOURCES.filter(k=>remaining[k]>0),k=>value({...remaining,[k]:remaining[k]-1}))!;
     resources[k]++;remaining[k]--;
   }
   return {kind:'discard',playerId:id,resources};
 }
 if(s.phase==='robber'){
   const t=best(board.tiles.filter(t=>t.id!==s.development.robber),t=>s.settlements.filter(b=>t.vertices.includes(b.vertexId)).reduce((n,b)=>n+(b.playerId===id?-3:1+playerScore(s,b.playerId).total*.25)*pips(t.number)*(b.kind==='city'?2:1),0)+robberVictims(board,s,t.id).length*.4+random()*.2)!;
   const victim=best(robberVictims(board,s,t.id),p=>playerScore(s,p).total+sum(s.players.find(x=>x.id===p)!.resources)*.08)??null;
   return {kind:'moveRobber',playerId:id,tileId:t.id,victim,random:random()};
 }
 if(s.phase==='freeRoad'){
   const sites=freeRoadSites(board,s);
   const edgeId=expansion(board,id,s.settlements,s.roads,sites)?.id??sites[0];
   return {kind:'freeRoad',playerId:id,edgeId};
 }
 const playable=s.development.hands[id].filter(c=>canPlay(s,c));
 for(const card of playable){
   if(card.kind==='knight')return {kind:'playCard',playerId:id,cardId:card.id};
   if(card.kind==='roads'&&freeRoadSites(board,{...s,phase:'freeRoad'}).length)return {kind:'playCard',playerId:id,cardId:card.id};
   if(card.kind==='plenty'&&sum(s.bank)>0){
     const bank={...s.bank},h={...hand},resources:Resource[]=[];
     for(let i=0;i<Math.min(2,sum(s.bank));i++){const k=best(RESOURCES.filter(k=>bank[k]>0),k=>value({...h,[k]:h[k]+1}))!;bank[k]--;h[k]++;resources.push(k);}
     return {kind:'playCard',playerId:id,cardId:card.id,resources};
   }
   if(card.kind==='monopoly'){
     // Total supply minus bank and own hand reveals only aggregate opponent holdings.
     const cap=board.size==='standard'?19:24;
     const k=best(RESOURCES,k=>value({...hand,[k]:hand[k]+Math.max(0,cap-s.bank[k]-hand[k])}))!;
     if(cap-s.bank[k]-hand[k]>=3)return {kind:'playCard',playerId:id,cardId:card.id,resource:k};
   }
 }
 if(s.phase==='roll')return {kind:'roll',playerId:id,dice:rollDice(random)};
 const own=s.settlements.filter(b=>b.playerId===id).map(b=>b.vertexId);
 const sites=legalBuilds(board,s,'settlement'),cities=legalBuilds(board,s,'city'),roads=legalBuilds(board,s,'road');
 const score=playerScore(s,id,true).total;
 if(difficulty==='expert'&&cities.length&&sites.length&&score>=9)return {kind:'build',playerId:id,build:'city',id:best(cities,x=>quality(board,x))!};
 if(sites.length)return {kind:'build',playerId:id,build:'settlement',id:best(sites,x=>quality(board,x,own)+random()*(difficulty==='easy'?10:difficulty==='expert'?0:1))!};
 if(cities.length)return {kind:'build',playerId:id,build:'city',id:best(cities,x=>quality(board,x))!};
 const path=expansion(board,id,s.settlements,s.roads,roads);
 const roadAward=best(roads,e=>longestRoad(board,{settlements:s.settlements,roads:[...s.roads,{edgeId:e,playerId:id}]},id));
 const potential=roadAward?longestRoad(board,{settlements:s.settlements,roads:[...s.roads,{edgeId:roadAward,playerId:id}]},id):0;
 const awardThreshold=Math.max(5,...s.players.filter(p=>p.id!==id).map(p=>s.awards.roadLengths[p.id]+1));
 if(roadAward&&s.awards.longestRoad!==id&&potential>=awardThreshold)return {kind:'build',playerId:id,build:'road',id:roadAward};
 if(path&&path.value>0&&s.settlements.filter(b=>b.playerId===id&&b.kind==='settlement').length<5)return {kind:'build',playerId:id,build:'road',id:path.id};
 // Negotiate only when a mutually useful one-card exchange can improve our plan;
 // choose a partner by public hand size and public score, not hidden card types.
 if(!s.paired&&(options.offers??0)<2&&difficulty!=='easy'){
   const pairs=RESOURCES.flatMap(give=>RESOURCES.filter(want=>want!==give&&hand[give]>0).map(want=>({give,want,gain:value(simulateHand(hand,bundle(give),bundle(want)))-base})));
   const pair=best(pairs,p=>p.gain);
   const partners=s.players.filter(p=>p.id!==id&&sum(p.resources)>0&&playerScore(s,p.id).total<9);
   const partner=best(partners,p=>sum(p.resources)-playerScore(s,p.id).total*.6+random()*3);
   if(pair&&pair.gain>(difficulty==='expert'?.55:.8)&&partner)return {kind:'offer',playerId:id,to:partner.id,give:bundle(pair.give),want:bundle(pair.want)};
 }
 const exchanges=RESOURCES.flatMap(give=>RESOURCES.filter(want=>want!==give&&s.bank[want]>0&&hand[give]>=tradeRate(board,s,id,give)).map(want=>({give,want,gain:value(simulateHand(hand,bundle(give,tradeRate(board,s,id,give)),bundle(want)))-base})));
 const exchange=best(exchanges,x=>x.gain);
 if(exchange&&exchange.gain>.15)return {kind:'bankTrade',playerId:id,give:exchange.give,want:exchange.want};
 if(canBuy(s)&&(score>=6||!path||path.value<=0||sum(hand)>=7||!roads.length))return {kind:'buyCard',playerId:id};
 if(roadAward&&potential>(s.awards.roadLengths[id]??0)&&s.awards.longestRoad!==id&&sum(hand)>=5)return {kind:'build',playerId:id,build:'road',id:roadAward};
 if(canBuy(s))return {kind:'buyCard',playerId:id};
 return {kind:'end',playerId:id};
}
