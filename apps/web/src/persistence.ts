import {generateBoard,RESOURCES,type Board,type BoardSize,type PlayerCount,type Difficulty,type GameState,type SetupState} from '@orvane/engine';
import type {Pace} from './matchUX';
export const SAVE_KEY='orvane.library.v1',PREF_KEY='orvane.preferences.v1';
export interface Preferences {count:PlayerCount;humans:number;difficulty:Difficulty;pace:Pace;follow:boolean}
export const DEFAULT_PREFS:Preferences={count:6,humans:1,difficulty:'hard',pace:'relaxed',follow:true};
export interface SavedMatch {schema:1;id:string;createdAt:number;updatedAt:number;seed:string;size:BoardSize;preferences:Preferences;setup:SetupState;game:GameState|null;activity:string[];attempts:{turn:number;count:number}}
export interface Result {id:string;endedAt:number;players:number;humans:number;winner:number;winnerName:string;rounds:number}
export interface Library {schema:1;matches:SavedMatch[];results:Result[]}
export type Store=Pick<Storage,'getItem'|'setItem'>;
const obj=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
const one=(v:unknown,choices:readonly unknown[])=>choices.includes(v);
const res=(v:unknown)=>obj(v)&&RESOURCES.every(k=>int(v[k],0,24));
const boardCache=new Map<string,Board>();
function savedBoard(seed:string,size:BoardSize):Board{const key=size+':'+seed;const old=boardCache.get(key);if(old)return old;const board=generateBoard(seed,size);if(boardCache.size>=32)boardCache.delete(boardCache.keys().next().value!);boardCache.set(key,board);return board;}
const empty=():Library=>({schema:1,matches:[],results:[]});
export function isPreferences(v:unknown):v is Preferences{
 return obj(v)&&one(v.count,[3,4,5,6])&&int(v.humans,1,v.count)&&one(v.difficulty,['easy','normal','hard','expert'])&&one(v.pace,['relaxed','normal','turbo'])&&typeof v.follow==='boolean';
}
export function readPreferences(store:Store):Preferences{
 try{const raw=JSON.parse(store.getItem(PREF_KEY)??'null');return isPreferences(raw)?raw:DEFAULT_PREFS;}catch{return DEFAULT_PREFS;}
}
export function validateSave(v:unknown):v is SavedMatch{
 if(!obj(v)||v.schema!==1||typeof v.id!=='string'||!v.id||!int(v.createdAt)||!int(v.updatedAt,v.createdAt)||typeof v.seed!=='string'||!v.seed||v.seed.length>80||!isPreferences(v.preferences)||v.size!==(v.preferences.count<=4?'standard':'extended')||!Array.isArray(v.activity)||!v.activity.every((x:unknown)=>typeof x==='string')||!obj(v.attempts)||!int(v.attempts.turn)||!int(v.attempts.count))return false;
 const count=v.preferences.count,board=savedBoard(v.seed,v.size),ids=Array.from({length:count},(_,i)=>i),seat=(x:unknown)=>one(x,ids);
 const players=(p:unknown)=>Array.isArray(p)&&p.length===count&&p.every((x,i)=>obj(x)&&x.id===i&&typeof x.name==='string'&&typeof x.color==='string'&&res(x.resources));
 const pieces=(s:Record<string,any>,game:boolean)=>Array.isArray(s.settlements)&&Array.isArray(s.roads)&&s.settlements.every((b:unknown)=>obj(b)&&seat(b.playerId)&&board.vertices.some(x=>x.id===b.vertexId)&&(!game||one(b.kind,['settlement','city'])))&&s.roads.every((b:unknown)=>obj(b)&&seat(b.playerId)&&board.edges.some(x=>x.id===b.edgeId))&&new Set(s.settlements.map((b:any)=>b.vertexId)).size===s.settlements.length&&new Set(s.roads.map((b:any)=>b.edgeId)).size===s.roads.length;
 const s=v.setup;
 if(!obj(s)||!players(s.players)||!pieces(s,false)||!Array.isArray(s.order)||s.order.length!==2*count||!s.order.every(seat)||!ids.every(id=>s.order.filter((x:unknown)=>x===id).length===2)||!int(s.step,0,2*count)||!one(s.phase,['settlement','road','complete'])||(s.phase==='complete')!==(s.step===2*count)||s.roads.length!==s.step||s.settlements.length!==s.step+(s.phase==='road'?1:0)||!(s.phase==='road'?board.vertices.some(x=>x.id===s.pendingVertex):s.pendingVertex===null))return false;
 if(v.game===null)return true;
 const g=v.game;if(s.phase!=='complete'||!obj(g)||!players(g.players)||!pieces(g,true)||!res(g.bank)||!seat(g.active)||!seat(g.primary)||typeof g.paired!=='boolean'||!int(g.turn,1)||!int(g.round,1)||!one(g.phase,['roll','action','discard','robber','freeRoad','finished'])||!(g.dice===null||Array.isArray(g.dice)&&g.dice.length===2&&g.dice.every((n:unknown)=>int(n,1,6)))||!Array.isArray(g.lastProduction)||g.lastProduction.length!==count||!g.lastProduction.every(res)||!Array.isArray(g.shortages)||!g.shortages.every((k:unknown)=>one(k,RESOURCES))||!(g.winner===null||seat(g.winner))||(g.phase==='finished')!==(g.winner!==null))return false;
 const capacity=v.size==='standard'?19:24;
 if(!RESOURCES.every(k=>g.bank[k]+g.players.reduce((n:number,p:any)=>n+p.resources[k],0)===capacity))return false;
 if(g.offer!==null&&(!obj(g.offer)||!seat(g.offer.from)||!seat(g.offer.to)||g.offer.from===g.offer.to||!res(g.offer.give)||!res(g.offer.want)||g.phase!=='action'))return false;
 const d=g.development,a=g.awards,kinds=['knight','roads','plenty','monopoly','victory'];
 if(!obj(d)||!Array.isArray(d.deck)||!d.deck.every((k:unknown)=>one(k,kinds))||!obj(d.hands)||!obj(d.knights)||!obj(d.discards)||typeof d.played!=='boolean'||!board.tiles.some(t=>t.id===d.robber)||!one(d.resume,['roll','action'])||!int(d.freeRoads,0,2))return false;
 if(!ids.every(id=>Array.isArray(d.hands[id])&&d.hands[id].every((card:unknown)=>obj(card)&&int(card.id)&&one(card.kind,kinds)&&int(card.boughtTurn,0,g.turn))&&int(d.knights[id],0,20))||!Object.entries(d.discards).every(([id,n])=>seat(Number(id))&&int(n,1,60)))return false;
 return obj(a)&&(a.longestRoad===null||seat(a.longestRoad))&&(a.largestArmy===null||seat(a.largestArmy))&&obj(a.roadLengths)&&ids.every(id=>int(a.roadLengths[id],0,15));
}
export function readLibrary(store:Store):Library{
 const raw=store.getItem(SAVE_KEY);if(raw===null)return empty();
 const x:unknown=JSON.parse(raw);
 if(!obj(x)||x.schema!==1||!Array.isArray(x.matches)||!x.matches.every(validateSave)||!Array.isArray(x.results)||!x.results.every((r:unknown)=>obj(r)&&typeof r.id==='string'&&int(r.endedAt)&&int(r.players,3,6)&&int(r.humans,1,r.players)&&int(r.winner,0,r.players-1)&&typeof r.winnerName==='string'&&int(r.rounds,1)))throw new Error('Saved data is incompatible or damaged. It has not been overwritten.');
 return x as Library;
}
export function saveMatch(store:Store,match:SavedMatch):Library{
 if(!validateSave(match))throw new Error('Cannot save an invalid match.');
 const library=readLibrary(store),matches=[match,...library.matches.filter(s=>s.id!==match.id)].sort((a,b)=>b.updatedAt-a.updatedAt);
 const results=[...library.results];
 if(match.game?.winner!==null&&match.game?.winner!==undefined&&!results.some(r=>r.id===match.id)){
   const g=match.game,winner=g.winner!;results.unshift({id:match.id,endedAt:match.updatedAt,players:g.players.length,humans:match.preferences.humans,winner,winnerName:g.players.find(p=>p.id===winner)!.name,rounds:g.round});
 }
 const next:Library={schema:1,matches,results};store.setItem(SAVE_KEY,JSON.stringify(next));return next;
}
export function removeMatch(store:Store,id:string):Library{
 const library=readLibrary(store),next={...library,matches:library.matches.filter(s=>s.id!==id)};store.setItem(SAVE_KEY,JSON.stringify(next));return next;
}
export function latestUnfinished(library:Library){return library.matches.find(m=>m.game?.phase!=='finished');}
export function soloStats(library:Library){const solo=library.results.filter(r=>r.humans===1);return {played:solo.length,wins:solo.filter(r=>r.winner===0).length,losses:solo.filter(r=>r.winner!==0).length};}
