import {RESOURCES,COSTS,legalBuilds,playerScore,VICTORY_TARGET,type Board,type GameState,type SetupState,type BuildKind,type Resources} from '@orvane/engine';
import {resourceEmoji,resourceName} from './resources';
import {pendingIncome,type VisualEvent} from './visualEvents';
export const BUILD_ART:Record<BuildKind,{icon:string;label:string}>={road:{icon:'🛤️',label:'Road'},settlement:{icon:'🏠',label:'Settlement'},city:{icon:'🏰',label:'City'}};
export type Panel='cards'|'trade'|'info';
export function requiredPanel(game:GameState|null,humanDecision:boolean):Panel|null{
 if(!game||!humanDecision)return null;
 if(game.offer)return 'trade';
 if(['discard','robber','freeRoad'].includes(game.phase))return 'cards';
 return null;
}
export function visiblePanel(game:GameState|null,humanDecision:boolean,selected:Panel):Panel{
 const required=requiredPanel(game,humanDecision);if(required)return required;
 if(!game||!humanDecision||game.phase==='finished')return 'info';
 if(selected==='trade'&&game.phase!=='action')return 'info';
 if(selected==='cards'&&game.offer)return 'info';
 return selected;
}
export function ResourceHand({resources,queue,solo,desktop=false}:{resources:Resources;queue:VisualEvent[];solo:boolean;desktop?:boolean}){
 return <div className={'resource-hand hand-strip'+(desktop?' desktop-hand':'')} aria-label="Your resources">{RESOURCES.map(k=>{const count=Math.max(0,resources[k]-(solo?pendingIncome(queue,k):0));return <span className={'resource-card resource-'+k} key={k} data-income-target={k} aria-label={resourceName[k]+': '+count} title={resourceName[k]}><span className="resource-card-icon">{resourceEmoji[k]}</span><b>{count}</b><small>{resourceName[k]}</small></span>;})}</div>;
}
export function PlayerStrip({view,game,active,humans,showHand}:{view:GameState|SetupState;game:GameState|null;active:number|null;humans:number;showHand:number|null}){
 return <section className="player-strip game-players" aria-label="Players">{view.players.map(p=>{const score=game?playerScore(game,p.id,p.id===showHand||game.phase==='finished').total:null;return <div key={p.id} className={'player player-seat'+(p.id===active?' active':'')} aria-label={p.name+(p.id===active?', active player':'')}><span className="seat-avatar" style={{background:p.color}}>{p.id<humans?'👤':'🤖'}</span><div className="seat-main"><strong>{p.name.replace('🤖 ','')}</strong><div className="seat-stats"><span title="Resource cards">🃏 {Object.values(p.resources).reduce((a,b)=>a+b,0)}</span>{game&&<><span title="Longest road length">🛤️ {game.awards.roadLengths[p.id]}</span><span title="Played knights">⚔️ {game.development.knights[p.id]}</span></>}</div></div>{score!==null&&<span className="seat-score" title={score+' of '+VICTORY_TARGET+' victory points'}>🏆 {score}<small>/{VICTORY_TARGET}</small></span>}{game&&(game.awards.longestRoad===p.id||game.awards.largestArmy===p.id)&&<span className="seat-award" title="Award holder">{game.awards.longestRoad===p.id?'🛤️':''}{game.awards.largestArmy===p.id?'⚔️':''}</span>}</div>;})}</section>;
}
export function BuildMenu({board,game,build,onSelect}:{board:Board;game:GameState;build:BuildKind;onSelect:(k:BuildKind)=>void}){
 const actor=game.players.find(p=>p.id===game.active)!;
 return <section className="build-menu" id="construction" aria-label="Construction menu">{(Object.keys(BUILD_ART) as BuildKind[]).map(k=>{const n=legalBuilds(board,game,k).length;return <button key={k} className="build-option" aria-pressed={build===k} onClick={()=>onSelect(k)}><span className="build-title"><span>{BUILD_ART[k].icon}</span> {BUILD_ART[k].label}</span><span className="build-cost">{RESOURCES.filter(r=>COSTS[k][r]>0).map(r=><span key={r} className={actor.resources[r]<COSTS[k][r]?'missing-cost':''} title={resourceName[r]}>{resourceEmoji[r]}{COSTS[k][r]}</span>)}</span><small>{n?n+' sites':'Not available'}</small></button>;})}</section>;
}
export function Guide({phase}:{phase?:string}){
 const steps=[['🏠','Settle','Place two settlements and adjoining roads. Choose productive hexes with varied resources.'],['🎲','Produce','Roll the dice. Matching numbered tiles supply adjacent buildings; cities collect twice as much.'],['🛤️','Expand','Select a construction card, then a highlighted board site. Confirm to pay and build.'],['⚓','Trade','Exchange with the bank or offer resources to another player. Ports improve your rate.'],['🥷','Robber','A seven triggers discards and robber movement. Select a new hex and a victim if available.'],['🏆','Win','Reach ten points through buildings, hidden victory cards and awards.']];
 const current=phase==='settlement'||phase==='road'?0:phase==='roll'?1:phase==='action'?2:phase==='discard'||phase==='robber'?4:-1;
 return <div className="guide-steps">{steps.map(([icon,title,body],i)=><article key={title} className={i===current?'guide-current':''}><span>{icon}</span><div><strong>{title}</strong><p>{body}</p></div></article>)}</div>;
}
export function HomeMenu({onPlay,onGuide,onSettings,onExpansions}:{onPlay:()=>void;onGuide:()=>void;onSettings:()=>void;onExpansions:()=>void}){
 return <section className="home-screen"><div className="home-crest" aria-hidden="true">🏰</div><p className="eyebrow">THE ISLAND AWAITS</p><h2>Founders of Orvane</h2><p>Build. Trade. Explore. Prosper.</p><div className="home-actions"><button className="primary-action" onClick={onPlay}>⚔️ New game <small>3–6 players · humans & bots</small></button><button onClick={onGuide}>📖 How to play</button><button onClick={onSettings}>⚙️ Settings</button><button onClick={onExpansions}>⛵ Expansions <small>Roadmap</small></button></div><p className="muted">Local play · No account required</p></section>;
}
export function ExpansionRoadmap(){return <section className="panel expansion-roadmap"><h2>🌍 Planned expansions</h2>{[['⛵','Uncharted Seas'],['🏰','Crowns & Knights'],['🐪','Trade & Tribes'],['🏴‍☠️','Beyond the Horizon'],['🌍','Grand Campaign']].map(([icon,title])=><div key={title}><span>{icon}</span><strong>{title}</strong><small>Planned</small></div>)}<p className="muted">The base game is the current playable mode. Online is optional.</p></section>;}
