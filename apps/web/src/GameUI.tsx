import {useState,useEffect} from 'react';
import {botPersonality,PERSONALITIES,RESOURCES,COSTS,legalBuilds,playerScore,VICTORY_TARGET,type Board,type GameState,type SetupState,type BuildKind,type Resources} from '@orvane/engine';
import {resourceName} from './resources';
import {ResourceIcon,ResourceFace} from './ResourceArt';
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
 const [selected,setSelected]=useState<string|null>(null);
 const cards=RESOURCES.flatMap(resource=>Array.from({length:Math.max(0,resources[resource]-(solo?pendingIncome(queue,resource):0))},(_,index)=>({resource,index})));
 const selectedCard=cards.find(c=>c.resource+ c.index===selected);
 useEffect(()=>{if(selected&&!selectedCard)setSelected(null);},[selected,selectedCard]);
 return <div className={'resource-hand hand-strip fan-hand'+(desktop?' desktop-hand':'')} aria-label="Your resources">
  <div className="fan-scroll"><div className="fan-deck" style={{width:`max(100%, ${64+Math.max(0,cards.length-1)*13}px)`}}>
   {cards.map(({resource,index},i)=>{const offset=i-(cards.length-1)/2;const t=cards.length>1?offset/((cards.length-1)/2):0;const id=resource+index,raised=selected===id;return <button type="button" key={id} className={'fan-card'+(raised?' raised':'')} aria-pressed={raised} onClick={()=>setSelected(v=>v===id?null:id)} onKeyDown={e=>{if(e.key==='Escape')setSelected(null);}} data-income-target={resource} aria-label={resourceName[resource]} title={resourceName[resource]} style={{left:`calc(50% + ${offset*13}px)`,transform:`translateX(-50%) translateY(${(raised?-18:Math.abs(t)*Math.abs(t)*9)}px) rotate(${raised?0:t*12}deg) scale(${raised?1.12:1})`,zIndex:raised?300:i+1}}><ResourceFace resource={resource}/></button>;})}
   {RESOURCES.filter(k=>!cards.some(c=>c.resource===k)).map(k=><span key={k} className="fan-empty-target" data-income-target={k} aria-hidden="true"/>)}
  </div></div>
 </div>;
}
export function PlayerStrip({view,game,active,humans,showHand,soloAvatar,soloTitle,seed}:{seed?:string;soloTitle?:string;soloAvatar?:string;view:GameState|SetupState;game:GameState|null;active:number|null;humans:number;showHand:number|null}){
 return <section className="player-strip game-players" aria-label="Players">{view.players.map(p=>{const personality=p.id>=humans&&seed!==undefined?PERSONALITIES[botPersonality(seed,p.id)]:null;const score=game?playerScore(game,p.id,p.id===showHand||game.phase==='finished').total:null;return <div key={p.id} className={'player player-seat'+(p.id===active?' active':'')} aria-label={p.name+(p.id===active?', active player':'')}><span className="seat-avatar" style={{background:p.color}}>{p.id<humans?(humans===1?soloAvatar??'👤':'👤'):'🤖'}</span><div className="seat-main"><strong>{p.name.replace('🤖 ','')}</strong>{humans===1&&p.id===0&&soloTitle&&<small className="seat-title">{soloTitle}</small>}{personality&&<small className="seat-title bot-personality" title={personality.label}>{personality.icon} {personality.label}</small>}<div className="seat-stats"><span title="Resource cards">🃏 {Object.values(p.resources).reduce((a,b)=>a+b,0)}</span>{game&&<><span title="Longest road length">🛤️ {game.awards.roadLengths[p.id]}</span><span title="Played knights">⚔️ {game.development.knights[p.id]}</span></>}</div></div>{score!==null&&<span className="seat-score" title={score+' of '+VICTORY_TARGET+' victory points'}>🏆 {score}<small>/{VICTORY_TARGET}</small></span>}{game&&(game.awards.longestRoad===p.id||game.awards.largestArmy===p.id)&&<span className="seat-award" title="Award holder">{game.awards.longestRoad===p.id?'🛤️':''}{game.awards.largestArmy===p.id?'⚔️':''}</span>}</div>;})}</section>;
}
export function BuildMenu({board,game,build,onSelect}:{board:Board;game:GameState;build:BuildKind;onSelect:(k:BuildKind)=>void}){
 const actor=game.players.find(p=>p.id===game.active)!;
 return <section className="build-menu" id="construction" tabIndex={-1} data-coach-target="build" aria-label="Construction menu">{(Object.keys(BUILD_ART) as BuildKind[]).map(k=>{const n=legalBuilds(board,game,k).length;return <button key={k} className="build-option" aria-pressed={build===k} onClick={()=>onSelect(k)}><span className="build-title"><span>{BUILD_ART[k].icon}</span> {BUILD_ART[k].label}</span><span className="build-cost">{RESOURCES.filter(r=>COSTS[k][r]>0).map(r=><span key={r} className={actor.resources[r]<COSTS[k][r]?'missing-cost':''} title={resourceName[r]}><ResourceIcon resource={r}/>{COSTS[k][r]}</span>)}</span><small>{n?n+' sites':'Not available'}</small></button>;})}</section>;
}
export function Guide({phase}:{phase?:string}){
 const steps=[['🏠','Settle','Place two settlements and adjoining roads. Choose productive hexes with varied resources.'],['🎲','Produce','Roll the dice. Matching numbered tiles supply adjacent buildings; cities collect twice as much.'],['🛤️','Expand','Select a construction card, then a highlighted board site. Confirm to pay and build.'],['⚓','Trade','Exchange with the bank or offer resources to another player. Ports improve your rate.'],['🥷','Robber','A seven triggers discards and robber movement. Select a new hex and a victim if available.'],['🏆','Win','Reach ten points through buildings, hidden victory cards and awards.']];
 const current=phase==='settlement'||phase==='road'?0:phase==='roll'?1:phase==='action'?2:phase==='discard'||phase==='robber'?4:-1;
 return <div className="guide-steps">{steps.map(([icon,title,body],i)=><article key={title} className={i===current?'guide-current':''}><span>{icon}</span><div><strong>{title}</strong><p>{body}</p></div></article>)}</div>;
}
export function HomeMenu({onPlay,onGuide,onSettings,onExpansions,onContinue,onSaves,onProfile,profileLabel}:{onProfile:()=>void;profileLabel?:string;onContinue?:()=>void;onSaves:()=>void;onPlay:()=>void;onGuide:()=>void;onSettings:()=>void;onExpansions:()=>void}){
 return <section className="home-screen">
   <div className="home-scene" aria-hidden="true"><div className="home-orbit"/><svg viewBox="0 0 660 560" preserveAspectRatio="xMidYMid meet">
   <defs><linearGradient id="islandLight" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#ffdf98"/><stop offset="1" stopColor="#6f9a82"/></linearGradient><linearGradient id="seaShine" x1="0" x2=".8" y1="0" y2="1"><stop stopColor="#466c6a"/><stop offset="1" stopColor="#071923"/></linearGradient></defs>
   <ellipse cx="340" cy="330" rx="260" ry="159" fill="url(#seaShine)" opacity=".9"/>
   <path d="M136 295L238 218L378 186L522 265L550 356L434 428L274 430L148 364Z" fill="#172f33" stroke="#8c9465" strokeWidth="8"/>
   <path d="M158 296L251 236L371 210L507 278L524 352L419 400L281 409L167 346Z" fill="#56755a"/>
   <path d="M210 270L276 236L337 260L320 315L258 349L191 322Z" fill="#b99e6d" stroke="#d7bf85" strokeWidth="5"/><path d="M337 260L423 246L485 292L462 348L368 351L320 315Z" fill="#788664" stroke="#d7bf85" strokeWidth="5"/><path d="M258 349L320 315L368 351L419 400L281 409L221 371Z" fill="#9b7753" stroke="#d7bf85" strokeWidth="5"/>
   <path d="M250 237l26 -60l26 60M280 234l18 -46l17 52M385 254l35 -90l40 90" fill="#c1c6aa" stroke="#334f51" strokeWidth="5"/>
   <path d="M240 336v-62l30 -22l32 22v62zM228 280l42 -39l45 39" fill="#b08a5d" stroke="#f4d69e" strokeWidth="7"/><path d="M260 336v-28h17v28" fill="#293e3b"/>
   <path d="M368 337v-83h17v-27h31v27h18v83z" fill="#d2b67d" stroke="#fff3c7" strokeWidth="6"/><path d="M389 337v-35h21v35" fill="#3c504a"/>
   <path d="M184 356l54 12l44 42M458 378l66 -17" fill="none" stroke="#ecddb5" strokeWidth="7" strokeDasharray="12 9"/>
   <g fill="#f4e6b6" opacity=".9"><circle cx="188" cy="218" r="4"/><circle cx="472" cy="190" r="3"/><circle cx="530" cy="432" r="5"/><circle cx="120" cy="393" r="3"/></g></svg></div>
   <div className="home-content"><span className="home-emblem">✦</span><p className="eyebrow">WELCOME TO YOUR KINGDOM</p><h2>FOUNDERS <span>OF ORVANE</span></h2><p className="home-tagline">Build. Trade. Explore. Prosper.</p><div className="home-actions">
     {onContinue&&<button className="primary-action hero-play" onClick={onContinue}><span>▶ Continue journey</span><small>Resume your saved match</small></button>}
     <button className={onContinue?"hero-play":"primary-action hero-play"} onClick={onPlay}><span>⚔️ New game</span><small>3–6 players · Local & AI</small></button>
     <div className="home-secondary"><button onClick={onSaves}>💾 Saved games & statistics</button><button onClick={onGuide}>📖 How to play</button></div>
     <div className="home-secondary"><button onClick={onProfile}>{profileLabel??"👤 Your founder profile"}</button><button onClick={onSettings}>⚙️ Settings</button></div><button className="home-expansions" onClick={onExpansions}>⛵ Expansions · Coming soon</button>
   </div><p className="home-bottom">✦ OFFLINE FIRST · NO ACCOUNT REQUIRED · EVERY ISLAND IS UNIQUE ✦</p></div>
 </section>;
}
export function ExpansionRoadmap(){return <section className="panel expansion-roadmap"><h2>🌍 Planned expansions</h2>{[['⛵','Uncharted Seas'],['🏰','Crowns & Knights'],['🐪','Trade & Tribes'],['🏴‍☠️','Beyond the Horizon'],['🌍','Grand Campaign']].map(([icon,title])=><div key={title}><span>{icon}</span><strong>{title}</strong><small>Planned</small></div>)}<p className="muted">The base game is the current playable mode. Online is optional.</p></section>;}

