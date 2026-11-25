import {useState,useEffect,useRef} from 'react';
import {botPersonality,PERSONALITIES,RESOURCES,COSTS,legalBuilds,playerScore,VICTORY_TARGET,type Board,type GameState,type SetupState,type BuildKind,type Resources,type Resource} from '@orvane/engine';
import {resourceName} from './resources';
import {ResourceIcon,ResourceFace} from './ResourceArt';
import {BuildingArt,RoadArt} from './PieceArt';
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
export function ResourceHand({resources,queue,solo,desktop=false,canDrag=false}:{resources:Resources;queue:VisualEvent[];solo:boolean;desktop?:boolean;canDrag?:boolean}){
 const gesture=useRef<{id:number;x:number;y:number;resource:Resource;drag:boolean}|null>(null);
 const [drag,setDrag]=useState<{resource:Resource;x:number;y:number}|null>(null);
 const suppressClick=useRef(false);
 const [selected,setSelected]=useState<string|null>(null);
 const [stacked,setStacked]=useState(false);
 const allCards=RESOURCES.flatMap(resource=>Array.from({length:Math.max(0,resources[resource]-(solo?pendingIncome(queue,resource):0))},(_,index)=>({resource,index})));
 const cards=stacked?allCards.filter(c=>c.index===0):allCards;
 const handRef=useRef<HTMLDivElement>(null);
 const [handWidth,setHandWidth]=useState(0);
 useEffect(()=>{
  const el=handRef.current;if(!el)return;
  const observer=new ResizeObserver(([entry])=>setHandWidth(entry.contentRect.width));
  observer.observe(el);return()=>observer.disconnect();
 },[]);
 const idealSpacing=stacked?76:cards.length<=4?48:cards.length<=7?34:cards.length<=12?24:18;
 const spacing=Math.min(idealSpacing,Math.max(0,(handWidth-100)/Math.max(1,cards.length-1)));
 const selectedCard=cards.find(c=>c.resource+ c.index===selected);
 useEffect(()=>{if(selected&&!selectedCard)setSelected(null);},[selected,selectedCard]);
 return <div ref={handRef} className={'resource-hand hand-strip fan-hand'+(desktop?' desktop-hand':'')+(stacked?' stacked-hand':'')} aria-label="Your resources">
  {allCards.length>0&&<button className="hand-mode" type="button" aria-label="Group resource cards into decks" aria-pressed={stacked} onClick={()=>{setStacked(v=>!v);setSelected(null);}}>{stacked?'▤ Decks':'▱ Fan'} · {allCards.length}</button>}
  {cards.length===0&&<span className="empty-hand-message">No resource cards</span>}<div className="fan-scroll"><div className="fan-deck">
   {cards.map(({resource,index},i)=>{const offset=i-(cards.length-1)/2;const t=cards.length>1?offset/((cards.length-1)/2):0;const id=resource+index,raised=selected===id;return <button type="button" key={id} className={'fan-card'+(raised?' raised':'')} aria-pressed={raised} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}setSelected(v=>v===id?null:id)}} onPointerDown={e=>{suppressClick.current=false;if(canDrag&&e.button===0)gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,resource,drag:false};}} onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;if(!g.drag&&g.y-e.clientY>14&&Math.abs(e.clientY-g.y)>Math.abs(e.clientX-g.x)){g.drag=true;e.currentTarget.setPointerCapture(e.pointerId);}if(g.drag)setDrag({resource:g.resource,x:e.clientX,y:e.clientY});}} onPointerUp={e=>{const g=gesture.current;gesture.current=null;setDrag(null);if(!canDrag||!g?.drag||g.id!==e.pointerId)return;suppressClick.current=true;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-card-drop]');if(target)target.dispatchEvent(new CustomEvent('orvane-card-drop',{bubbles:true,detail:g.resource}));}} onPointerCancel={()=>{gesture.current=null;setDrag(null);}} onKeyDown={e=>{if(e.key==='Escape')setSelected(null);}} data-income-target={resource} aria-label={resourceName[resource]+(stacked?": "+allCards.filter(c=>c.resource===resource).length+" cards":"")} title={resourceName[resource]} style={{...(stacked?{width:Math.min(64,Math.max(28,spacing-3)),height:Math.min(64,Math.max(28,spacing-3))*1.375}:{}),left:`calc(50% + ${offset*spacing}px)`,transform:`translateX(-50%) translateY(${(raised?-18:stacked?0:Math.abs(t)*Math.abs(t)*9)}px) rotate(${raised||stacked?0:t*(cards.length<=4?6:10)}deg) scale(${raised?1.12:1})`,zIndex:raised?300:i+1}}><ResourceFace resource={resource}/>{stacked&&<b className="deck-count">{allCards.filter(c=>c.resource===resource).length}</b>}</button>;})}
   {RESOURCES.filter(k=>!cards.some(c=>c.resource===k)).map(k=><span key={k} className="fan-empty-target" data-income-target={k} aria-hidden="true"/>)}
  </div></div>{drag&&<span className="drag-resource-ghost" aria-hidden="true" style={{left:drag.x,top:drag.y}}><ResourceFace resource={drag.resource}/></span>}
 </div>;
}
function FounderAvatar({id,bot,color}:{id:number;bot:boolean;color:string}){
 const variant=id%6;
 const skin=['#d7ae86','#aa795c','#e3c1a0','#bd8d70','#c79772','#a77962'][variant],hair=['#4b392e','#b99a61','#534d45','#775043','#302f2b','#89725a'][variant];
 return <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" style={{display:'block'}}>
 <rect width="48" height="48" fill="#203534"/><circle cx="24" cy="22" r="19" fill={color} opacity=".8"/><circle cx="24" cy="22" r="17.5" fill="none" stroke="#e0c18b" strokeWidth=".8"/>
 <path d="M3 48 9 34 20 29H28L39 34 45 48Z" fill="#374847" stroke="#182929" strokeWidth="1.5"/><path d="M10 36 24 44 38 36 32 48H16Z" fill={color} stroke="#d9bf87" strokeWidth="1.1"/>
 <path d="M17 28v7l7 5 7-5v-7" fill={skin} stroke="#7e5946"/><path d="M15 15 24 9 33 15 34 24 30 31 24 34 18 31 14 24Z" fill={skin} stroke="#6b4d3b" strokeWidth="1.1"/>
 <path d="M15 22 12 20 12 24 16 27M33 22 36 20 36 24 32 27" fill={skin}/>
 {variant===0?<><path d="M11 19 13 9 24 5 35 9 37 19 29 16 24 13 18 17Z" fill={hair}/><path d="M14 26 20 30 24 27 29 30 34 26 30 35 24 38 18 35Z" fill={hair}/></>:variant===1?<><path d="M9 19 13 8 24 4 35 8 39 19 33 16 15 16Z" fill="#b19562" stroke="#4f4c3e"/><path d="M9 19h30" stroke="#e8d0a0" strokeWidth="2"/></>:variant===2?<><path d="M10 23 11 10 24 3 37 10 38 23 32 19 31 12 17 12 16 19Z" fill="#819798" stroke="#d2c6a4"/><path d="M24 5v9" stroke="#e5d0a3"/></>:variant===3?<><path d="M11 19 12 8 24 5 36 9 37 20 31 15 17 14Z" fill={hair}/><path d="M12 12 19 7 24 9 29 7 36 12 35 16H13Z" fill="#7c6a52" stroke="#d4b97d"/></>:variant===4?<><path d="M12 19 10 14 16 6 25 4 34 8 38 16 32 20 30 15 18 15Z" fill="#415b50" stroke="#b0b894"/><path d="M12 23 15 35 8 40M36 23 33 35 40 40" fill="none" stroke="#415b50" strokeWidth="4"/></>:<><path d="M12 20 13 8 24 5 35 9 36 20 29 14 18 15Z" fill={hair}/><path d="M17 27 24 30 31 27 29 34 24 37 19 34Z" fill={hair}/></>}
 <path d="M18 21h3M27 21h3" stroke="#26302d" strokeWidth="1.5" strokeLinecap="round"/><path d="M24 22v4l2 1M21 29h6" fill="none" stroke="#8c6048" strokeWidth="1"/>
 {bot&&<path d="M37 35 43 41 37 47 31 41Z" fill="#e4c98b" stroke="#223b40"/>}</svg>;
}
function SeatGlyph({kind}:{kind:'cards'|'victory'|'road'|'army'}){
 return <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{verticalAlign:'-2px',marginInlineEnd:3}}>
 {kind==='cards'?<><rect x="6" y="3" width="10" height="14" rx="1.5"/><path d="M4 5 2 15 4 16M9 7h4M9 10h4"/></>:kind==='victory'?<><path d="M3 5 7 9 10 3 13 9 17 5 15 15H5Z"/><path d="M5 17h10"/></>:kind==='road'?<><path d="m3 17 5-6 3-2 6-6M8 17l4-5 3-2 4-5"/><path d="m6 15 2-2m5-5 2-2"/></>:<><path d="m4 3 13 14M16 3 3 16M3 12l5 5M12 17l5-5"/><path d="m4 3 4 1M16 3l-4 1"/></>}
 </svg>;
}
export function PlayerStrip({view,game,active,humans,showHand,soloAvatar,soloTitle,seed}:{seed?:string;soloTitle?:string;soloAvatar?:string;view:GameState|SetupState;game:GameState|null;active:number|null;humans:number;showHand:number|null}){
 return <section className="player-strip game-players" aria-label="Players">{view.players.map(p=>{const personality=p.id>=humans&&seed!==undefined?PERSONALITIES[botPersonality(seed,p.id)]:null;const score=game?playerScore(game,p.id,p.id===showHand||game.phase==='finished').total:null;const details=[soloTitle&&p.id===0&&humans===1?soloTitle:null,personality?.label,game?`Road: ${game.awards.roadLengths[p.id]} · Knights: ${game.development.knights[p.id]}`:null].filter(Boolean).join(" · ");return <div key={p.id} className={'player player-seat'+(p.id===active?' active':'')} style={{borderInlineStartColor:p.color}} aria-label={p.name+(p.id===active?', active player':'')}><span className="seat-avatar" style={{background:p.color}}>{p.id<humans&&humans===1&&soloAvatar&&soloAvatar!=='👤'?soloAvatar:<FounderAvatar id={p.id} bot={p.id>=humans} color={p.color}/>}</span><div className="seat-main" title={details}><strong>{p.name.replace('🤖 ','')}</strong><div className="seat-stats"><span title="Resource cards"><SeatGlyph kind="cards"/> {Object.values(p.resources).reduce((a,b)=>a+b,0)}</span></div></div>{score!==null&&<span className="seat-score" title={score+' of '+VICTORY_TARGET+' victory points'}><SeatGlyph kind="victory"/> {score}<small>/{VICTORY_TARGET}</small></span>}{game&&(game.awards.longestRoad===p.id||game.awards.largestArmy===p.id)&&<span className="seat-award" title="Award holder">{game.awards.longestRoad===p.id?<SeatGlyph kind="road"/>:null}{game.awards.largestArmy===p.id?<SeatGlyph kind="army"/>:null}</span>}</div>;})}</section>;
}
export function BuildMenu({board,game,build,onSelect,onClose}:{onClose?:()=>void;board:Board;game:GameState;build:BuildKind;onSelect:(k:BuildKind)=>void}){
 const actor=game.players.find(p=>p.id===game.active)!;
 const menu=useRef<HTMLElement|null>(null);
 useEffect(()=>{const el=menu.current;if(!el)return;const drop=(e:Event)=>{const resource=(e as CustomEvent<Resource>).detail;const kind=(e.target as HTMLElement).closest<HTMLElement>('[data-build-drop]')?.dataset.buildDrop as BuildKind|undefined;if(kind&&RESOURCES.includes(resource)&&COSTS[kind][resource]>0&&actor.resources[resource]>0&&legalBuilds(board,game,kind).length)onSelect(kind);};el.addEventListener('orvane-card-drop',drop);return()=>el.removeEventListener('orvane-card-drop',drop);},[board,game,actor,onSelect]);
 return <section className="build-menu" ref={menu} id="construction" tabIndex={-1} data-coach-target="build" aria-label="Construction menu"><div className="construction-heading"><strong>Construction</strong>{onClose&&<button type="button" aria-label="Close construction" onClick={onClose}>✕</button>}</div>{(Object.keys(BUILD_ART) as BuildKind[]).map(k=>{const n=legalBuilds(board,game,k).length;return <button key={k} className="build-option" data-card-drop="" data-build-drop={k} aria-pressed={build===k} onClick={()=>onSelect(k)}><span className="build-title"><svg className="build-piece-preview" viewBox="-23 -23 46 40" aria-hidden="true">{k==="road"?<RoadArt a={{x:-13,y:6}} b={{x:13,y:-6}} color={actor.color} styleId="classic"/>:<BuildingArt p={{x:0,y:0}} city={k==="city"} color={actor.color} styleId="classic"/>}</svg><span>{BUILD_ART[k].label}</span></span><span className="build-cost">{RESOURCES.filter(r=>COSTS[k][r]>0).map(r=><span key={r} className={actor.resources[r]<COSTS[k][r]?'missing-cost':''} title={resourceName[r]}><ResourceIcon resource={r}/>{COSTS[k][r]}</span>)}</span><small className="build-availability">{n?'Available':RESOURCES.some(r=>actor.resources[r]<COSTS[k][r])?'Need resources':'No legal site'}</small></button>;})}</section>;
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

