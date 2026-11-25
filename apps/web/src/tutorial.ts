import {RESOURCES,type Board,type GameState,type SetupState} from '@orvane/engine';
export const TUTORIAL_SEEN_KEY='orvane.guided-play-seen.v1';
export const MILESTONES=['settlement','road','begin','roll','build','trade','cards','robber','victory'] as const;
export type Milestone=typeof MILESTONES[number];
export interface TutorialProgress {version:1;enabled:boolean;done:Milestone[]}
export type TutorTarget='board'|'launch'|'roll'|'build'|'trade'|'cards'|'info';
export interface Lesson {id:string;icon:string;title:string;body:string;target:TutorTarget;action:string}
const isObject=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function validTutorial(x:unknown):x is TutorialProgress{
 if(!isObject(x)||x.version!==1||typeof x.enabled!=='boolean'||!Array.isArray(x.done))return false;
 return x.done.length<=MILESTONES.length&&new Set(x.done).size===x.done.length&&x.done.every((id:unknown)=>MILESTONES.includes(id as Milestone));
}
export function newTutorial(enabled=false):TutorialProgress{return {version:1,enabled,done:[]};}
export function setTutorialEnabled(p:TutorialProgress,enabled:boolean):TutorialProgress{return p.enabled===enabled?p:{...p,enabled};}
const changedResources=(a:GameState,b:GameState)=>a.players.some((p,i)=>RESOURCES.some(k=>p.resources[k]!==b.players[i].resources[k]));
function completedTrade(a:GameState,b:GameState,humans:number):boolean{
 if(a.offer&&!b.offer&&(a.offer.from<humans||a.offer.to<humans)){
  const o=a.offer;
  return RESOURCES.every(k=>
   b.players[o.from].resources[k]-a.players[o.from].resources[k]===o.want[k]-o.give[k]&&
   b.players[o.to].resources[k]-a.players[o.to].resources[k]===o.give[k]-o.want[k]
  )&&changedResources(a,b);
 }
 if(a.offer||b.offer||a.active>=humans||a.phase!=='action'||a.turn!==b.turn||a.development.deck.length!==b.development.deck.length||a.development.played!==b.development.played||a.roads.length!==b.roads.length||a.settlements.some((s,i)=>s.kind!==b.settlements[i]?.kind)||a.settlements.length!==b.settlements.length)return false;
 // A valid bank exchange changes exactly two resources in opposite directions, with
 // the bank mirroring the active player's hand. Construction never has that shape.
 const delta=RESOURCES.map(k=>b.players[a.active].resources[k]-a.players[a.active].resources[k]);
 return delta.filter(x=>x!==0).length===2&&delta.some(x=>x===1)&&delta.some(x=>x<=-2)&&RESOURCES.every((k,i)=>b.bank[k]-a.bank[k]===-delta[i]);
}
export function advanceTutorial(progress:TutorialProgress,beforeSetup:SetupState|null,afterSetup:SetupState|null,beforeGame:GameState|null,afterGame:GameState|null,humans:number):TutorialProgress{
 if(!progress.enabled)return progress;
 const next=new Set(progress.done);
 if(beforeSetup&&afterSetup){
  if(afterSetup.settlements.length>beforeSetup.settlements.length&&afterSetup.settlements.slice(beforeSetup.settlements.length).some(s=>s.playerId<humans))next.add('settlement');
  if(afterSetup.roads.length>beforeSetup.roads.length&&afterSetup.roads.slice(beforeSetup.roads.length).some(s=>s.playerId<humans))next.add('road');
 }
 if(!beforeGame&&afterGame)next.add('begin');
 if(beforeGame&&afterGame){
  if(beforeGame.phase==='roll'&&beforeGame.dice===null&&afterGame.dice!==null&&beforeGame.active<humans)next.add('roll');
  if(beforeGame.active<humans&&(
   afterGame.roads.some(r=>r.playerId===beforeGame.active&&!beforeGame.roads.some(p=>p.edgeId===r.edgeId))&&beforeGame.phase==='action'||
   afterGame.settlements.some(s=>s.playerId===beforeGame.active&&(!beforeGame.settlements.some(p=>p.vertexId===s.vertexId)||beforeGame.settlements.find(p=>p.vertexId===s.vertexId)?.kind!==s.kind))&&beforeGame.phase==='action'
  ))next.add('build');
  if(completedTrade(beforeGame,afterGame,humans))next.add('trade');
  if(beforeGame.active<humans&&(afterGame.development.deck.length<beforeGame.development.deck.length||!beforeGame.development.played&&afterGame.development.played))next.add('cards');
  if(beforeGame.active<humans&&beforeGame.development.robber!==afterGame.development.robber)next.add('robber');
  if(beforeGame.phase!=='finished'&&afterGame.phase==='finished')next.add('victory');
 }
 if(next.size===progress.done.length)return progress;
 return {...progress,done:MILESTONES.filter(id=>next.has(id))};
}
export function currentLesson(progress:TutorialProgress,setup:SetupState|null,game:GameState|null,humanDecision:boolean):Lesson|null{
 if(!progress.enabled||!setup)return null;
 if(!humanDecision&&game?.phase!=='finished'&&setup.phase!=='complete')return {id:'watch',icon:'👀',title:'Watch the other founder',body:'The other player is placing pieces. Your turn will be highlighted when it arrives.',target:'info',action:'View turn'};
 if(!game){
  if(setup.phase==='settlement')return {id:'settlement',icon:'🏠',title:'Find your first home',body:'Pick a glowing vertex between resource hexes, then confirm. Aim for different resources and strong numbers (6 or 8). You will place two homes.',target:'board',action:'Highlight legal sites'};
  if(setup.phase==='road')return {id:'road',icon:'🛤️',title:'Connect your settlement',body:'Choose a glowing edge beside the settlement you just placed, then confirm. Roads let you expand later.',target:'board',action:'Highlight legal roads'};
  return {id:'begin',icon:'🎲',title:'The island is ready',body:'All players have placed two settlements and roads. The first turn starts automatically.',target:'board',action:'View board'};
 }
 if(game.phase==='finished')return {id:'victory',icon:'🏆',title:'The match is over',body:'Ten victory points wins. Buildings, the longest road, largest army and hidden development cards contribute.',target:'info',action:'Review results'};
 if(!humanDecision)return {id:'watch',icon:'👀',title:'Watch the other founder',body:'The bots take their actions with the same rules. Watch their routes, production and trades.',target:'info',action:'View turn'};
 if(game.offer)return {id:'offer',icon:'🤝',title:'Respond to the offer',body:'Check what you would give and receive. Accept, reject or counter before other actions can continue.',target:'trade',action:'Open trading post'};
 if(game.phase==='discard')return {id:'robber',icon:'🥷',title:'The seven was rolled',body:'Players with more than seven cards must return half (rounded down). Discard the exact number shown.',target:'cards',action:'Open discard'};
 if(game.phase==='robber')return {id:'robber',icon:'🥷',title:'Move the robber',body:'Choose a different hex, then steal from an eligible adjacent rival. That hex stops producing while blocked.',target:'cards',action:'Open robber actions'};
 if(game.phase==='freeRoad')return {id:'cards',icon:'🛤️',title:'Road Building card',body:'Place the glowing free roads, one at a time. There is no lumber or brick cost for these placements.',target:'cards',action:'Open card actions'};
 if(game.phase==='roll')return {id:'roll',icon:'🎲',title:'Roll to produce resources',body:'Matching number tokens pay nearby settlements one card and cities two. A seven activates the robber.',target:'roll',action:'Find Roll dice'};
 if(game.phase==='action'){
  if(!progress.done.includes('build'))return {id:'build',icon:'🏗️',title:'Build your network',body:'Open Build and select Road, Settlement or City. Costs show the needed cards; glowing sites are legal. Tap a site, then confirm.',target:'build',action:'Show construction'};
  if(!progress.done.includes('trade'))return {id:'trade',icon:'⚓',title:'Visit the trading post',body:'Trade with the bank at 4:1, or better at a harbor. You can also offer resources to other players. Only completed trades earn this milestone.',target:'trade',action:'Open trading post'};
  if(!progress.done.includes('cards'))return {id:'cards',icon:'🃏',title:'Explore development cards',body:'A development card costs wool, grain and ore. Hidden victory points stay secret; action cards cannot be played on the turn bought.',target:'cards',action:'Open development'};
  return {id:'explore',icon:'🧭',title:'Play your strategy',body:'You know the basics. Keep expanding, trade when it helps, and race to ten victory points.',target:'info',action:'Open journal'};
 }
 return null;
}
export function tutorialTip(lesson:Lesson):string{
 return lesson.target==='board'?'Golden rings mark legal places. Select one to inspect, then Confirm placement.':
 lesson.target==='build'?'Choose a construction, select a glowing road or vertex, then confirm.':
 lesson.target==='roll'?'Use the Roll button beside your hand.':
 lesson.target==='launch'?'The first turn starts automatically after placement.':
 lesson.target==='trade'?'The trading post opens in the right panel or mobile bottom sheet.':
 lesson.target==='cards'?'Cards, robber actions and discards open together in the actions panel.':'Public moves and scores are visible in the field journal.';
}
