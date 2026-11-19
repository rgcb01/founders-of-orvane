import type {GameState,SetupState} from '@orvane/engine';
export type Cue='spend'|'steal'|'production'|'dice'|'road'|'settlement'|'city'|'trade'|'offer'|'card'|'robber'|'discard'|'turn'|'victory'|'defeat'|'award'|'start'|'select';
export function gameCue(before:GameState|null,after:GameState|null,humans:number):Cue|null{
 if(!after)return null;
 if(!before)return 'start';
 if(before.winner!==after.winner&&after.winner!==null)return after.winner<humans?'victory':'defeat';
 if(after.phase==='discard'&&before.phase!=='discard'||after.phase==='robber'&&before.phase!=='robber'||after.development.robber!==before.development.robber)return 'robber';
 if(after.offer&&after.offer!==before.offer)return 'offer';
 if(after.development.deck.length<before.development.deck.length)return 'card';
 if((after.awards.longestRoad!==before.awards.longestRoad&&after.awards.longestRoad!==null)||(after.awards.largestArmy!==before.awards.largestArmy&&after.awards.largestArmy!==null))return 'award';
 if(after.roads.length>before.roads.length)return 'road';
 if(after.settlements.length>before.settlements.length)return 'settlement';
 if(after.settlements.some((b,i)=>b.kind!==before.settlements[i]?.kind))return 'city';
 if(after.turn!==before.turn)return 'turn';
 if(before.phase==='roll'&&after.dice!==null&&after.dice!==before.dice)return 'dice';
 if(before.offer&&!after.offer&&after.players.some((p,i)=>Object.keys(p.resources).some(k=>p.resources[k as keyof typeof p.resources]!==before.players[i].resources[k as keyof typeof p.resources])))return 'trade';
 if(after.phase==='discard'||before.phase==='discard')return 'discard';
 if(after.development.played&&!before.development.played)return 'card';
 if(after.bank!==before.bank)return 'trade';
 if(after.awards.longestRoad!==before.awards.longestRoad||after.awards.largestArmy!==before.awards.largestArmy)return 'award';
 return null;
}
export function setupCue(before:SetupState|null,after:SetupState|null):Cue|null{
 if(!after)return null;if(!before)return 'start';
 if(after.settlements.length>before.settlements.length)return 'settlement';
 if(after.roads.length>before.roads.length)return 'road';return null;
}
