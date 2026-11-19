import {RESOURCES,type Board,type GameState,type SetupState,type Resource} from '@orvane/engine';
import type {Pace} from './matchUX';
export type Flight={tileId:string;vertexId:string;playerId:number;resource:Resource;count:number};
export type VisualEvent=
 | {kind:'dice';playerId:number;dice:[number,number]}
 | {kind:'production';playerId:number;tiles:string[];flights:Flight[]}
 | {kind:'road'|'settlement'|'city';playerId:number;id:string}
 | {kind:'robber';playerId:number;from:string;to:string}
 | {kind:'trade'|'offer';playerId:number;other:number|null;give:string;want:string}
 | {kind:'card'|'award'|'victory'|'turn'|'discard';playerId:number;symbol:string};
export function visualDuration(event:VisualEvent,pace:Pace,reduced=false):number{
 if(pace==='turbo')return 0;
 if(reduced)return pace==='relaxed'?450:200;
 const duration=event.kind==='production'?1400:event.kind==='dice'?950:event.kind==='robber'?1050:event.kind==='victory'?2200:event.kind==='turn'?650:900;
 return pace==='relaxed'?duration:Math.round(duration*.55);
}
export function setupVisual(before:SetupState|null,after:SetupState|null):VisualEvent[]{
 if(!before||!after)return [];
 const roads=after.roads.filter(r=>!before.roads.some(x=>x.edgeId===r.edgeId)).map(r=>({kind:'road' as const,playerId:r.playerId,id:r.edgeId}));
 const homes=after.settlements.filter(b=>!before.settlements.some(x=>x.vertexId===b.vertexId)).map(b=>({kind:'settlement' as const,playerId:b.playerId,id:b.vertexId}));
 return [...homes,...roads];
}
const emoji:Record<Resource,string>={forest:'🪵',pasture:'🐑',field:'🌾',hill:'🧱',mountain:'⛰️'};
const bundle=(r:Record<Resource,number>)=>RESOURCES.filter(k=>r[k]>0).map(k=>emoji[k]+'×'+r[k]).join(' ');
export function gameVisual(board:Board,before:GameState|null,after:GameState|null):VisualEvent[]{
 if(!before||!after||before===after)return [];
 const events:VisualEvent[]=[];
 const id=before.active;
 if(before.phase==='roll'&&after.dice&&after.dice!==before.dice){
   events.push({kind:'dice',playerId:id,dice:after.dice});
   const total=after.dice[0]+after.dice[1];
   const tiles=board.tiles.filter(t=>t.number===total&&t.id!==after.development.robber&&t.terrain!=='desert');
   const remaining=after.lastProduction.map(p=>({...p}));
   const flights:Flight[]=[];
   for(const t of tiles){
     if(t.terrain==='desert')continue;const resource=t.terrain;
     for(const b of after.settlements.filter(b=>t.vertices.includes(b.vertexId))){
       const i=after.players.findIndex(p=>p.id===b.playerId);
       const count=Math.min(remaining[i][resource],b.kind==='city'?2:1);
       if(count>0){remaining[i][resource]-=count;flights.push({tileId:t.id,vertexId:b.vertexId,playerId:b.playerId,resource,count});}
     }
   }
   if(tiles.length)events.push({kind:'production',playerId:id,tiles:tiles.map(t=>t.id),flights});
 }
 for(const r of after.roads)if(!before.roads.some(x=>x.edgeId===r.edgeId))events.push({kind:'road',playerId:r.playerId,id:r.edgeId});
 for(const b of after.settlements){
   const old=before.settlements.find(x=>x.vertexId===b.vertexId);
   if(!old||old.kind!==b.kind)events.push({kind:b.kind,playerId:b.playerId,id:b.vertexId});
 }
 if(before.development.robber!==after.development.robber)events.push({kind:'robber',playerId:id,from:before.development.robber,to:after.development.robber});
 if(after.offer&&after.offer!==before.offer)events.push({kind:'offer',playerId:after.offer.from,other:after.offer.to,give:bundle(after.offer.give),want:bundle(after.offer.want)});
 if(before.offer&&!after.offer&&after.players.some((p,i)=>RESOURCES.some(k=>p.resources[k]!==before.players[i].resources[k])))events.push({kind:'trade',playerId:before.offer.from,other:before.offer.to,give:bundle(before.offer.give),want:bundle(before.offer.want)});
 if(!events.length&&before.phase==='action'&&after.phase==='action'&&before.bank!==after.bank&&after.development.deck.length===before.development.deck.length&&!(!before.development.played&&after.development.played)){
   const old=before.players.find(p=>p.id===id)!,next=after.players.find(p=>p.id===id)!;
   const give=Object.fromEntries(RESOURCES.map(k=>[k,Math.max(0,old.resources[k]-next.resources[k])])) as Record<Resource,number>;
   const want=Object.fromEntries(RESOURCES.map(k=>[k,Math.max(0,next.resources[k]-old.resources[k])])) as Record<Resource,number>;
   if(bundle(give)&&bundle(want))events.push({kind:'trade',playerId:id,other:null,give:bundle(give),want:bundle(want)});
 }
 if(after.development.deck.length<before.development.deck.length||after.development.played&&!before.development.played)events.push({kind:'card',playerId:id,symbol:'🃏'});
 if(before.phase==='discard'&&before.development.discards!==after.development.discards){
   const who=Object.keys(before.development.discards).find(k=>!(Number(k) in after.development.discards));
   if(who!==undefined)events.push({kind:'discard',playerId:Number(who),symbol:'🃏'});
 }
 if(after.awards.longestRoad!==before.awards.longestRoad&&after.awards.longestRoad!==null)events.push({kind:'award',playerId:after.awards.longestRoad,symbol:'🛤️'});
 if(after.awards.largestArmy!==before.awards.largestArmy&&after.awards.largestArmy!==null)events.push({kind:'award',playerId:after.awards.largestArmy,symbol:'⚔️'});
 if(after.winner!==null&&after.winner!==before.winner)events.push({kind:'victory',playerId:after.winner,symbol:'🏆'});
 else if(after.turn!==before.turn)events.push({kind:'turn',playerId:after.active,symbol:'🎲'});
 return events;
}
