import type {Board} from './index';
import {legalBuilds,RESOURCES,type GameState} from './economy';
import {emptyResources,type Resource,type Resources} from './setup';

export type CardKind='knight'|'roads'|'plenty'|'monopoly'|'victory';
export interface Card {id:number;kind:CardKind;boughtTurn:number}
export interface Development {
 deck:CardKind[];hands:Record<number,Card[]>;knights:Record<number,number>;
 played:boolean;robber:string;discards:Record<number,number>;resume:'roll'|'action';freeRoads:number;
}
export const CARD_COST:Resources={forest:0,pasture:1,field:1,hill:0,mountain:1};
export type DevelopmentAction=
 | {kind:'discard';playerId:number;resources:Resources}
 | {kind:'moveRobber';playerId:number;tileId:string;victim:number|null;random:number}
 | {kind:'buyCard';playerId:number}
 | {kind:'playCard';playerId:number;cardId:number;resource?:Resource;resources?:Resource[]}
 | {kind:'freeRoad';playerId:number;edgeId:string};
const sum=(r:Resources)=>RESOURCES.reduce((n,k)=>n+r[k],0);
export function createDevelopment(board:Board,ids:number[],random:()=>number):Development{
 const extra=board.size==='extended'?1:0;
 const deck:CardKind[]=[...Array<CardKind>(14+6*extra).fill('knight'),...Array<CardKind>(2+extra).fill('roads'),...Array<CardKind>(2+extra).fill('plenty'),...Array<CardKind>(2+extra).fill('monopoly'),...Array<CardKind>(5).fill('victory')];
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 return {deck,hands:Object.fromEntries(ids.map(id=>[id,[]])),knights:Object.fromEntries(ids.map(id=>[id,0])),played:false,robber:board.tiles.find(t=>t.terrain==='desert')!.id,discards:{},resume:'action',freeRoads:0};
}
export function beginSeven(state:GameState):GameState{
 const discards=Object.fromEntries(state.players.filter(p=>sum(p.resources)>7).map(p=>[p.id,Math.floor(sum(p.resources)/2)]));
 return {...state,phase:Object.keys(discards).length?'discard':'robber',development:{...state.development,discards,resume:'action'}};
}
export function robberVictims(board:Board,s:GameState,tileId:string):number[]{
 const tile=board.tiles.find(t=>t.id===tileId);
 if(!tile||tileId===s.development.robber)return [];
 return s.players.filter(p=>p.id!==s.active&&sum(p.resources)>0&&s.settlements.some(b=>b.playerId===p.id&&tile.vertices.includes(b.vertexId))).map(p=>p.id);
}
export function freeRoadSites(board:Board,s:GameState):string[]{
 if(s.phase!=='freeRoad')return [];
 const players=s.players.map(p=>p.id===s.active?{...p,resources:{...p.resources,forest:Math.max(1,p.resources.forest),hill:Math.max(1,p.resources.hill)}}:p);
 return legalBuilds(board,{...s,players,phase:'action'},'road');
}
export function canBuy(s:GameState):boolean{
 const p=s.players.find(p=>p.id===s.active)!;
 return s.phase==='action'&&!s.offer&&s.development.deck.length>0&&RESOURCES.every(k=>p.resources[k]>=CARD_COST[k]);
}
export function canPlay(s:GameState,card:Card):boolean{
 return (s.phase==='action'||s.phase==='roll')&&!s.offer&&!s.development.played&&card.kind!=='victory'&&card.boughtTurn<s.turn;
}
export function applyDevelopment(board:Board,s:GameState,a:DevelopmentAction):GameState{
 const d=s.development,actor=s.players.find(p=>p.id===a.playerId);
 if(!actor||s.offer)throw new Error('Invalid development action');
 if(a.kind==='discard'){
  const required=d.discards[a.playerId];
  if(s.phase!=='discard'||!required||!RESOURCES.every(k=>Number.isInteger(a.resources[k])&&a.resources[k]>=0&&a.resources[k]<=actor.resources[k])||sum(a.resources)!==required)throw new Error('Invalid discard');
  const bank={...s.bank},resources={...actor.resources};
  for(const k of RESOURCES){bank[k]+=a.resources[k];resources[k]-=a.resources[k];}
  const discards={...d.discards};delete discards[a.playerId];
  return {...s,bank,players:s.players.map(p=>p.id===actor.id?{...p,resources}:p),phase:Object.keys(discards).length?'discard':'robber',development:{...d,discards}};
 }
 if(a.playerId!==s.active)throw new Error('Not active player');
 if(a.kind==='moveRobber'){
  if(s.phase!=='robber'||a.tileId===d.robber||!board.tiles.some(t=>t.id===a.tileId)||!Number.isFinite(a.random)||a.random<0||a.random>=1)throw new Error('Invalid robber destination');
  const victims=robberVictims(board,s,a.tileId);
  if(victims.length?(a.victim===null||!victims.includes(a.victim)):a.victim!==null)throw new Error('Invalid victim');
  let players=s.players;
  if(a.victim!==null){
   const victim=players.find(p=>p.id===a.victim)!;
   const bag=RESOURCES.flatMap(k=>Array<Resource>(victim.resources[k]).fill(k));
   const k=bag[Math.floor(a.random*bag.length)];
   players=players.map(p=>p.id===victim.id?{...p,resources:{...p.resources,[k]:p.resources[k]-1}}:p.id===actor.id?{...p,resources:{...p.resources,[k]:p.resources[k]+1}}:p);
  }
  return {...s,players,phase:d.resume,development:{...d,robber:a.tileId}};
 }
 if(a.kind==='freeRoad'){
  if(!freeRoadSites(board,s).includes(a.edgeId))throw new Error('Illegal free road');
  const next:GameState={...s,roads:[...s.roads,{edgeId:a.edgeId,playerId:actor.id}],development:{...d,freeRoads:d.freeRoads-1}};
  if(next.development.freeRoads===0||!freeRoadSites(board,next).length)return {...next,phase:d.resume,development:{...next.development,freeRoads:0}};
  return next;
 }
 if(a.kind==='buyCard'){
  if(!canBuy(s))throw new Error('Cannot buy development card');
  const bank={...s.bank},resources={...actor.resources};
  for(const k of RESOURCES){bank[k]+=CARD_COST[k];resources[k]-=CARD_COST[k];}
  const card:Card={id:d.deck.length,kind:d.deck[0],boughtTurn:s.turn};
  return {...s,bank,players:s.players.map(p=>p.id===actor.id?{...p,resources}:p),development:{...d,deck:d.deck.slice(1),hands:{...d.hands,[actor.id]:[...d.hands[actor.id],card]}}};
 }
 const card=d.hands[actor.id].find(c=>c.id===a.cardId);
 if(!card||!canPlay(s,card))throw new Error('Cannot play development card');
 const next:GameState={...s,development:{...d,played:true,hands:{...d.hands,[actor.id]:d.hands[actor.id].filter(c=>c.id!==card.id)},resume:s.phase as 'roll'|'action'}};
 if(card.kind==='knight')return {...next,phase:'robber',development:{...next.development,knights:{...d.knights,[actor.id]:d.knights[actor.id]+1}}};
 if(card.kind==='roads'){
  const building:GameState={...next,phase:'freeRoad',development:{...next.development,freeRoads:2}};
  if(!freeRoadSites(board,building).length)throw new Error('No legal road sites');
  return building;
 }
 if(card.kind==='plenty'){
  const chosen=a.resources??[],available=sum(s.bank);
  if(chosen.length!==Math.min(2,available)||!chosen.length||chosen.some(k=>!RESOURCES.includes(k)))throw new Error('Choose available resources');
  const bank={...s.bank},resources={...actor.resources};
  for(const k of chosen){if(bank[k]<1)throw new Error('Bank shortage');bank[k]--;resources[k]++;}
  return {...next,bank,players:s.players.map(p=>p.id===actor.id?{...p,resources}:p)};
 }
 const k=a.resource;
 if(!k||!RESOURCES.includes(k))throw new Error('Choose a resource');
 const amount=s.players.filter(p=>p.id!==actor.id).reduce((n,p)=>n+p.resources[k],0);
 return {...next,players:s.players.map(p=>({...p,resources:{...p.resources,[k]:p.id===actor.id?p.resources[k]+amount:0}}))};
}
