import {activePlayer,RESOURCES,type GameState,type SetupState} from '@orvane/engine';
import {resourceEmoji} from './resources';

export type Pace='relaxed'|'normal'|'turbo';
export const PACES:Record<Pace,{label:string;delay:number;rollDelay:number}>={relaxed:{label:'Relaxed',delay:1400,rollDelay:2200},normal:{label:'Normal',delay:700,rollDelay:1200},turbo:{label:'Turbo',delay:0,rollDelay:0}};
export function botDelay(pace:Pace,game:GameState|null,stepping=false):number{
 if(stepping)return 0;
 return game?.dice&&game.phase==='action'?PACES[pace].rollDelay:PACES[pace].delay;
}
export function setupEvent(before:SetupState|null,after:SetupState|null):string|null{
 if(!after)return null;
 if(!before)return '🏝️ The island is ready. Place two settlements and roads.';
 const id=activePlayer(before);if(id===null)return null;
 const name=before.players.find(p=>p.id===id)?.name;
 if(after.settlements.length>before.settlements.length)return '🏠 '+name+' placed a settlement';
 if(after.roads.length>before.roads.length)return '🛤️ '+name+' placed a road';
 return null;
}
export function matchEvent(before:GameState|null,after:GameState|null,humans:number):string|null{
 if(!after)return null;
 if(!before)return '🎲 The match begins. '+after.players.find(p=>p.id===after.active)?.name+' rolls first.';
 const name=before.players.find(p=>p.id===before.active)?.name??'Player';
 const next=after.players.find(p=>p.id===after.active)?.name??'Player';
 if(after.winner!==null&&after.winner!==before.winner)return '🏆 '+after.players.find(p=>p.id===after.winner)?.name+' wins!';
 if(before.phase==='roll'&&after.dice!==null&&after.dice!==before.dice){
   const total=after.dice[0]+after.dice[1];
   if(total===7)return '🎲 '+name+' rolled 7 · 🥷 Robber activated';
   const mine=humans===1?after.lastProduction[0]:null;
   const gain=mine?RESOURCES.filter(k=>mine[k]>0).map(k=>resourceEmoji[k]+' +'+mine[k]).join(' · '):'';
   const produced=after.lastProduction.flatMap((p,i)=>{const n=RESOURCES.reduce((a,k)=>a+p[k],0);return n?[after.players[i].name+' +'+n]:[];}).join(', ');
   return '🎲 '+name+' rolled '+after.dice.join('+')+' = '+total+(mine?' · You: '+(gain||'no resources'):'')+(produced?' · '+produced:' · No production')+(after.shortages.length?' · Bank shortage':'');
 }
 if(before.turn!==after.turn)return '⏭ '+next+(after.paired?' has a paired action':' is next');
 if(after.offer&&after.offer!==before.offer)return '🤝 '+after.players.find(p=>p.id===after.offer!.from)?.name+' made an offer to '+after.players.find(p=>p.id===after.offer!.to)?.name;
 if(after.development.robber!==before.development.robber)return '🥷 '+name+' moved the robber';
 if(before.phase==='discard'&&after.development.discards!==before.development.discards){const id=Object.keys(before.development.discards).find(k=>!(Number(k) in after.development.discards));return '🃏 '+before.players.find(p=>p.id===Number(id))?.name+' discarded resources';}
 if(after.development.deck.length<before.development.deck.length)return '🃏 '+name+' bought a development card';
 if(after.roads.length>before.roads.length)return '🛤️ '+name+' built a road';
 if(after.settlements.length>before.settlements.length)return '🏠 '+name+' built a settlement';
 if(after.settlements.some((b,i)=>b.kind!==before.settlements[i]?.kind))return '🏰 '+name+' upgraded a city';
 if(before.offer&&!after.offer){const changed=after.players.some((p,i)=>RESOURCES.some(k=>p.resources[k]!==before.players[i].resources[k]));return changed?'🤝 Trade completed':'🤝 Offer closed';}
 if(after.development.played&&!before.development.played)return '🃏 '+name+' played a development card';
 if(after.bank!==before.bank)return '⚓ '+name+' exchanged resources';
 return null;
}
