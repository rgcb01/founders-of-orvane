import type {Board,Edge,Vertex} from './index';
import type {GameState} from './economy';
import {emptyResources,type Resource,type Resources} from './setup';

export interface Harbor {edgeId:string;resource:Resource|null;rate:2|3}
export const TRADE_RESOURCES:Resource[]=['forest','pasture','field','hill','mountain'];
export interface Offer {from:number;to:number;give:Resources;want:Resources}
export type TradeAction=
 | {kind:'bankTrade';playerId:number;give:Resource;want:Resource}
 | {kind:'offer';playerId:number;to:number;give:Resources;want:Resources}
 | {kind:'counter';playerId:number;give:Resources;want:Resources}
 | {kind:'accept';playerId:number}
 | {kind:'reject';playerId:number}
 | {kind:'cancel';playerId:number};
export function generateHarbors(edges:Edge[],vertices:Vertex[],extended:boolean,random:()=>number):Harbor[]{
 const coast=edges.filter(e=>e.tiles.length===1);
 const vertexMap=new Map(vertices.map(v=>[v.id,v]));
 const around=new Map<string,Edge[]>();
 for(const e of coast)for(const v of [e.a,e.b])around.set(v,[...(around.get(v)??[]),e]);
 // Traverse the actual boundary rather than sorting by distance or angle.
 const start=coast[0],ordered=[start];let at=start.b;
 while(ordered.length<coast.length){
   const next=around.get(at)?.find(e=>e.id!==ordered[ordered.length-1].id);
   if(!next||next.id===start.id)throw new Error('Invalid island coastline');
   ordered.push(next);at=next.a===at?next.b:next.a;
 }
 if(!vertexMap.has(start.a))throw new Error('Missing coastline vertex');
 const types:(Resource|null)[]=[...TRADE_RESOURCES,null,null,null,null];
 if(extended)types.push('pasture',null);
 for(let i=types.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
 const offset=Math.floor(random()*ordered.length);
 return types.map((resource,i)=>({edgeId:ordered[(offset+Math.floor(i*ordered.length/types.length))%ordered.length].id,resource,rate:resource===null?3:2}));
}
export function tradeRate(board:Board,state:GameState,playerId:number,resource:Resource):2|3|4{
 const owned=new Set(state.settlements.filter(s=>s.playerId===playerId).map(s=>s.vertexId));
 let rate:2|3|4=4;
 for(const harbor of board.harbors){
   const e=board.edges.find(e=>e.id===harbor.edgeId)!;
   if(!owned.has(e.a)&&!owned.has(e.b))continue;
   if(harbor.resource===resource)return 2;
   if(harbor.resource===null)rate=3;
 }
 return rate;
}
function validBundle(b:Resources):boolean{
 return !!b&&Object.keys(b).length===5&&TRADE_RESOURCES.every(k=>Number.isSafeInteger(b[k])&&b[k]>=0&&b[k]<=24)&&TRADE_RESOURCES.some(k=>b[k]>0);
}
function has(hand:Resources,b:Resources){return TRADE_RESOURCES.every(k=>hand[k]>=b[k]);}
function offerValid(state:GameState,offer:Offer):boolean{
 const from=state.players.find(p=>p.id===offer.from),to=state.players.find(p=>p.id===offer.to);
 return !!from&&!!to&&from.id!==to.id&&(from.id===state.active||to.id===state.active)&&validBundle(offer.give)&&validBundle(offer.want)&&TRADE_RESOURCES.every(k=>!(offer.give[k]&&offer.want[k]))&&has(from.resources,offer.give);
}
export function applyTrade(board:Board,state:GameState,a:TradeAction):GameState{
 if(state.phase!=='action')throw new Error('Trade requires action phase');
 const actor=state.players.find(p=>p.id===a.playerId);
 if(!actor)throw new Error('Unknown trader');
 const pending=state.offer;
 if(state.paired&&a.kind!=='bankTrade')throw new Error('Paired player may only trade with the supply');
 if(a.kind==='bankTrade'){
   if(a.playerId!==state.active||pending||a.give===a.want||!TRADE_RESOURCES.includes(a.give)||!TRADE_RESOURCES.includes(a.want))throw new Error('Invalid bank trade');
   const rate=tradeRate(board,state,a.playerId,a.give);
   if(actor.resources[a.give]<rate||state.bank[a.want]<1)throw new Error('Insufficient resources');
   const bank={...state.bank,[a.give]:state.bank[a.give]+rate,[a.want]:state.bank[a.want]-1};
   return {...state,bank,players:state.players.map(p=>p.id===actor.id?{...p,resources:{...p.resources,[a.give]:p.resources[a.give]-rate,[a.want]:p.resources[a.want]+1}}:p)};
 }
 if(a.kind==='offer'||a.kind==='counter'){
   if(a.kind==='offer'&&(pending||a.playerId!==state.active))throw new Error('Cannot open offer');
   if(a.kind==='counter'&&(!pending||pending.to!==a.playerId))throw new Error('Cannot counter');
   const offer={from:a.playerId,to:a.kind==='offer'?a.to:pending!.from,give:{...a.give},want:{...a.want}};
   if(!offerValid(state,offer))throw new Error('Invalid offer');
   return {...state,offer};
 }
 if(!pending)throw new Error('No pending offer');
 if(a.kind==='cancel'){
   if(pending.from!==actor.id&&state.active!==actor.id)throw new Error('Cannot cancel');
   return {...state,offer:null};
 }
 if(pending.to!==actor.id)throw new Error('Only recipient can respond');
 if(a.kind==='reject')return {...state,offer:null};
 if(!offerValid(state,pending)||!has(actor.resources,pending.want))throw new Error('Offer cannot be fulfilled');
 const players=state.players.map(p=>{
   if(p.id!==pending.from&&p.id!==pending.to)return p;
   const resources=emptyResources();
   const sign=p.id===pending.from?1:-1;
   for(const k of TRADE_RESOURCES)resources[k]=p.resources[k]+sign*(pending.want[k]-pending.give[k]);
   return {...p,resources};
 });
 return {...state,players,offer:null};
}
