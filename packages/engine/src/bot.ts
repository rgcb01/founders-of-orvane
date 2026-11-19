import type {Board} from './index';
import {emptyResources,activePlayer,legalSettlements,legalRoads,type SetupState,type SetupAction,type Resource,type Resources} from './setup';
import {RESOURCES,COSTS,legalBuilds,rollDice,type GameState,type GameAction,type BuildKind} from './economy';
import {canBuy,canPlay,freeRoadSites,robberVictims,CARD_COST} from './development';
import {tradeRate} from './trade';
import {playerScore,longestRoad,awardHolder} from './victory';

export type Difficulty='easy'|'normal'|'hard'|'expert';
export interface BotOptions {difficulty:Difficulty;random?:()=>number;offers?:number}
export const BOT_POLICY={
 easy:{setupNoise:12,buildNoise:10,offerBudget:0,acceptGain:-.25,bankGain:.6,plan:false,lookahead:false},
 normal:{setupNoise:4,buildNoise:2,offerBudget:1,acceptGain:.25,bankGain:.2,plan:false,lookahead:false},
 hard:{setupNoise:.8,buildNoise:.5,offerBudget:2,acceptGain:.15,bankGain:.12,plan:true,lookahead:false},
 expert:{setupNoise:0,buildNoise:0,offerBudget:2,acceptGain:.05,bankGain:.05,plan:true,lookahead:true}
} as const;
const rich={forest:24,pasture:24,field:24,hill:24,mountain:24};
const sum=(r:Resources)=>RESOURCES.reduce((n,k)=>n+r[k],0);
const pips=(n:number|null)=>n===null?0:6-Math.abs(7-n);
const bundle=(k:Resource,n=1)=>({...emptyResources(),[k]:n});
const deficit=(hand:Resources,cost:Resources)=>RESOURCES.reduce((n,k)=>n+Math.max(0,cost[k]-hand[k]),0);
function best<T>(items:T[],score:(x:T)=>number):T|undefined{
 let winner:T|undefined,high=-Infinity;for(const x of items){const value=score(x);if(value>high){high=value;winner=x;}}return winner;
}
const siteCache=new WeakMap<Board,Map<string,{terrain:Resource;number:number|null}[]>>();
function siteTiles(board:Board,id:string){
 let map=siteCache.get(board);if(!map){map=new Map(board.vertices.map(v=>[v.id,board.tiles.filter(t=>v.tiles.includes(t.id)&&t.terrain!=='desert').map(t=>({terrain:t.terrain as Resource,number:t.number}))]));siteCache.set(board,map);}
 return map.get(id)??[];
}
function income(board:Board,s:Pick<GameState,'settlements'>,id:number):Resources{
 const out=emptyResources();for(const b of s.settlements)if(b.playerId===id)for(const t of siteTiles(board,b.vertexId))out[t.terrain]+=pips(t.number)*(b.kind==='city'?2:1);return out;
}
function strategicSite(board:Board,id:string,owned:string[],city=false){
 const prior=emptyResources();for(const v of owned)for(const t of siteTiles(board,v))prior[t.terrain]+=pips(t.number);
 const ts=siteTiles(board,id);
 return quality(board,id,city?[]:owned)+ts.reduce((n,t)=>n+pips(t.number)*(city?.25:prior[t.terrain]===0?.8:1/(1+prior[t.terrain])*.8),0);
}
function quality(board:Board,id:string,owned:string[]=[]):number{
 const tiles=siteTiles(board,id);
 const prior=new Set(owned.flatMap(v=>siteTiles(board,v).map(t=>t.terrain)));
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
 const policy=BOT_POLICY[options.difficulty];
 const scoreSite=(x:string)=>{
   if(!policy.lookahead)return quality(board,x,own);
   const occupied=new Set([...s.settlements.map(b=>b.vertexId),x]),targets=vacant(board,occupied);
   const neighbors=board.edges.filter(e=>e.a===x||e.b===x).map(e=>e.a===x?e.b:e.a);
   const reach=targets.filter(v=>board.edges.some(e=>neighbors.some(n=>e.a===n&&e.b===v||e.b===n&&e.a===v)));
   return strategicSite(board,x,own)+Math.max(0,...reach.map(v=>quality(board,v,[...own,x])))*.16;
 };
 const id=options.difficulty==='easy'?sites[Math.floor(random()*sites.length)]:s.phase==='settlement'?best(sites,x=>scoreSite(x)+random()*policy.setupNoise)!:expansion(board,playerId,s.settlements,s.roads,sites)?.id??sites[0];
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
function goals(board:Board,s:GameState,id:number,difficulty:Difficulty):Goal[]{
 // Hypothetical funds expose legal geometry without relying on future rolls.
 const probe={...s,active:id,offer:null,phase:'action' as const,players:s.players.map(p=>p.id===id?{...p,resources:rich}:p)};
 const list:Goal[]=[];const policy=BOT_POLICY[difficulty],score=playerScore(s,id,true).total,prod=income(board,s,id);
 const settled=legalBuilds(board,probe,'settlement'),cities=legalBuilds(board,probe,'city'),roads=legalBuilds(board,probe,'road');
 const path=expansion(board,id,s.settlements,s.roads,roads);
 if(settled.length)list.push({cost:COSTS.settlement,weight:policy.plan?14+Math.min(3,settled.length):12});
 if(cities.length)list.push({cost:COSTS.city,weight:policy.plan?13+(score>=8?5:0)+(prod.field+prod.mountain>10?2:0):11});
 if(path&&path.value>0&&!settled.length)list.push({cost:COSTS.road,weight:8});
 if(s.development.deck.length)list.push({cost:CARD_COST,weight:policy.plan?(score>=7?11:5):7});
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
 const policy=BOT_POLICY[difficulty],hand=s.players.find(p=>p.id===id)!.resources;
 let gs:Goal[]|undefined;const value=(h:Resources)=>handValue(h,gs??=goals(board,s,id,difficulty));
 const gainFor=(h:Resources)=>value(h)-value(hand);
 if(s.offer){
   const o=s.offer,affordable=RESOURCES.every(k=>hand[k]>=o.want[k]);
   const gain=affordable?gainFor(simulateHand(hand,o.want,o.give)):-Infinity;
   const leader=playerScore(s,o.from).total>=8;
   if(affordable&&gain>(leader&&policy.plan?2.5:policy.acceptGain))return {kind:'accept',playerId:id};
   if((options.offers??0)<policy.offerBudget&&sum(o.want)>1){
     const k=best(RESOURCES.filter(k=>o.want[k]>0&&hand[k]>0),k=>value(simulateHand(hand,bundle(k),o.give)));
     if(k&&gainFor(simulateHand(hand,bundle(k),o.give))>.5)return {kind:'counter',playerId:id,give:bundle(k),want:o.give};
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
   const t=best(board.tiles.filter(t=>t.id!==s.development.robber),t=>s.settlements.filter(b=>t.vertices.includes(b.vertexId)).reduce((n,b)=>n+(b.playerId===id?-3:1+playerScore(s,b.playerId).total*(policy.plan?.45:.15))*pips(t.number)*(b.kind==='city'?2:1),0)+robberVictims(board,s,t.id).length*.4+random()*(difficulty==='easy'?9:policy.lookahead?0:.2))!;
   const victim=best(robberVictims(board,s,t.id),p=>playerScore(s,p).total+sum(s.players.find(x=>x.id===p)!.resources)*.08)??null;
   return {kind:'moveRobber',playerId:id,tileId:t.id,victim,random:random()};
 }
 if(s.phase==='freeRoad'){
   const sites=freeRoadSites(board,s);
   const edgeId=expansion(board,id,s.settlements,s.roads,sites)?.id??sites[0];
   return {kind:'freeRoad',playerId:id,edgeId};
 }
 const playable=s.development.hands[id].filter(c=>canPlay(s,c));
 if(s.phase==='roll'&&!playable.length)return {kind:'roll',playerId:id,dice:rollDice(random)};
 for(const card of playable){
   if(policy.lookahead&&s.phase==='roll'&&card.kind!=='knight')continue;
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
     if(cap-s.bank[k]-hand[k]>=(policy.lookahead&&playerScore(s,id,true).total<8?4:3))return {kind:'playCard',playerId:id,cardId:card.id,resource:k};
   }
 }
 if(s.phase==='roll')return {kind:'roll',playerId:id,dice:rollDice(random)};
 const own=s.settlements.filter(b=>b.playerId===id).map(b=>b.vertexId);
 const sites=legalBuilds(board,s,'settlement'),cities=legalBuilds(board,s,'city'),roads=legalBuilds(board,s,'road');
 const score=playerScore(s,id,true).total;
 const site=best(sites,x=>(policy.plan?strategicSite(board,x,own):quality(board,x,own))+random()*policy.buildNoise);
 const city=best(cities,x=>quality(board,x));
 if(site&&city&&policy.plan){
   const sIncome=siteTiles(board,site).reduce((n,t)=>n+pips(t.number),0),cIncome=siteTiles(board,city).reduce((n,t)=>n+pips(t.number),0);
   if(cIncome>=sIncome+(score>=8?0:2))return {kind:'build',playerId:id,build:'city',id:city};
 }
 if(site)return {kind:'build',playerId:id,build:'settlement',id:site};
 if(city)return {kind:'build',playerId:id,build:'city',id:city};
 const path=expansion(board,id,s.settlements,s.roads,roads);
 const roadScores=new Map(roads.map(e=>[e,longestRoad(board,{settlements:s.settlements,roads:[...s.roads,{edgeId:e,playerId:id}]},id)]));
 const roadAward=best(roads,e=>roadScores.get(e)!);
 const potential=roadAward?roadScores.get(roadAward)!:0;
 const winsAward=roadAward&&awardHolder({...s.awards.roadLengths,[id]:potential},5,s.awards.longestRoad)===id;
 if(roadAward&&s.awards.longestRoad!==id&&winsAward)return {kind:'build',playerId:id,build:'road',id:roadAward};
 if(path&&path.value>0&&s.settlements.filter(b=>b.playerId===id&&b.kind==='settlement').length<5)return {kind:'build',playerId:id,build:'road',id:path.id};
 // Negotiate only when a mutually useful one-card exchange can improve our plan;
 // choose a partner by public hand size and public score, not hidden card types.
 if(!s.paired&&(options.offers??0)<2&&difficulty!=='easy'){
   const pairs=RESOURCES.flatMap(give=>RESOURCES.filter(want=>want!==give&&hand[give]>0).map(want=>({give,want,gain:gainFor(simulateHand(hand,bundle(give),bundle(want)))})));
   const pair=best(pairs,p=>p.gain);
   const partners=s.players.filter(p=>p.id!==id&&sum(p.resources)>0&&playerScore(s,p.id).total<9);
   const partner=best(partners,p=>sum(p.resources)-playerScore(s,p.id).total*.6+random()*3);
   if(pair&&pair.gain>(policy.lookahead?.45:difficulty==='hard'?.75:1.2)&&partner)return {kind:'offer',playerId:id,to:partner.id,give:bundle(pair.give),want:bundle(pair.want)};
 }
 const exchanges=RESOURCES.flatMap(give=>RESOURCES.filter(want=>want!==give&&s.bank[want]>0&&hand[give]>=tradeRate(board,s,id,give)).map(want=>({give,want,gain:gainFor(simulateHand(hand,bundle(give,tradeRate(board,s,id,give)),bundle(want)))})));
 const exchange=best(exchanges,x=>x.gain);
 if(exchange&&exchange.gain>policy.bankGain)return {kind:'bankTrade',playerId:id,give:exchange.give,want:exchange.want};
 if(canBuy(s)&&(score>=6||!path||path.value<=0||sum(hand)>=7||!roads.length))return {kind:'buyCard',playerId:id};
 if(roadAward&&potential>(s.awards.roadLengths[id]??0)&&s.awards.longestRoad!==id&&sum(hand)>=5)return {kind:'build',playerId:id,build:'road',id:roadAward};
 if(canBuy(s)){
   const buildGoals=(gs??=goals(board,s,id,difficulty)).filter(g=>g.weight>=11&&g.cost!==CARD_COST);
   const after=simulateHand(hand,CARD_COST,emptyResources());
   if(!policy.plan||score>=7||sum(hand)>7||!buildGoals.some(g=>deficit(hand,g.cost)<=1&&deficit(after,g.cost)>deficit(hand,g.cost)))return {kind:'buyCard',playerId:id};
 }
 return {kind:'end',playerId:id};
}
