import {StrictMode,useMemo,useRef,useState,useEffect,useLayoutEffect,type KeyboardEvent,type PointerEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {generateBoard,tilePosition,vertexPosition,type BoardSize,type Terrain,createSetup,activePlayer,legalSettlements,legalRoads,applySetup,type PlayerCount,type SetupState,startGame,applyGame,legalBuilds,rollDice,RESOURCES,type GameState,type BuildKind,freeRoadSites,playerScore,chooseFirstPlayer,decisionPlayer,type Difficulty} from '@orvane/engine';
import './style.css';
import {DevelopmentPanel} from './DevelopmentPanel';
import {TradePanel} from './TradePanel';
import {resourceEmoji} from './resources';
import {BuildingArt,RoadArt,RobberArt} from './PieceArt';
import {useGameAudio} from './audio';
import {gameCue,setupCue} from './soundEvents';
import {botDelay,matchEvent,setupEvent,PACES,type Pace} from './matchUX';
import {gameVisual,setupVisual,visualDuration,type VisualEvent} from './visualEvents';
import {BoardEffects,EventStage} from './VisualEffects';
import {cameraTarget,focusPoints} from './camera';
import {IncomeFlights} from './IncomeFlights';
import type {Cue} from './soundEvents';
import {readLibrary,saveMatch,removeMatch,readPreferences,latestUnfinished,PREF_KEY,SAVE_KEY,DEFAULT_PREFS,type Library,type SavedMatch,type Preferences} from './persistence';
import {readProfile,writeProfile,createProfile,progression,avatarIcon,matchXP,PROFILE_KEY,type LocalProfile} from './progression';
import {effectiveLoadout,DEFAULT_LOADOUT,cosmetic} from './cosmetics';
import {EMPTY_METRICS} from './matchMetrics';
import {MatchRewards} from './ChallengePanel';
import {ProfileScreen} from './ProfileScreen';
import {type Backup} from './backup';
import {SavedGames} from './SavedGames';
import {BotClient} from './botClient';
import {needsHandoff,privateHandSeat} from './privateHandoff';
import {TutorialCoach} from './TutorialCoach';
import {advanceTutorial,currentLesson,newTutorial,setTutorialEnabled,tutorialTip,TUTORIAL_SEEN_KEY,type TutorialProgress,type TutorTarget} from './tutorial';
import {usePwa} from './pwa';
import {HomeMenu,Guide,ExpansionRoadmap,PlayerStrip,ResourceHand,BuildMenu,requiredPanel,visiblePanel,type Panel} from './GameUI';

const terrain:Record<Terrain,{name:string;icon:string;color:string;resource:string}>={
 forest:{name:'Forest',icon:'🌲',color:'#4c7957',resource:'Lumber'},
 pasture:{name:'Pasture',icon:'🐑',color:'#a2b96c',resource:'Wool'},
 field:{name:'Field',icon:'🌾',color:'#d8b45b',resource:'Grain'},
 hill:{name:'Hills',icon:'🧱',color:'#bb7350',resource:'Brick'},
 mountain:{name:'Mountain',icon:'⛰️',color:'#7d8795',resource:'Ore'},
 desert:{name:'Desert',icon:'🏜️',color:'#c9a97c',resource:'None'}
};
type Selection={kind:'tile'|'vertex'|'edge';id:string};
const R=49;
function App(){
 const pwa=usePwa();
 const [prefs]=useState(()=>{try{return readPreferences(localStorage);}catch{return DEFAULT_PREFS;}});
 const [library,setLibrary]=useState<Library>(()=>{try{return readLibrary(localStorage);}catch{return {schema:1,matches:[],results:[]};}});
 const [profile,setProfile]=useState<LocalProfile|null>(null);
 const [profileError,setProfileError]=useState('');
 const [storageError,setStorageError]=useState('');
 const [matchId,setMatchId]=useState<string|null>(null);
 const createdAt=useRef(0);
 const [savedAt,setSavedAt]=useState<number|null>(null);
 const [follow,setFollow]=useState(prefs.follow);
 const cameraFrame=useRef<number|null>(null);
 const heard=useRef<VisualEvent|null>(null);
 const [menu,setMenu]=useState<'home'|'setup'|'guide'|'expansions'|'saves'|'profile'>('home');
 const [panel,setPanel]=useState<Panel>('info');
 const [drawerOpen,setDrawerOpen]=useState(false);
 const [pauseMenuOpen,setPauseMenuOpen]=useState(false);
 const [revealedSeat,setRevealedSeat]=useState<number|null>(null);
 const previousDecision=useRef<number|null>(null);
 const [fullscreen,setFullscreen]=useState(()=>Boolean(document.fullscreenElement));
 const [guideOpen,setGuideOpen]=useState(false);
 const [tutorial,setTutorial]=useState<TutorialProgress>(()=>newTutorial());
 const [coachOpen,setCoachOpen]=useState(false);
 const [coachFocus,setCoachFocus]=useState<TutorTarget|null>(null);
 const [forceGuided,setForceGuided]=useState(false);
 const [soundOpen,setSoundOpen]=useState(false);
 const [size,setSize]=useState<BoardSize>(prefs.count<=4?'standard':'extended');
 const [count,setCount]=useState<PlayerCount>(prefs.count);
 const [humans,setHumans]=useState(prefs.humans);
 const [difficulty,setDifficulty]=useState<Difficulty>(prefs.difficulty);
 const [pace,setPace]=useState<Pace>(prefs.pace);
 const [visualQueue,setVisualQueue]=useState<VisualEvent[]>([]);
 const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [hidden,setHidden]=useState(()=>document.hidden);
 const visual=visualQueue[0];
 const duration=visual?visualDuration(visual,pace,reduced):0;
 const [paused,setPaused]=useState(false);
 const [stepRequested,setStepRequested]=useState(false);
 const [botError,setBotError]=useState('');
 const [activity,setActivity]=useState<string[]>([]);
 const attempts=useRef({turn:0,count:0});
 const botClient=useRef<BotClient|null>(null);
 useEffect(()=>()=>{botClient.current?.dispose();botClient.current=null;},[]);
 const [setup,setSetup]=useState<SetupState|null>(null);
 const [game,setGame]=useState<GameState|null>(null);
 const [build,setBuild]=useState<BuildKind>('road');
 const [seed,setSeed]=useState('orvane-001');
 const [draft,setDraft]=useState(seed);
 const [selection,setSelection]=useState<Selection|null>(null);
 const [zoom,setZoom]=useState(1);
 const [pan,setPan]=useState({x:0,y:0});
 const svg=useRef<SVGSVGElement>(null);
 const drag=useRef<{id:number;x:number;y:number;panX:number;panY:number;moved:boolean}|null>(null);
 const board=useMemo(()=>generateBoard(seed,size),[seed,size]);
 const view=game??setup;
 const previous=useRef<{game:GameState|null;setup:SetupState|null}>({game:null,setup:null});
 const playerId=game?game.active:setup?activePlayer(setup):null;
 const decision=game?decisionPlayer(game):setup?activePlayer(setup):null;
 const botBusy=decision!==null&&decision>=humans&&!botError;
 const handoffPending=!!view&&needsHandoff(humans,decision,revealedSeat);
 const humanDecision=decision!==null&&decision<humans&&!visual&&!handoffPending;
 const humanActive=humanDecision&&decision===playerId&&!game?.offer;
 const showHand=privateHandSeat(humans,decision,revealedSeat);
 useLayoutEffect(()=>{
   // Revoke permission before paint when the device changes hands.
   if(previousDecision.current===decision)return;
   previousDecision.current=decision;
   if(humans>1){
     setRevealedSeat(null);
     if(decision!==null&&decision<humans){setSelection(null);setDrawerOpen(false);}
   }
 },[decision,humans]);
 useEffect(()=>{
   const load=()=>{try{const old=readProfile(localStorage);const next=old??writeProfile(localStorage,createProfile(crypto.randomUUID(),Date.now()));setProfile(next);setProfileError('');}catch(e){setProfileError(e instanceof Error?e.message:'Local profile unavailable');}};
   load();const changed=(e:StorageEvent)=>{if(e.key===PROFILE_KEY)load();};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
 },[]);
 const updateProfile=(next:LocalProfile)=>{try{setProfile(writeProfile(localStorage,next));setProfileError('');}catch(e){setProfileError(e instanceof Error?e.message:'Could not save profile');throw e;}};
 const progress=profile?progression(library.results,profile.id):null;
 const loadout=profile&&progress?effectiveLoadout(profile.loadout,progress):DEFAULT_LOADOUT;
 const audio=useGameAudio(loadout.music);
 const preferences:Preferences={count,humans,difficulty,pace,follow};
 useEffect(()=>{const load=()=>{try{setLibrary(readLibrary(localStorage));setStorageError('');}catch(e){setStorageError(e instanceof Error?e.message:'Storage unavailable');}};load();const changed=(e:StorageEvent)=>{if(e.key===SAVE_KEY)load();};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
 useEffect(()=>{try{localStorage.setItem(PREF_KEY,JSON.stringify(preferences));}catch{}},[count,humans,difficulty,pace,follow]);
 useLayoutEffect(()=>{
   if(!matchId||!setup)return;
   const now=Date.now();
   try{const next=saveMatch(localStorage,{schema:1,id:matchId,profileId:profile?.id,metrics:humans===1?EMPTY_METRICS:undefined,createdAt:createdAt.current,updatedAt:now,seed,size,preferences,setup,game,activity,tutorial,attempts:{...attempts.current}});setLibrary(next);setSavedAt(now);setStorageError('');}
   catch(e){setStorageError(e instanceof Error?e.message:'Could not save match');}
 },[matchId,setup,game,seed,size,count,humans,difficulty,pace,follow,activity,profile?.id,tutorial]);
 const resume=(m:SavedMatch)=>{
   const p=m.preferences;createdAt.current=m.createdAt;setMatchId(m.id);setSavedAt(m.updatedAt);
   setCount(p.count);setHumans(p.humans);setDifficulty(p.difficulty);setPace(p.pace);setFollow(p.follow);setSize(m.size);setSeed(m.seed);setDraft(m.seed);
   previous.current={setup:m.setup,game:m.game};setSetup(m.setup);setGame(m.game);setActivity(m.activity);attempts.current={...m.attempts};
   setVisualQueue([]);setSelection(null);setPan({x:0,y:0});setZoom(1);setBotError('');setPanel('info');setDrawerOpen(false);setPauseMenuOpen(false);setTutorial(m.tutorial??newTutorial());setCoachOpen(m.tutorial?.enabled??false);setCoachFocus(null);setRevealedSeat(null);previousDecision.current=null;setPaused(true);setStepRequested(false);setMenu('setup');
 };
 const leave=()=>{if(storageError&&!window.confirm('Saving failed. Leave anyway?'))return false;setMatchId(null);setSavedAt(null);setMenu('home');setDrawerOpen(false);setPauseMenuOpen(false);setGame(null);setSetup(null);setSelection(null);setBotError('');setActivity([]);setCoachOpen(false);setCoachFocus(null);setTutorial(newTutorial());setRevealedSeat(null);previousDecision.current=null;setVisualQueue([]);setPaused(false);setStepRequested(false);attempts.current={turn:0,count:0};return true;};
 const deleteSave=(id:string)=>{try{setLibrary(removeMatch(localStorage,id));setStorageError('');}catch(e){setStorageError(e instanceof Error?e.message:'Could not delete saved game');}};
 const restoreLocal=(b:Backup)=>{
   const p=b.preferences;setLibrary(b.library);setProfile(b.profile);setProfileError('');setStorageError('');
   setCount(p.count);setHumans(p.humans);setDifficulty(p.difficulty);setPace(p.pace);setFollow(p.follow);setSize(p.count<=4?'standard':'extended');
   if(!b.profile){try{setProfile(writeProfile(localStorage,createProfile(crypto.randomUUID(),Date.now())));}catch(e){setProfileError(e instanceof Error?e.message:'Profile unavailable');}}
 };
 const latest=latestUnfinished(library);
 const current=view?.players.find(p=>p.id===playerId);
 const myHand=view?.players.find(p=>p.id===showHand);
 const forcedPanel=requiredPanel(game,humanDecision);
 const activePanel=visiblePanel(game,humanDecision,panel);
 const openPanel=(p:Panel)=>{setPanel(p);setDrawerOpen(true);};
 const tutorLesson=currentLesson(tutorial,setup,game,humanDecision);
 const activateTutorial=()=>{
   if(!tutorial.enabled)setTutorial(t=>setTutorialEnabled(t,true));
   setCoachOpen(v=>tutorial.enabled?!v:true);setCoachFocus(null);
 };
 const skipTutorial=()=>{
   setTutorial(t=>setTutorialEnabled(t,false));setCoachOpen(false);setCoachFocus(null);
   try{localStorage.setItem(TUTORIAL_SEEN_KEY,'1');}catch{}
 };
 const showTutorTarget=()=>{
   if(!tutorLesson)return;
   const target=tutorLesson.target;setCoachFocus(target);
   if(target==='trade'||target==='cards'||target==='info')openPanel(target==='trade'?'trade':target==='cards'?'cards':'info');
   else setDrawerOpen(false);
   requestAnimationFrame(()=>{
     const el=document.querySelector<HTMLElement>('[data-coach-target="'+target+'"]');
     if(el)el.focus({preventScroll:true});
   });
 };
 useEffect(()=>{setCoachFocus(null);},[tutorLesson?.id,tutorLesson?.target]);
 useEffect(()=>{
   if(['settlement','road','begin','roll'].every(id=>tutorial.done.includes(id as typeof tutorial.done[number])))try{localStorage.setItem(TUTORIAL_SEEN_KEY,'1');}catch{}
 },[tutorial.done]);
 useEffect(()=>{if(forcedPanel)setDrawerOpen(true);},[forcedPanel]);
 useEffect(()=>{const sync=()=>setFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync);},[]);
 const toggleFullscreen=()=>{if(document.fullscreenElement){void document.exitFullscreen().catch(()=>{});}else if(document.fullscreenEnabled){void document.documentElement.requestFullscreen().catch(()=>{});}};
 useEffect(()=>{
   const old=previous.current;previous.current={game,setup};
   if(setup)setTutorial(p=>advanceTutorial(p,old.setup,setup,old.game,game,humans));
   if(!game&&!setup||pace==='turbo')setVisualQueue([]);
   else {const next=game?gameVisual(board,old.game,game,humans===1):setupVisual(old.setup,setup);if(next.length)setVisualQueue(q=>[...q,...next]);}
   const event=game?matchEvent(old.game,game,humans):setupEvent(old.setup,setup);
   if(event)setActivity(items=>[event,...items].slice(0,24));
   const cue=game?gameCue(old.game,game,humans):setupCue(old.setup,setup);
   if(!cue||(game&&gameVisual(board,old.game,game,humans===1).length)||(!game&&setupVisual(old.setup,setup).length))return;
   const oldActor=old.game?decisionPlayer(old.game):old.setup?activePlayer(old.setup):null;
   const newActor=game?decisionPlayer(game):setup?activePlayer(setup):null;
   const humanPrompt=newActor!==null&&newActor<humans&&(oldActor!==newActor||cue==='offer'||cue==='robber');
   audio.play(humanPrompt&&cue==='turn'?'turn':cue,!humanPrompt&&cue!=='victory'&&cue!=='defeat'&&oldActor!==null&&oldActor>=humans);
 },[game,setup,humans,board]);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);media.addEventListener('change',change);const visibility=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',visibility);return()=>{media.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{if(!visual||hidden)return;if(pace==='turbo'){setVisualQueue([]);return;}const timer=window.setTimeout(()=>setVisualQueue(q=>q.slice(1)),duration);return()=>window.clearTimeout(timer);},[visual,duration,hidden,pace]);
 const legal=game&&humanActive?legalBuilds(board,game,build):[];
 const validVertices=new Set(game?(build==='road'?[]:legal):setup&&humanDecision?legalSettlements(board,setup):[]);
 const validEdges=new Set(game?(game.phase==='freeRoad'&&humanActive?freeRoadSites(board,game):build==='road'?legal:[]):setup&&humanDecision?legalRoads(board,setup):[]);
 const roadMode=!!(humanDecision&&(!game&&setup?.phase==='road'||game&&(game.phase==='freeRoad'||game.phase==='action'&&build==='road'&&!game.offer)));
 const vertexMode=!!(humanDecision&&(!game&&setup?.phase==='settlement'||game&&game.phase==='action'&&build!=='road'&&!game.offer));
 const selectionLegal=!!selection&&(selection.kind==='vertex'?validVertices.has(selection.id):selection.kind==='edge'?validEdges.has(selection.id):false);
 const confirmBuild=()=>{if(!humanActive||!game||game.phase!=='action'||!selection||!selectionLegal||playerId===null)return;setGame(applyGame(board,game,{kind:'build',playerId,build,id:selection.id}));setSelection(null);};
 const confirmPlacement=()=>{if(!humanDecision||!setup||!selection||!selectionLegal||playerId===null||selection.kind==='tile')return;setSetup(applySetup(board,setup,{kind:selection.kind==='vertex'?'settlement':'road',id:selection.id,playerId}));setSelection(null);};
 useEffect(()=>{
   if(!botBusy||visual||hidden||pauseMenuOpen||paused&&!stepRequested)return;
   let cancelled=false,started=false;
   const client=botClient.current??(botClient.current=new BotClient());
   const timer=window.setTimeout(async()=>{
     started=true;
     try{
       if(game){
         const offers=attempts.current.turn===game.turn?attempts.current.count:0;
         const answer=await client.request({kind:'game',board,state:game,difficulty,offers});
         if(cancelled||answer.kind!=='game'||!answer.action)return;
         const action=answer.action;
         const next=applyGame(board,game,action); // main thread is authoritative
         attempts.current={turn:game.turn,count:offers+Number(action.kind==='offer'||action.kind==='counter')};
         setGame(next);
       }else if(setup){
         const answer=await client.request({kind:'setup',board,state:setup,difficulty});
         if(cancelled||answer.kind!=='setup'||!answer.action)return;
         setSetup(applySetup(board,setup,answer.action));
       }
       if(stepRequested)setStepRequested(false);
       setSelection(null);
     }catch(error){if(!cancelled){setStepRequested(false);setBotError(error instanceof Error?error.message:'Bot action failed');}}
   },botDelay(pace,game,stepRequested));
   return ()=>{cancelled=true;window.clearTimeout(timer);if(started)client.cancel();};
 },[board,game,setup,botBusy,difficulty,pace,paused,pauseMenuOpen,stepRequested,visual,hidden]);
 useEffect(()=>{
   if(!visual||hidden||heard.current===visual)return;
   heard.current=visual;
   const cue:Cue=visual.kind==='income'||visual.kind==='production'?'production':visual.kind==='victory'&&visual.playerId>=humans?'defeat':visual.kind;
   const urgent=visual.kind==='victory'||visual.kind==='income'||(visual.kind==='offer'&&visual.other!==null&&visual.other<humans)||visual.kind==='turn'&&visual.playerId<humans;
   audio.play(cue,!urgent&&visual.playerId>=humans);
   if(audio.settings.haptic&&pace!=='turbo'&&!reduced&&visual.playerId<humans&&['dice','settlement','city','victory','steal'].includes(visual.kind)&&typeof navigator.vibrate==='function'){try{navigator.vibrate(visual.kind==='victory'?[35,60,35]:20);}catch{}}
 },[visual,hidden,humans]);
 useEffect(()=>{
  if(!view)return;
  const handler=(e:globalThis.KeyboardEvent)=>{
     if(handoffPending)return;
    const el=e.target,typing=el instanceof HTMLElement&&(el.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(el.tagName));
    if(e.key==='Escape'){
      e.preventDefault();
      if(soundOpen)setSoundOpen(false);
      else if(guideOpen)setGuideOpen(false);
      else if(pauseMenuOpen)setPauseMenuOpen(false);
      else if(drawerOpen)setDrawerOpen(false);
      else setPauseMenuOpen(true);
      return;
    }
    if(typing||e.ctrlKey||e.metaKey||e.altKey||pauseMenuOpen)return;
    if(game&&humanActive&&game.phase==='action'&&['1','2','3'].includes(e.key)){
      e.preventDefault();setBuild((['road','settlement','city'] as BuildKind[])[Number(e.key)-1]);setSelection(null);setDrawerOpen(false);
    }else if(e.key.toLowerCase()==='i'){e.preventDefault();openPanel('info');}
    else if(e.key.toLowerCase()==='c'&&game&&humanDecision){e.preventDefault();openPanel('cards');}
    else if(e.key.toLowerCase()==='t'&&game&&humanDecision&&game.phase==='action'){e.preventDefault();openPanel('trade');}
  };
  window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
 },[view,game,humanActive,humanDecision,handoffPending,drawerOpen,pauseMenuOpen,guideOpen,soundOpen]);
 const points=useMemo(()=>new Map(board.vertices.map(v=>[v.id,vertexPosition(v,R)])),[board]);
 const bounds=useMemo(()=>{
   const p=[...points.values()],xs=p.map(v=>v.x),ys=p.map(v=>v.y);
   return {x:Math.min(...xs)-65,y:Math.min(...ys)-65,w:Math.max(...xs)-Math.min(...xs)+130,h:Math.max(...ys)-Math.min(...ys)+130};
 },[points]);
 useEffect(()=>{
   if(!follow||reduced||!visual||!duration||hidden)return;
   const target=cameraTarget(bounds,zoom,pan,focusPoints(visual,board,points,R));if(!target)return;
   const from={...pan},initialZoom=zoom,start=performance.now(),ms=Math.min(420,duration*.65);
   const tick=(now:number)=>{const t=Math.min(1,(now-start)/ms),ease=1-(1-t)**3;setPan({x:from.x+(target.pan.x-from.x)*ease,y:from.y+(target.pan.y-from.y)*ease});setZoom(initialZoom+(target.zoom-initialZoom)*ease);if(t<1)cameraFrame.current=requestAnimationFrame(tick);else cameraFrame.current=null;};
   cameraFrame.current=requestAnimationFrame(tick);
   return()=>{if(cameraFrame.current!==null)cancelAnimationFrame(cameraFrame.current);cameraFrame.current=null;};
 },[visual,follow,reduced,duration,hidden,board,points,bounds]);
 const activeTile=selection?.kind==='tile'?board.tiles.find(t=>t.id===selection.id):undefined;
 const activeVertex=selection?.kind==='vertex'?board.vertices.find(t=>t.id===selection.id):undefined;
 const activeEdge=selection?.kind==='edge'?board.edges.find(t=>t.id===selection.id):undefined;
 const startSetup=(guided=false)=>{
   let firstTime=true;try{firstTime=localStorage.getItem(TUTORIAL_SEEN_KEY)!=='1';}catch{}
   const enabled=guided||forceGuided||firstTime;
   createdAt.current=Date.now();setMatchId(crypto.randomUUID());setSavedAt(null);setSelection(null);
   const s=createSetup(board,count,chooseFirstPlayer(count));
   setSetup({...s,players:s.players.map(p=>({...p,name:p.id>=humans?['🤖 Ada','🤖 Bruno','🤖 Cleo','🤖 Darius','🤖 Elara','🤖 Finn'][p.id]:humans===1?(profile?.name??'You'):p.name}))});
   setGame(null);setActivity([]);setPanel('info');setDrawerOpen(false);setPauseMenuOpen(false);setBotError('');setPaused(false);setStepRequested(false);setVisualQueue([]);setRevealedSeat(null);previousDecision.current=null;
   attempts.current={turn:0,count:0};previous.current={game:null,setup:null};
   setTutorial(newTutorial(enabled));setCoachOpen(enabled);setCoachFocus(null);setForceGuided(false);
 };
 const setBoard=(s:BoardSize,seed:string)=>{setSize(s);setGame(null);setSetup(null);setBotError('');setActivity([]);setVisualQueue([]);setPaused(false);setStepRequested(false);attempts.current={turn:0,count:0};setSeed(seed);setDraft(seed);setSelection(null);setPan({x:0,y:0});setZoom(1);setRevealedSeat(null);previousDecision.current=null;};
 const select=(kind:Selection['kind'],id:string)=>setSelection({kind,id});
 const keySelect=(event:KeyboardEvent,kind:Selection['kind'],id:string)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(kind,id);}};
 function start(e:PointerEvent<SVGSVGElement>){
   if(e.button!==0)return;
   if(cameraFrame.current!==null){cancelAnimationFrame(cameraFrame.current);cameraFrame.current=null;}
   drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y,moved:false};
 }
 function move(e:PointerEvent<SVGSVGElement>){
   const d=drag.current;if(!d||d.id!==e.pointerId||!svg.current)return;
   const dx=e.clientX-d.x,dy=e.clientY-d.y;
   if(!d.moved&&Math.hypot(dx,dy)<6)return;
   if(!d.moved){d.moved=true;svg.current.setPointerCapture(e.pointerId);}
   const rect=svg.current.getBoundingClientRect();
   const scale=Math.max(bounds.w/(rect.width*zoom),bounds.h/(rect.height*zoom));
   setPan({x:d.panX-dx*scale,y:d.panY-dy*scale});
 }
 function end(e:PointerEvent<SVGSVGElement>){
   if(drag.current?.id!==e.pointerId)return;
   if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId);
   drag.current=null;
 }
 const viewW=bounds.w/zoom,viewH=bounds.h/zoom;
 return <main className={view?"in-match":menu==="home"?"front-menu":""} data-coach-focus={coachOpen?coachFocus??undefined:undefined} data-dice={loadout.dice} data-card-back={loadout.cardBack} data-board-theme={loadout.board}>
  <header><div><p className="eyebrow">ORVANE / FIELD NOTES</p><h1>Founders of Orvane</h1><p className="subtitle">Build. Trade. Explore. Prosper.</p></div><div className="header-actions"><span className="version">v0.9.7</span>{view&&<>{document.fullscreenEnabled&&<button aria-label="Toggle fullscreen" aria-pressed={fullscreen} title="Fullscreen" onClick={toggleFullscreen}>⛶</button>}<button aria-label="Pause menu" aria-expanded={pauseMenuOpen} onClick={()=>setPauseMenuOpen(true)}>☰</button></>}<button aria-label={audio.settings.enabled?"Mute sound":"Enable sound"} aria-pressed={audio.settings.enabled} onClick={audio.toggle}>{audio.settings.enabled?"🔊":"🔇"}</button>{view&&<button aria-label="Guided tutorial" aria-expanded={coachOpen} aria-pressed={tutorial.enabled&&coachOpen} onClick={activateTutorial}>🧭</button>}{view&&<button aria-expanded={guideOpen} aria-label="Game guide" onClick={()=>setGuideOpen(v=>!v)}>📖</button>}<button aria-expanded={soundOpen} onClick={()=>setSoundOpen(v=>!v)}>⚙️</button></div></header>
  {soundOpen&&<section className="setup-bar sound-settings"><label>🔊 Effects volume <input aria-label="Effects volume" type="range" min={0} max={100} value={Math.round(audio.settings.volume*100)} onChange={e=>audio.setVolume(Number(e.target.value)/100)}/></label><label><input type="checkbox" checked={audio.settings.bots} onChange={audio.toggleBots}/> Bot sounds</label><label><input type="checkbox" checked={audio.settings.music} onChange={audio.toggleMusic}/> 🎵 Ambient music</label><label>Music volume <input aria-label="Music volume" type="range" min={0} max={100} value={Math.round(audio.settings.musicVolume*100)} onChange={e=>audio.setMusicVolume(Number(e.target.value)/100)}/></label>{typeof navigator.vibrate==='function'&&<label><input type="checkbox" checked={audio.settings.haptic} onChange={audio.toggleHaptic}/> Haptics</label>}<button onClick={()=>{void audio.unlock().then(()=>audio.play('trade'));}}>Test sound</button><span className="muted">{audio.ready?'Audio ready':'Tap to activate audio'}</span></section>}
  {storageError&&<p className="storage-warning" role="alert">⚠️ {storageError} · Progress may not be saved.</p>}
  {profileError&&<p className="storage-warning" role="alert">⚠️ {profileError}</p>}
  {!view&&menu==='home'&&<HomeMenu onProfile={()=>setMenu('profile')} profileLabel={profile&&progress?avatarIcon(profile.avatar,progress.level)+' '+profile.name+' · Lv. '+progress.level+' · '+cosmetic(loadout.title).name:undefined} onContinue={latest?()=>resume(latest):undefined} onSaves={()=>setMenu('saves')} onPlay={()=>setMenu('setup')} onGuide={()=>setMenu('guide')} onSettings={()=>setSoundOpen(v=>!v)} onExpansions={()=>setMenu('expansions')}/>}
  {!view&&menu==='profile'&&(profile?<ProfileScreen key={profile.id} profile={profile} results={library.results} onSave={updateProfile} onBack={()=>setMenu('home')}/>:<section className="panel"><button onClick={()=>setMenu('home')}>← Main menu</button><p>Local profile unavailable. You can still play.</p></section>)}
  {!view&&menu==='saves'&&<SavedGames onRestore={restoreLocal} library={library} onResume={resume} onDelete={deleteSave} onBack={()=>setMenu('home')}/>}
  {!view&&menu==='home'&&<section className="setup-bar install-bar"><div><strong>{pwa.installed?'📱 Installed':pwa.offline?'🛜 Offline':pwa.ready?'✓ Offline ready':'📱 Play anywhere'}</strong><p className="muted">{pwa.error?'Offline setup failed. Reload when connected.':pwa.installed?'Open Orvane from your home screen.':pwa.canInstall?'Install for quick access.':'On iPhone: Safari → Share → Add to Home Screen.'}</p></div>{pwa.canInstall&&!pwa.installed&&<button onClick={()=>{void pwa.install().catch(()=>{});}}>Install</button>}</section>}
  {!view&&menu==='guide'&&<section className="panel"><button onClick={()=>setMenu('home')}>← Main menu</button><h2>📖 How to play</h2><Guide/><button onClick={()=>{setForceGuided(true);setMenu("setup");}}>🧭 Practice in a guided game</button></section>}
  {!view&&menu==='expansions'&&<><button onClick={()=>setMenu('home')}>← Main menu</button><ExpansionRoadmap/></>}
  {view&&guideOpen&&<section className="panel match-guide" role="dialog" aria-label="How to play"><div className="overlay-heading"><h2>📖 How to play</h2><button aria-label="Close guide" onClick={()=>setGuideOpen(false)}>✕</button></div><Guide phase={game?.phase??setup?.phase}/></section>}
  {(view||menu==='setup')&&<>
  {!setup&&<div className="setup-heading"><button onClick={()=>setMenu('home')}>← Main menu</button><h2>⚔️ New game</h2></div>}
  {!setup&&<section className="toolbar" aria-label="Board settings">
    <div className="sizes">{([3,4,5,6] as PlayerCount[]).map(n=><button key={n} disabled={!!setup} aria-pressed={count===n} onClick={()=>{setCount(n);setHumans(h=>Math.min(h,n));setBoard(n<=4?'standard':'extended',seed);}}>{n} players</button>)}</div>
    <form onSubmit={e=>{e.preventDefault();if(draft.trim())setBoard(size,draft.trim());}}><label htmlFor="seed">Map seed</label><input disabled={!!setup} id="seed" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={80} required/><button disabled={!!setup} type="submit">Generate</button><button disabled={!!setup} type="button" onClick={()=>setBoard(size,crypto.randomUUID().slice(0,12))}>Random</button></form>
  </section>}
  {!setup&&<section className="setup-bar lobby"><div><strong>🤖 Local match</strong><p className="muted">{humans} human · {count-humans} bots</p></div><div className="sizes"><label>Humans <select disabled={!!setup} value={humans} onChange={e=>setHumans(Number(e.target.value))}>{Array.from({length:count},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label><label>AI <select disabled={!!setup} value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}>{(['easy','normal','hard','expert'] as Difficulty[]).map(d=><option key={d}>{d}</option>)}</select></label><label className="pace-control">Pace <select aria-label="Bot pace" value={pace} onChange={e=>setPace(e.target.value as Pace)}>{(Object.keys(PACES) as Pace[]).map(p=><option key={p} value={p}>{PACES[p].label}</option>)}</select></label></div></section>}
  {view&&<p className="save-status" role="status">{storageError?'⚠️ Not saved':savedAt?'💾 Saved locally':'Saving…'}{pwa.offline?' · Offline':''}</p>}
  {botError&&<section className="setup-bar" role="alert"><span>Bot stopped: {botError}</span><button onClick={()=>setBotError('')}>Retry</button><button onClick={leave}>Main menu</button></section>}
  <section className="setup-bar turn-bar" aria-live="polite" id="turn-actions" aria-label="Turn command bar">
    {game?<><div className="turn-ident"><span className="turn-emblem">{game.phase==="roll"?"🎲":game.phase==="action"?"⚔️":game.phase==="finished"?"🏆":"❗"}</span><div><small>ROUND {game.round}{game.paired?" · PAIRED ACTION":""}</small><strong>{current?.name}</strong><p className="muted">{game.phase==='finished'?'🏆 Game finished':game.phase==='roll'?'Roll the dice or play a card':game.phase==='discard'?'🥷 Discard required':game.phase==='robber'?'🥷 Move the robber':game.phase==='freeRoad'?'🛤️ Place free roads':(game.dice?game.dice.join(' + ')+' = '+game.dice.reduce((a,b)=>a+b,0)+' · ':'')+'Build, trade or end turn'}</p></div></div><div className="sizes"><button data-coach-target="roll" disabled={!humanActive||game.phase!=='roll'} onClick={()=>{setGame(applyGame(board,game,{kind:'roll',playerId:game.active,dice:rollDice()}));setSelection(null);}} className="turn-primary">🎲 Roll dice</button><button disabled={!humanActive||game.phase!=='action'||!!game.offer} onClick={()=>{setGame(applyGame(board,game,{kind:'end',playerId:game.active}));setSelection(null);}} className="turn-primary">⏭ End turn</button><button onClick={leave}>Save & exit</button></div></>:setup?<><div><strong>{setup.phase==='complete'?'Initial placement complete':current?.name+' · '+(setup.phase==='settlement'?'Place a settlement':'Place its road')}</strong><p className="muted">{setup.phase==='complete'?'All players have two settlements and two roads. Begin the first turn.':'Round '+(setup.step<count?1:2)+' of 2 · Placement '+(setup.step+1)+' / '+setup.order.length}</p></div><div className="sizes">{setup.phase==='complete'?<button data-coach-target="launch" disabled={!!visual} onClick={()=>{setGame(startGame(board,setup));setSelection(null);}}>Begin game</button>:<button disabled={!selectionLegal} onClick={confirmPlacement}>Confirm placement</button>}<button onClick={leave}>Save & exit</button></div></>:<><div><strong>Local setup</strong><p className="muted">Choose human seats and AI difficulty, then place settlements and roads.</p></div><button onClick={()=>startSetup()}>Start setup</button><button onClick={()=>startSetup(true)}>🧭 Guided setup</button></>}
  </section>
  {game&&humanDecision&&(game.offer||game.phase==='discard'||game.phase==='robber'||game.phase==='freeRoad')&&<section className="setup-bar action-prompt" role="status"><strong>{game.offer?'🤝 Trade offer for '+view?.players.find(p=>p.id===decision)?.name:game.phase==='discard'?'🥷 '+view?.players.find(p=>p.id===decision)?.name+': discard resources':game.phase==='robber'?'🥷 Choose a hex and move the robber':'🛤️ Choose a free road'}</strong><button onClick={()=>openPanel(game.offer?'trade':'cards')}>Open action ↓</button></section>}
  {view&&game?.phase!=='finished'&&<section className="setup-bar pace-bar"><div><strong>{botBusy?(paused?'⏸ Bots paused':'🤖 '+view.players.find(p=>p.id===decision)?.name?.replace('🤖 ','')+' is playing'):'⏱ Match pace'}</strong><p className="muted">{paused?'Use Next action to watch one move at a time.':'Watch each action or speed up whenever you want.'}</p></div><div className="sizes"><label className="pace-control">Pace <select aria-label="Bot pace" value={pace} onChange={e=>setPace(e.target.value as Pace)}>{(Object.keys(PACES) as Pace[]).map(p=><option key={p} value={p}>{PACES[p].label}</option>)}</select></label><button aria-pressed={paused} onClick={()=>{setPaused(v=>!v);setStepRequested(false);}}>{paused?'▶ Resume bots':'⏸ Pause bots'}</button>{visual&&<button onClick={()=>setVisualQueue(q=>q.slice(1))}>Skip animation →</button>}{paused&&<button disabled={!botBusy||stepRequested||!!visual} onClick={()=>setStepRequested(true)}>Next action →</button>}</div></section>}
  {game?.winner!==null&&game?.winner!==undefined&&!visual&&<section className="winner-banner" role="status"><h2>🏆 {game.players.find(p=>p.id===game.winner)?.name} wins!</h2><p>{playerScore(game,game.winner,true).total} victory points · {game.round} rounds{humans===1&&matchId&&library.results.some(r=>r.id===matchId)?' · +'+matchXP(library.results.find(r=>r.id===matchId)! )+' match XP':''}</p>{profile&&matchId&&humans===1&&<MatchRewards results={library.results} profileId={profile.id} matchId={matchId}/>}<button onClick={()=>{if(leave())setMenu('setup');}}>New game</button></section>}
  {view&&<PlayerStrip seed={seed} view={view} game={game} active={visual?.playerId??playerId} humans={humans} showHand={showHand} soloAvatar={profile&&progress?avatarIcon(profile.avatar,progress.level):undefined} soloTitle={cosmetic(loadout.title).name}/> }
  <div className={"layout immersive-layout"+(drawerOpen?" drawer-active":"")}>
   <section className="board-panel" id="board" data-coach-target="board" tabIndex={-1} aria-label="Interactive island map">
    <div className="map-top"><span>✧ ORVANE / {board.tiles.length} HEXES</span><div>{view&&<button aria-label="Open journal" aria-expanded={drawerOpen&&activePanel==="info"} onClick={()=>drawerOpen&&activePanel==="info"?setDrawerOpen(false):openPanel("info")}>📜 <span className="toolbar-label">Journal</span></button>}<button aria-label="Follow board events" aria-pressed={follow} onClick={()=>setFollow(f=>!f)}>🎥</button><button aria-label="Zoom out" disabled={zoom<=.75} onClick={()=>setZoom(z=>Math.max(.75,z-.25))}>−</button><button aria-label="Reset view" onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>Fit</button><button aria-label="Zoom in" disabled={zoom>=2.5} onClick={()=>setZoom(z=>Math.min(2.5,z+.25))}>+</button></div></div>
    {view&&coachOpen&&tutorial.enabled&&<TutorialCoach progress={tutorial} lesson={tutorLesson} tip={coachFocus===tutorLesson?.target&&tutorLesson?tutorialTip(tutorLesson):"Try the highlighted action. Your real moves advance the lesson."} onShow={showTutorTarget} onHide={()=>{setCoachOpen(false);setCoachFocus(null);}} onSkip={skipTutorial}/>}
     {view&&<div className="board-event-slot">{view&&visual&&duration>0&&<EventStage key={visualQueue.length+':'+visual.kind+':'+(game?.turn??setup?.step)} event={visual} effectId={loadout.effects} celebrate={visual.playerId<humans&&!reduced} name={view.players.find(p=>p.id===visual.playerId)?.name??'Player'} other={'other' in visual&&visual.other!==null?view.players.find(p=>p.id===visual.other)?.name??'Player':'🏦 Bank'} duration={duration} color={view.players.find(p=>p.id===visual.playerId)?.color??'#ffe39b'}/>}{(!visual||duration===0)&&<div className="event-idle"><span>{humanDecision?'👤':'🎲'}</span><strong>{view.players.find(p=>p.id===(decision??playerId))?.name??'Match'} </strong><span className="muted">{humanDecision?'Your action':paused?'Paused':'Watching the board'}</span></div>}</div>}
    {game&&humanActive&&game.phase==='action'&&<BuildMenu board={board} game={game} build={build} onSelect={k=>{setBuild(k);setSelection(null);}}/>}
    <svg ref={svg} viewBox={[bounds.x+(bounds.w-viewW)/2+pan.x,bounds.y+(bounds.h-viewH)/2+pan.y,viewW,viewH].join(' ')} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{drag.current=null;}} aria-label="Hexagonal island; drag to pan" className={roadMode?"road-mode":vertexMode?"vertex-mode":""}>
      <defs><pattern id="waves" width="36" height="28" patternUnits="userSpaceOnUse"><path d="M0 14 Q9 7 18 14 T36 14" fill="none" stroke="#9ec1c2" opacity=".12"/></pattern></defs>
      <rect x={-10000} y={-10000} width={20000} height={20000} fill="url(#waves)"/>
      {board.tiles.map(t=>{const p=tilePosition(t,R),meta=terrain[t.terrain];return <g key={t.id} role="button" tabIndex={0} aria-label={meta.name+' '+(t.number??'desert')} aria-pressed={activeTile?.id===t.id} onClick={()=>select('tile',t.id)} onKeyDown={e=>keySelect(e,'tile',t.id)} className="tile">
        <polygon points={t.vertices.map(id=>{const v=points.get(id)!;return v.x+','+v.y;}).join(' ')} fill={meta.color} stroke={activeTile?.id===t.id?'#fff4c9':'#183a3e'} strokeWidth={activeTile?.id===t.id?4:2}/>
        <text x={p.x} y={p.y-14} className="terrain-symbol">{meta.icon}</text>
        {t.number!==null&&<><circle cx={p.x} cy={p.y+11} r={17} fill="#f3e5c8" stroke="#806e56"/><text x={p.x} y={p.y+12} className={'token '+(t.number===6||t.number===8?'red':'')}>{t.number}</text><text x={p.x} y={p.y+37} className="pips">{'•'.repeat(6-Math.abs(7-t.number))}</text></>}
        {game?.development.robber===t.id&&!(visual?.kind==='robber'&&duration>0&&!reduced)&&<RobberArt p={{x:p.x+24,y:p.y-5}} styleId={loadout.robber}/>}
      </g>;})}
      {board.harbors.map(h=>{const e=board.edges.find(e=>e.id===h.edgeId)!,a=points.get(e.a)!,b=points.get(e.b)!,t=board.tiles.find(t=>t.id===e.tiles[0])!,center=tilePosition(t,R),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=mx-center.x,dy=my-center.y,len=Math.hypot(dx,dy),x=mx+dx/len*28,y=my+dy/len*28;return <g key={h.edgeId} aria-label={(h.resource?terrain[h.resource].resource:'Generic')+' harbor '+h.rate+':1'} pointerEvents="none"><line x1={a.x} y1={a.y} x2={x} y2={y} stroke="#b8a57e" strokeWidth="2"/><line x1={b.x} y1={b.y} x2={x} y2={y} stroke="#b8a57e" strokeWidth="2"/><rect x={x-20} y={y-12} width={40} height={24} rx={7} fill="#e8d5aa" stroke="#806e56"/><text x={x} y={y+4} textAnchor="middle" fontSize={10} fill="#183a3e" fontWeight="bold">{h.resource?resourceEmoji[h.resource]:'⚓'} {h.rate}:1</text></g>;})}
      {board.edges.map(e=>{const a=points.get(e.a)!,b=points.get(e.b)!;const owner=view?.roads.find(x=>x.edgeId===e.id);const revealing=visualQueue.some(v=>(v.kind==='road'||v.kind==='spend'&&v.build==='road')&&v.id===e.id)&&duration>0&&!reduced;const color=revealing?undefined:view?.players.find(p=>p.id===owner?.playerId)?.color;return <g key={e.id} role="button" tabIndex={0} aria-label={'Road edge '+e.id} aria-pressed={activeEdge?.id===e.id} onClick={()=>select('edge',e.id)} onKeyDown={ev=>keySelect(ev,'edge',e.id)} className={"edge"+(validEdges.has(e.id)?" legal-site":"")}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={22}/>{color?<RoadArt a={a} b={b} color={color} styleId={humans===1&&owner?.playerId===0?loadout.road:DEFAULT_LOADOUT.road}/>:<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={activeEdge?.id===e.id?'#ffffff':color??(validEdges.has(e.id)?'#ffe39b':'#e4d7af')} opacity={color||activeEdge?.id===e.id||validEdges.has(e.id)?1:.55} strokeWidth={activeEdge?.id===e.id||validEdges.has(e.id)?5:1.5}/>}</g>;})}
      {board.vertices.map(v=>{const p=points.get(v.id)!;const owner=view?.settlements.find(x=>x.vertexId===v.id);const revealing=visualQueue.some(e=>(e.kind==='settlement'||e.kind==='spend'&&e.build==='settlement')&&e.id===v.id)&&duration>0&&!reduced;const color=revealing?undefined:view?.players.find(x=>x.id===owner?.playerId)?.color;const city=game?.settlements.some(s=>s.vertexId===v.id&&s.kind==='city')&&!(visualQueue.some(e=>(e.kind==='city'||e.kind==='spend'&&e.build==='city')&&e.id===v.id)&&duration>0&&!reduced);return <g key={v.id} role="button" tabIndex={0} aria-label={'Building vertex '+v.id} aria-pressed={activeVertex?.id===v.id} onClick={()=>select('vertex',v.id)} onKeyDown={e=>keySelect(e,'vertex',v.id)} className={"vertex"+(validVertices.has(v.id)?" legal-site":"")}><circle cx={p.x} cy={p.y} r={15} fill="transparent"/>{validVertices.has(v.id)&&<circle cx={p.x} cy={p.y} r={12} fill="none" stroke={activeVertex?.id===v.id?"#ffffff":"#ffe39b"} strokeWidth={2.5} pointerEvents="none"/>}{color?<BuildingArt p={p} city={!!city} color={color} styleId={humans===1&&owner?.playerId===0?(city?loadout.city:loadout.settlement):(city?DEFAULT_LOADOUT.city:DEFAULT_LOADOUT.settlement)}/>:<circle cx={p.x} cy={p.y} r={activeVertex?.id===v.id?8:validVertices.has(v.id)?6:3.5} fill={activeVertex?.id===v.id||validVertices.has(v.id)?'#ffe39b':'#e4d7af'} stroke="#24434a" strokeWidth={1}/>}</g>;})}
      {visual&&duration>0&&!reduced&&<BoardEffects key={visualQueue.length+":"+visual.kind+":"+(game?.turn??setup?.step)} event={visual} loadout={humans===1&&visual.playerId===0?loadout:{...DEFAULT_LOADOUT,robber:loadout.robber}} board={board} points={points} r={R} duration={duration} color={view?.players.find(p=>p.id===visual.playerId)?.color??"#ffe39b"}/>}
    </svg>
    {game?.dice&&<div className="dice-display" aria-label={'Dice total '+(game.dice[0]+game.dice[1])}><span>🎲</span>{game.dice.map((n,i)=><span className="die" key={i} aria-label={'Die '+n}>{['⚀','⚁','⚂','⚃','⚄','⚅'][n-1]}</span>)}<strong>{game.dice[0]+game.dice[1]}</strong><span className="muted">{game.paired?'Paired action':'Last roll'}</span></div>}
    <p className="map-help">{setup&&!game&&humanDecision&&setup.phase!=='complete'?(setup.phase==='settlement'?'🏠 Tap a highlighted junction':'🛤️ Tap a highlighted road'):game&&humanActive&&game.phase==='action'?(legal.length?'Tap a highlighted site to build':'Not enough resources or no legal sites for '+build):'Drag to pan · + / − to zoom · select a feature'}</p>
    {setup&&!game&&humanDecision&&setup.phase!=='complete'&&<div className="map-confirm"><button disabled={!selectionLegal} onClick={confirmPlacement}>{selectionLegal?'✓ Confirm '+setup.phase:'Select a highlighted '+(setup.phase==='road'?'road':'junction')}</button></div>}
    {game&&humanActive&&game.phase==='action'&&<div className="map-confirm"><button disabled={!selectionLegal} onClick={confirmBuild}>{selectionLegal?'✓ Build '+build:legal.length?'Select a highlighted site':'No legal sites / check resources'}</button></div>}
    {view&&myHand&&<ResourceHand resources={myHand.resources} queue={visualQueue} solo={humans===1} desktop/>}
   </section>
   <aside id="action-panel" className="game-sidebar" aria-label="Game actions">
    {view&&<div className="drawer-heading"><strong>{activePanel==="info"?"📜 Field Journal":activePanel==="cards"?"🃏 Your Cards":"⚓ Trading Post"}</strong><button aria-label="Close game panel" onClick={()=>setDrawerOpen(false)}>✕</button></div>}{view&&<div className="panel-nav" aria-label="Match panels">{(['info','cards','trade'] as Panel[]).map(p=><button key={p} aria-pressed={activePanel===p} disabled={!!forcedPanel&&forcedPanel!==p||p==='cards'&&(!game||!humanDecision||!!game.offer||game.phase==='finished')||p==='trade'&&(!game||!humanDecision||game.phase!=='action')} onClick={()=>openPanel(p)} data-coach-target={p}>{p==='info'?'🗺️ Info':p==='cards'?'🃏 Cards':'⚓ Trade'}</button>)}</div>}
    {activePanel==='cards'&&game&&humanDecision&&!game.offer&&<DevelopmentPanel key={game.active+":"+game.turn} board={board} game={game} humanActive={humanActive} selectedTile={activeTile?.id} onSelectTile={id=>select('tile',id)} selectedEdge={activeEdge?.id} onChange={s=>{setGame(s);setSelection(null);}}/>}
    {activePanel==='trade'&&game&&humanDecision&&(game.phase==='action')&&<TradePanel key={game.active+":"+game.turn} board={board} game={game} humanActive={humanActive} onChange={s=>{setGame(s);setSelection(null);}}/>}
    {(!view||activePanel==='info'||!humanDecision)&&<div className="info-stack">{view&&activity.length>0&&<section className="match-feed" aria-label="Recent match events"><strong>📜 What happened</strong><p className="latest-event" aria-live="polite">{activity[0]}</p>{activity.slice(1,3).map((a,i)=><p className="muted" key={i}>{a}</p>)}</section>}{game&&game.dice&&<details className="panel production-details"><summary>🌾 Production this roll</summary><section className="setup-bar"><div><strong>Production this roll</strong><p className="muted">{game.players.map((p,i)=>p.name+': +'+Object.values(game.lastProduction[i]).reduce((a,b)=>a+b,0)).join(' · ')}{game.shortages.length?' · Bank shortage: '+game.shortages.map(k=>terrain[k].resource).join(', '):''}</p></div></section></details>}{game&&<section className="panel"><h2>Resource bank</h2><dl>{RESOURCES.map(k=><div className="bank-row" key={k}><dt>{resourceEmoji[k]} {terrain[k].resource}</dt><dd>{game.bank[k]}</dd></div>)}</dl></section>}<section className="panel cartographer"><h2>Cartographer</h2><p className="muted">Seed: {seed}</p><dl><dt>Hexes</dt><dd>{board.tiles.length}</dd><dt>Building sites</dt><dd>{board.vertices.length}</dd><dt>Road segments</dt><dd>{board.edges.length}</dd></dl></section>
   <section className="panel inspector" aria-live="polite"><h2>Selection</h2>{activeTile?<><strong>{terrain[activeTile.terrain].name}</strong><p>Resource: {terrain[activeTile.terrain].resource}</p><p>Production token: {activeTile.number??'None'}</p></>:activeVertex?<><strong>Building junction</strong><p>{activeVertex.id} · {activeVertex.tiles.length} adjacent hexes</p></>:activeEdge?<><strong>Road segment</strong><p>{activeEdge.tiles.length} adjacent hexes · {activeEdge.tiles.length===1?'Coast':'Inland'}</p></>:<p className="muted">Select a map feature to inspect it. Start local setup to place buildings and roads.</p>}</section>
   <section className="panel terrain-legend"><h2>Terrain</h2>{(Object.keys(terrain) as Terrain[]).map(t=><div key={t} className="legend"><span style={{background:terrain[t].color}} className="swatch"/><span>{terrain[t].name}</span><span>{board.tiles.filter(x=>x.terrain===t).length}</span></div>)}</section>{activity.length>0&&<details className="panel activity"><summary>📜 Activity</summary>{activity.slice(0,24).map((a,i)=><p key={i}>{a}</p>)}</details>}</div>}
   </aside>
  </div>
  {view&&<nav className="match-dock" aria-label="Match controls">{myHand?<ResourceHand resources={myHand.resources} queue={visualQueue} solo={humans===1}/>:<div className="hand-strip">{handoffPending?"🔒 Hand hidden · pass device":"🤖 Opponent turn"}</div>}<div className="dock-actions"><button onClick={()=>setDrawerOpen(false)}>🗺️ Map</button>{game&&humanActive&&game.phase==="action"&&<button onClick={()=>setDrawerOpen(false)}>🏗️ Build</button>}{game&&humanDecision&&game.phase==="action"&&<button onClick={()=>openPanel('trade')}>⚓ Trade</button>}{game&&humanDecision&&!game.offer&&<button onClick={()=>openPanel('cards')}>🃏 Cards</button>}{!game&&setup?.phase==="complete"&&humanDecision?<button data-coach-target="launch" disabled={!!visual} onClick={()=>{setGame(startGame(board,setup));setSelection(null);}}>▶ Begin game</button>:!game&&humanDecision&&setup?.phase!=="complete"?<button disabled={!selectionLegal} onClick={confirmPlacement}>✓ Place</button>:game&&humanActive&&game.phase==="roll"?<button onClick={()=>{setGame(applyGame(board,game,{kind:"roll",playerId:game.active,dice:rollDice()}));setSelection(null);}}>🎲 Roll</button>:game&&humanActive&&game.phase==="action"?<button onClick={()=>{setGame(applyGame(board,game,{kind:"end",playerId:game.active}));setSelection(null);}}>⏭ End</button>:<button onClick={()=>setPauseMenuOpen(true)}>☰ Menu</button>}</div></nav>}
  {handoffPending&&view&&decision!==null&&<div className="handoff-curtain" role="presentation"><section className="handoff-window" role="dialog" aria-modal="true" aria-label="Pass the device"><span className="handoff-sigil" aria-hidden="true">♜</span><p className="eyebrow">PRIVATE PLAYER TURN</p><h2>Pass the device</h2><p>Hand the screen to <strong>{view.players.find(p=>p.id===decision)?.name??'the next player'}</strong>.</p><p className="muted">Your cards and private actions remain hidden until you are ready.</p><button className="primary-action" autoFocus onClick={()=>{setRevealedSeat(decision);setSelection(null);setDrawerOpen(false);}}>✓ I'm ready</button></section></div>}
   {view&&pauseMenuOpen&&<div className="pause-curtain" onClick={()=>setPauseMenuOpen(false)}><section className="pause-window" role="dialog" aria-modal="true" aria-label="Pause menu" onClick={e=>e.stopPropagation()}><span className="pause-sigil">♜</span><p className="eyebrow">FOUNDERS OF ORVANE</p><h2>Game menu</h2><p className="muted">Bots pause while this menu is open.</p><div className="pause-commands"><button className="primary-action" onClick={()=>setPauseMenuOpen(false)}>▶ Resume game</button><button onClick={()=>{setPauseMenuOpen(false);setGuideOpen(true);}}>📖 How to play</button><button onClick={()=>{setPauseMenuOpen(false);setSoundOpen(true);}}>⚙️ Audio settings</button><button onClick={()=>{if(leave())setPauseMenuOpen(false);}}>💾 Save & exit to menu</button></div><small>ESC · Menu　　1 / 2 / 3 · Build　　I · Journal　　T · Trade　　C · Cards</small></section></div>}
   {visual?.kind==='income'&&duration>0&&!reduced&&<IncomeFlights event={visual} svg={svg} points={points} duration={duration}/>}
  </>}
  {!view&&<footer>Local base game · Autosave · Offline play · Online optional.</footer>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
