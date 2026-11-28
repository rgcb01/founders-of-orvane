import {StrictMode,useMemo,useRef,useState,useEffect,useLayoutEffect,type KeyboardEvent,type PointerEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {generateBoard,tilePosition,vertexPosition,type BoardSize,type Terrain,createSetup,activePlayer,legalSettlements,legalRoads,applySetup,type PlayerCount,type SetupState,startGame,applyGame,legalBuilds,rollDice,RESOURCES,type GameState,type BuildKind,freeRoadSites,playerScore,chooseFirstPlayer,decisionPlayer,type Difficulty} from '@orvane/engine';
import './style.css';
import './tabletop.css';
import './front-screen.css';

import {BoardScene3D,GraphicsQualitySelect,readGraphicsQuality,persistGraphicsQuality,type GraphicsQuality,type BoardCameraControls} from './BoardScene3D';
import {DevelopmentPanel} from './DevelopmentPanel';
import {TradePanel} from './TradePanel';
import {resourceEmoji} from './resources';
import {BuildingArt,RoadArt,RobberArt,HarborArt} from './PieceArt';
import {TerrainArt,TERRAIN_COLORS} from './TerrainArt';
import {useGameAudio} from './audio';
import {gameCue,setupCue} from './soundEvents';
import {botDelay,matchEvent,setupEvent,PACES,type Pace} from './matchUX';
import {gameVisual,setupVisual,visualDuration,type VisualEvent} from './visualEvents';
import {BoardEffects,EventStage} from './VisualEffects';
import {cameraTarget,focusPoints} from './camera';
import {clampZoom,worldAt,panAroundWorld,dragPan,mid,distance,nearestVertex,nearestEdge,type Point} from './touchCamera';
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
import {HomeMenu,Guide,ExpansionRoadmap,PlayerStrip,ResourceHand,ConstructionTray,BuildMenu,requiredPanel,visiblePanel,type Panel} from './GameUI';

const terrain:Record<Terrain,{name:string;icon:string;color:string;resource:string}>={
 forest:{name:'Forest',icon:'🌲',color:TERRAIN_COLORS.forest,resource:'Lumber'},
 pasture:{name:'Pasture',icon:'🐑',color:TERRAIN_COLORS.pasture,resource:'Wool'},
 field:{name:'Field',icon:'🌾',color:TERRAIN_COLORS.field,resource:'Grain'},
 hill:{name:'Hills',icon:'🧱',color:TERRAIN_COLORS.hill,resource:'Brick'},
 mountain:{name:'Mountain',icon:'⛰️',color:TERRAIN_COLORS.mountain,resource:'Ore'},
 desert:{name:'Desert',icon:'🏜️',color:TERRAIN_COLORS.desert,resource:'None'}
};
type Selection={kind:'tile'|'vertex'|'edge';id:string};
const R=49;
const CONTROL_PATHS={"journal":"M5 3h12l2 2v16H7V3 M5 3v18 M10 8h6 M10 12h6","follow":"M3 7h12v10H3z M15 10l6-4v12l-6-4","minus":"M5 12h14","plus":"M5 12h14 M12 5v14","fit":"M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5","map":"M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16","build":"M4 20l12-12 M12 4l4-2 6 6-4 4z","trade":"M3 7h17l-4-4 M20 7l-4 4 M21 17H4l4-4 M4 17l4 4","cards":"M4 5l12-2 3 16-12 2z M8 6h12v15H8","roll":"M4 4h16v16H4z M8 8h.1 M16 8h.1 M12 12h.1 M8 16h.1 M16 16h.1","end":"M4 12h15 M13 6l6 6-6 6","menu":"M4 6h16 M4 12h16 M4 18h16","play":"M7 4l14 8-14 8z","check":"M4 12l5 5L20 6"};
function Die3D({value,rolling,index}:{value:number;rolling:boolean;index:number}){
 const faces=[value,...[1,2,3,4,5,6].filter(n=>n!==value)];
 const transforms=['translateZ(15px)','rotateY(90deg) translateZ(15px)','rotateY(180deg) translateZ(15px)','rotateY(-90deg) translateZ(15px)','rotateX(90deg) translateZ(15px)','rotateX(-90deg) translateZ(15px)'];
 return <span aria-label={'Die '+value} role="img" style={{display:'inline-block',width:36,height:36,perspective:160,flexShrink:0}}><span className={rolling?'orvane-die-roll':''} style={{display:'block',position:'relative',width:30,height:30,margin:3,transformStyle:'preserve-3d',transform:'rotateX(-18deg) rotateY(22deg)',animationDelay:rolling?index*45+'ms':undefined}}>{faces.map((n,i)=><span key={i} aria-hidden="true" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'#f5e8cf',color:'#26343a',border:'1px solid #b9a98d',borderRadius:4,fontSize:26,lineHeight:1,backfaceVisibility:'hidden',transform:transforms[i]}}>{['⚀','⚁','⚂','⚃','⚄','⚅'][n-1]}</span>)}</span></span>;
}
function ControlIcon({name}:{name:keyof typeof CONTROL_PATHS}){return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,pointerEvents:'none'}}><path d={CONTROL_PATHS[name]}/></svg>}
function Preview3D(){const board=useMemo(()=>generateBoard('orvane-3d-preview','standard'),[]);const [failed,setFailed]=useState(false);return <main style={{height:'100dvh',display:'flex',flexDirection:'column'}}><header><h1>Orvane · Experimental 3D</h1><a href={window.location.pathname}>Return to game</a></header>{failed?<p>WebGL unavailable. Return to the SVG game.</p>:<div style={{flex:1,minHeight:0}}><BoardScene3D board={board} onUnavailable={()=>setFailed(true)}/></div>}</main>}
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
 const [graphicsQuality,setGraphicsQuality]=useState<GraphicsQuality>(readGraphicsQuality);
 const changeGraphicsQuality=(q:GraphicsQuality)=>{setGraphicsQuality(q);persistGraphicsQuality(q);};
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
 const [buildOpen,setBuildOpen]=useState(false);
 const [seed,setSeed]=useState('orvane-001');
 const [draft,setDraft]=useState(seed);
 const [selection,setSelection]=useState<Selection|null>(null);
 const [experimental3D,setExperimental3D]=useState(()=>new URLSearchParams(window.location.search).get('renderer')!=='2d');
 const [webglFailed,setWebglFailed]=useState(false);
 const camera3D=useRef<BoardCameraControls|null>(null);
 const throwImpulse=useRef<{values:[number,number];impulse:{x:number;z:number;origin?:{x:number;z:number}}}|null>(null);
 const diceGesture=useRef<{id:number;x:number;y:number;time:number}|null>(null);
 const [diceDrag,setDiceDrag]=useState<{x:number;y:number}|null>(null);

 const [zoom,setZoom]=useState(1);
 const [pan,setPan]=useState({x:0,y:0});
 const svg=useRef<SVGSVGElement>(null);
 const pointers=useRef(new Map<number,Point>());
 const drag=useRef<{id:number;start:Point;pan:Point;zoom:number;moved:boolean}|null>(null);
 const pinch=useRef<{distance:number;zoom:number;anchor:Point}|null>(null);
 const movedGesture=useRef(false);
 const lastGestureEnd=useRef(-1000);
 const cameraState=useRef({zoom:1,pan:{x:0,y:0}});
 useLayoutEffect(()=>{cameraState.current={zoom,pan};},[zoom,pan]);
 const board=useMemo(()=>generateBoard(seed,size),[seed,size]);
 // A completed setup is a transition, never a second lobby. This also repairs
 // saves made by older versions while waiting for the former Begin game button.
 useEffect(()=>{
   if(!setup||setup.phase!=='complete'||game)return;
   const started=startGame(board,setup);
   setGame(current=>current??started);setSelection(null);setBuildOpen(false);
 },[board,setup,game]);
 const view=game??setup;
 const active3D=!!view&&experimental3D&&!webglFailed;
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
 const openPanel=(p:Panel)=>{setBuildOpen(false);setPanel(p);setDrawerOpen(true);};
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
   if(target==='build')setBuildOpen(true);
   if(target==='trade'||target==='cards'||target==='info')openPanel(target==='trade'?'trade':target==='cards'?'cards':'info');
   else setDrawerOpen(false);
   requestAnimationFrame(()=>{
     const el=Array.from(document.querySelectorAll<HTMLElement>('[data-coach-target="'+target+'"]')).find(node=>node.getClientRects().length>0&&!node.closest('[hidden]'));
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
 useEffect(()=>{if(!visual||hidden)return;if(pace==='turbo'){setVisualQueue([]);return;}const physical=active3D&&visual.kind==='dice'&&!reduced&&duration>0;const timer=window.setTimeout(()=>setVisualQueue(q=>q[0]===visual?q.slice(1):q),physical?6500:duration);return()=>window.clearTimeout(timer);},[visual,duration,hidden,pace,active3D,reduced]);
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
      e.preventDefault();setBuildOpen(true);setBuild((['road','settlement','city'] as BuildKind[])[Number(e.key)-1]);setSelection(null);setDrawerOpen(false);
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
 const rollFromTray=(dx?:number,dy?:number,releaseX?:number,releaseY?:number)=>{
  if(!game||!humanActive||game.phase!=='roll')return;
  const values=rollDice();
  const next=applyGame(board,game,{kind:'roll',playerId:game.active,dice:values});
  throwImpulse.current=next.dice&&dx!==undefined&&dy!==undefined?{values:next.dice,impulse:camera3D.current?.throwVector(dx,dy,releaseX,releaseY)??{x:dx,z:dy}}:null;
  setGame(next);setSelection(null);
 };

 const constructionSites=(kind:BuildKind):string[]=>{
  if(game)return humanActive&&game.phase==='action'?legalBuilds(board,game,kind):[];
  if(!setup||!humanDecision)return [];
  return kind==='road'&&setup.phase==='road'?legalRoads(board,setup):kind==='settlement'&&setup.phase==='settlement'?legalSettlements(board,setup):[];
 };
 const locateConstruction=(kind:BuildKind,x:number,y:number)=>{
  const rect=(active3D?document.querySelector('.tabletop-world canvas'):svg.current)?.getBoundingClientRect();
  if(!rect||x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return undefined;
  const surface=document.elementFromPoint(x,y);
  if(!surface?.closest('.tabletop-world,svg[data-board-root]'))return undefined;
  const project=(type:'edge'|'vertex',id:string)=>{
   if(active3D)return camera3D.current?.project(type,id);
   const matrix=svg.current?.getScreenCTM();if(!matrix)return undefined;
   const edge=type==='edge'?board.edges.find(e=>e.id===id):undefined;
   const a=edge&&points.get(edge.a),b=edge&&points.get(edge.b);
   const p=type==='vertex'?points.get(id):a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:undefined;
   return p?new DOMPoint(p.x,p.y).matrixTransform(matrix):undefined;
  };
  let best:{id:string;x:number;y:number;angle?:number}|undefined,distance=30;
  for(const id of constructionSites(kind)){
   const p=project(kind==='road'?'edge':'vertex',id);if(!p)continue;
   const d=Math.hypot(p.x-x,p.y-y);if(d>distance)continue;
   const edge=kind==='road'?board.edges.find(e=>e.id===id):undefined;
   const a=edge&&project('vertex',edge.a),b=edge&&project('vertex',edge.b);
   distance=d;best={id,x:p.x,y:p.y,angle:a&&b?Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+25:undefined};
  }
  return best;
 };
 const placeConstruction=(kind:BuildKind,id:string)=>{
  if(playerId===null||!constructionSites(kind).includes(id))return;
  if(game)setGame(applyGame(board,game,{kind:'build',playerId,build:kind,id}));
  else if(setup&&kind!=='city')setSetup(applySetup(board,setup,{kind,id,playerId}));
  setSelection(null);
 };
 const pieceCounts:Record<BuildKind,number>={road:15-(view?.roads.filter(r=>r.playerId===myHand?.id).length??0),settlement:5-(view?.settlements.filter(v=>v.playerId===myHand?.id&&(!game||!game.settlements.some(b=>b.vertexId===v.vertexId&&b.kind==='city'))).length??0),city:4-(game?.settlements.filter(v=>v.playerId===myHand?.id&&v.kind==='city').length??0)};
 const pieceAvailable:Record<BuildKind,boolean>={road:constructionSites('road').length>0,settlement:constructionSites('settlement').length>0,city:constructionSites('city').length>0};

 const keySelect=(event:KeyboardEvent,kind:Selection['kind'],id:string)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(kind,id);}};
 function start(e:PointerEvent<SVGSVGElement>){
   if(e.pointerType==='mouse'&&e.button!==0||!svg.current)return;
   if(cameraFrame.current!==null){cancelAnimationFrame(cameraFrame.current);cameraFrame.current=null;}
   const point={x:e.clientX,y:e.clientY};pointers.current.set(e.pointerId,point);
   if(pointers.current.size===1){
     drag.current={id:e.pointerId,start:point,pan:{...cameraState.current.pan},zoom:cameraState.current.zoom,moved:false};
     pinch.current=null;movedGesture.current=false;
   }else if(pointers.current.size===2){
     const [a,b]=[...pointers.current.values()],rect=svg.current.getBoundingClientRect();
     pinch.current={distance:Math.max(distance(a,b),1),zoom:cameraState.current.zoom,
       anchor:worldAt(bounds,rect,cameraState.current.zoom,cameraState.current.pan,mid(a,b))};
     drag.current=null;movedGesture.current=true;
   }
 }
 function move(e:PointerEvent<SVGSVGElement>){
   if(!pointers.current.has(e.pointerId)||!svg.current)return;
   const pt={x:e.clientX,y:e.clientY};pointers.current.set(e.pointerId,pt);
   const rect=svg.current.getBoundingClientRect();
   if(pointers.current.size>=2){
     const [a,b]=[...pointers.current.values()];
     const p=pinch.current;
     if(!p)return;
     const z=clampZoom(p.zoom*distance(a,b)/p.distance);
     setZoom(z);setPan(panAroundWorld(bounds,rect,p.anchor,mid(a,b),z));
     movedGesture.current=true;
     return;
   }
   const d=drag.current;
   if(!d||d.id!==e.pointerId)return;
   if(!d.moved&&distance(pt,d.start)<(e.pointerType==='mouse'?5:8))return;
   if(!d.moved){
     d.moved=true;
     try{svg.current.setPointerCapture(e.pointerId);}catch{}
   }
   movedGesture.current=true;
   setPan(dragPan(bounds,rect,d.zoom,d.pan,d.start,pt));
 }
 function end(e:PointerEvent<SVGSVGElement>){
   if(!pointers.current.has(e.pointerId))return;
   pointers.current.delete(e.pointerId);
   if(svg.current?.hasPointerCapture(e.pointerId))try{svg.current.releasePointerCapture(e.pointerId);}catch{}
   if(movedGesture.current)lastGestureEnd.current=performance.now();
   if(pointers.current.size===1){
     const [id,pt]=[...pointers.current.entries()][0];
     drag.current={id,start:pt,pan:{...cameraState.current.pan},zoom:cameraState.current.zoom,moved:false};
     pinch.current=null;
   }else if(pointers.current.size===0){
     drag.current=null;pinch.current=null;movedGesture.current=false;
   }
 }
 const viewW=bounds.w/zoom,viewH=bounds.h/zoom;
 return <main className={view?"in-match":menu==="home"?"front-menu":menu==="setup"?"lobby-screen":""} data-coach-focus={coachOpen?coachFocus??undefined:undefined} data-dice={loadout.dice} data-card-back={loadout.cardBack} data-board-theme={loadout.board}>
  <header><div><p className="eyebrow">ORVANE / FIELD NOTES</p><h1>Founders of Orvane</h1><p className="subtitle">Build. Trade. Explore. Prosper.</p></div><div className="header-actions"><span className="version">v1.1.0-beta.1</span>{view&&<>{document.fullscreenEnabled&&<button aria-label="Toggle fullscreen" aria-pressed={fullscreen} title="Fullscreen" onClick={toggleFullscreen}>⛶</button>}<button aria-label="Pause menu" aria-expanded={pauseMenuOpen} onClick={()=>setPauseMenuOpen(true)}>☰</button></>}<button aria-label={audio.settings.enabled?"Mute sound":"Enable sound"} aria-pressed={audio.settings.enabled} onClick={audio.toggle}>{audio.settings.enabled?"🔊":"🔇"}</button>{view&&<button aria-label="Guided tutorial" aria-expanded={coachOpen} aria-pressed={tutorial.enabled&&coachOpen} onClick={activateTutorial}>🧭</button>}{view&&<button aria-expanded={guideOpen} aria-label="Game guide" onClick={()=>setGuideOpen(v=>!v)}>📖</button>}<button aria-expanded={soundOpen} onClick={()=>setSoundOpen(v=>!v)}>⚙️</button></div></header>
  {soundOpen&&<section className="setup-bar sound-settings"><label>Graphics quality <GraphicsQualitySelect value={graphicsQuality} onChange={changeGraphicsQuality}/></label><label><input type="checkbox" aria-label="Enable game sound" checked={audio.settings.enabled} onChange={audio.toggle}/> Game sound</label><label>🔊 Effects volume <input aria-label="Effects volume" type="range" min={0} max={100} value={Math.round(audio.settings.volume*100)} onChange={e=>audio.setVolume(Number(e.target.value)/100)}/></label><label><input type="checkbox" checked={audio.settings.bots} onChange={audio.toggleBots}/> Bot sounds</label><label><input type="checkbox" checked={audio.settings.music} onChange={audio.toggleMusic}/> 🎵 Ambient music</label><label>Music volume <input aria-label="Music volume" type="range" min={0} max={100} value={Math.round(audio.settings.musicVolume*100)} onChange={e=>audio.setMusicVolume(Number(e.target.value)/100)}/></label>{typeof navigator.vibrate==='function'&&<label><input type="checkbox" checked={audio.settings.haptic} onChange={audio.toggleHaptic}/> Haptics</label>}<button onClick={()=>{void audio.unlock().then(()=>audio.play('trade'));}}>Test sound</button><span className="muted">{audio.ready?'Audio ready':'Tap to activate audio'}</span></section>}
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
  {!setup&&<div className="setup-heading"><button onClick={()=>setMenu('home')}>← Main menu</button><div><p className="eyebrow">CHART YOUR EXPEDITION</p><h2>New game</h2></div></div>}
  {!setup&&<section className="toolbar" aria-label="Board settings">
    <div className="lobby-section-title"><span>01</span><strong>Island & seats</strong></div><div className="sizes">{([3,4,5,6] as PlayerCount[]).map(n=><button key={n} disabled={!!setup} aria-pressed={count===n} onClick={()=>{setCount(n);setHumans(h=>Math.min(h,n));setBoard(n<=4?'standard':'extended',seed);}}>{n} players</button>)}</div>
    <form onSubmit={e=>{e.preventDefault();if(draft.trim())setBoard(size,draft.trim());}}><label htmlFor="seed">Map seed</label><input disabled={!!setup} id="seed" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={80} required/><button disabled={!!setup} type="submit">Generate</button><button disabled={!!setup} type="button" onClick={()=>setBoard(size,crypto.randomUUID().slice(0,12))}>Random</button></form>
  </section>}
  {!setup&&<section className="setup-bar lobby"><div><strong>02 · Founders</strong><p className="muted">{humans} human · {count-humans} bots</p></div><div className="sizes"><label>Humans <select disabled={!!setup} value={humans} onChange={e=>setHumans(Number(e.target.value))}>{Array.from({length:count},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label><label>AI <select disabled={!!setup} value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}>{(['easy','normal','hard','expert'] as Difficulty[]).map(d=><option key={d}>{d}</option>)}</select></label><label className="pace-control">Pace <select aria-label="Bot pace" value={pace} onChange={e=>setPace(e.target.value as Pace)}>{(Object.keys(PACES) as Pace[]).map(p=><option key={p} value={p}>{PACES[p].label}</option>)}</select></label></div></section>}
  {view&&<p className="save-status" role="status">{storageError?'⚠️ Not saved':savedAt?'💾 Saved locally':'Saving…'}{pwa.offline?' · Offline':''}</p>}
  {botError&&<section className="setup-bar" role="alert"><span>Bot stopped: {botError}</span><button onClick={()=>setBotError('')}>Retry</button><button onClick={leave}>Main menu</button></section>}
  <section className="setup-bar turn-bar" aria-live="polite" id="turn-actions" aria-label="Turn command bar">
    {game?<><div className="turn-ident"><span className="turn-emblem">{game.phase==="roll"?"🎲":game.phase==="action"?"⚔️":game.phase==="finished"?"🏆":"❗"}</span><div><small>ROUND {game.round}{game.paired?" · PAIRED ACTION":""}</small><strong>{current?.name}</strong><p className="muted">{game.phase==='finished'?'🏆 Game finished':game.phase==='roll'?'Roll the dice or play a card':game.phase==='discard'?'🥷 Discard required':game.phase==='robber'?'🥷 Move the robber':game.phase==='freeRoad'?'🛤️ Place free roads':(game.dice?game.dice.join(' + ')+' = '+game.dice.reduce((a,b)=>a+b,0)+' · ':'')+'Build, trade or end turn'}</p></div></div><div className="sizes"><button data-coach-target="roll" disabled={!humanActive||game.phase!=='roll'} onClick={()=>{setGame(applyGame(board,game,{kind:'roll',playerId:game.active,dice:rollDice()}));setSelection(null);}} className="turn-primary">🎲 Roll dice</button><button disabled={!humanActive||game.phase!=='action'||!!game.offer} onClick={()=>{setGame(applyGame(board,game,{kind:'end',playerId:game.active}));setSelection(null);}} className="turn-primary">⏭ End turn</button><button onClick={leave}>Save & exit</button></div></>:setup?<><div><strong>{setup.phase==='complete'?'Initial placement complete':current?.name+' · '+(setup.phase==='settlement'?'Place a settlement':'Place its road')}</strong><p className="muted">{setup.phase==='complete'?'All pieces placed. Starting the first turn…':'Round '+(setup.step<count?1:2)+' of 2 · Placement '+(setup.step+1)+' / '+setup.order.length}</p></div><div className="sizes">{setup.phase==='complete'?<span role="status">Starting the match…</span>:<button disabled={!selectionLegal} onClick={confirmPlacement}>Confirm placement</button>}<button onClick={leave}>Save & exit</button></div></>:<><div><strong>03 · Set sail</strong><p className="muted">{count} founders · {size==='extended'?'Extended island':'Standard island'}</p></div><button onClick={()=>startSetup()}>Start setup</button><button onClick={()=>startSetup(true)}>🧭 Guided setup</button></>}
  </section>
  {game&&humanDecision&&(game.offer||game.phase==='discard'||game.phase==='robber'||game.phase==='freeRoad')&&<section className="setup-bar action-prompt" role="status"><strong>{game.offer?'🤝 Trade offer for '+view?.players.find(p=>p.id===decision)?.name:game.phase==='discard'?'🥷 '+view?.players.find(p=>p.id===decision)?.name+': discard resources':game.phase==='robber'?'🥷 Choose a hex and move the robber':'🛤️ Choose a free road'}</strong><button onClick={()=>openPanel(game.offer?'trade':'cards')}>Open action ↓</button></section>}
  {view&&game?.phase!=='finished'&&<section className="setup-bar pace-bar"><div><strong>{botBusy?(paused?'⏸ Bots paused':'🤖 '+view.players.find(p=>p.id===decision)?.name?.replace('🤖 ','')+' is playing'):'⏱ Match pace'}</strong><p className="muted">{paused?'Use Next action to watch one move at a time.':'Watch each action or speed up whenever you want.'}</p></div><div className="sizes"><label className="pace-control">Pace <select aria-label="Bot pace" value={pace} onChange={e=>setPace(e.target.value as Pace)}>{(Object.keys(PACES) as Pace[]).map(p=><option key={p} value={p}>{PACES[p].label}</option>)}</select></label><button aria-pressed={paused} onClick={()=>{setPaused(v=>!v);setStepRequested(false);}}>{paused?'▶ Resume bots':'⏸ Pause bots'}</button>{visual&&<button onClick={()=>setVisualQueue(q=>q.slice(1))}>Skip animation →</button>}{paused&&<button disabled={!botBusy||stepRequested||!!visual} onClick={()=>setStepRequested(true)}>Next action →</button>}</div></section>}
  {game?.winner!==null&&game?.winner!==undefined&&!visual&&<section className="winner-banner" role="status"><h2>🏆 {game.players.find(p=>p.id===game.winner)?.name} wins!</h2><p>{playerScore(game,game.winner,true).total} victory points · {game.round} rounds{humans===1&&matchId&&library.results.some(r=>r.id===matchId)?' · +'+matchXP(library.results.find(r=>r.id===matchId)! )+' match XP':''}</p>{profile&&matchId&&humans===1&&<MatchRewards results={library.results} profileId={profile.id} matchId={matchId}/>}<button onClick={()=>{if(leave())setMenu('setup');}}>New game</button></section>}
  {view&&<PlayerStrip seed={seed} view={view} game={game} active={visual?.playerId??playerId} humans={humans} showHand={showHand} soloAvatar={profile&&progress?avatarIcon(profile.avatar,progress.level):undefined} soloTitle={cosmetic(loadout.title).name}/> }
  <div className={"layout immersive-layout"+(drawerOpen?" drawer-active":"")+(activePanel==="trade"?" trade-open":"")}>
   <section className="board-panel" id="board" data-coach-target="board" tabIndex={-1} aria-label="Interactive island map">
    <div className="map-top"><span className="map-brand">ORVANE</span><div>{view&&<button aria-label="Open journal" aria-expanded={drawerOpen&&activePanel==="info"} onClick={()=>drawerOpen&&activePanel==="info"?setDrawerOpen(false):openPanel("info")}><ControlIcon name="journal"/> <span className="toolbar-label">Journal</span></button>}<button aria-label="Follow board events" aria-pressed={follow} onClick={()=>setFollow(f=>!f)}><ControlIcon name="follow"/></button><button aria-label="Zoom out" disabled={!active3D&&zoom<=.75} onClick={()=>{if(active3D)camera3D.current?.zoomBy(-.25);else setZoom(z=>Math.max(.75,z-.25));}}><ControlIcon name="minus"/></button><button aria-label="Reset view" onClick={()=>{if(active3D)camera3D.current?.reset();else{setZoom(1);setPan({x:0,y:0});}}}><ControlIcon name="fit"/></button><button aria-label="Zoom in" disabled={!active3D&&zoom>=2.5} onClick={()=>{if(active3D)camera3D.current?.zoomBy(.25);else setZoom(z=>Math.min(2.5,z+.25));}}><ControlIcon name="plus"/></button></div></div>
    {view&&coachOpen&&tutorial.enabled&&<TutorialCoach progress={tutorial} lesson={tutorLesson} tip={coachFocus===tutorLesson?.target&&tutorLesson?tutorialTip(tutorLesson):"Try the highlighted action. Your real moves advance the lesson."} onShow={showTutorTarget} onHide={()=>{setCoachOpen(false);setCoachFocus(null);}} onSkip={skipTutorial}/>}
     {view&&<div className="board-event-slot">{view&&visual&&duration>0&&<EventStage key={visualQueue.length+':'+visual.kind+':'+(game?.turn??setup?.step)} event={visual} effectId={loadout.effects} celebrate={visual.playerId<humans&&!reduced} name={view.players.find(p=>p.id===visual.playerId)?.name??'Player'} other={'other' in visual&&visual.other!==null?view.players.find(p=>p.id===visual.other)?.name??'Player':'🏦 Bank'} duration={duration} color={view.players.find(p=>p.id===visual.playerId)?.color??'#ffe39b'}/>}{(!visual||duration===0)&&<div className="event-idle"><span>{humanDecision?'👤':'🎲'}</span><strong>{view.players.find(p=>p.id===(decision??playerId))?.name??'Match'} </strong><span className="muted">{humanDecision?'Your action':paused?'Paused':'Watching the board'}</span></div>}</div>}
    {game&&humanActive&&game.phase==='action'&&buildOpen&&<BuildMenu onClose={()=>setBuildOpen(false)} board={board} game={game} build={build} onSelect={k=>{setBuild(k);setSelection(null);}}/>}
    {active3D?<div className="tabletop-world" style={{position:'absolute',inset:0,top:54,bottom:45,zIndex:0}}><BoardScene3D board={board} diceRoll={visual?.kind==='dice'&&duration>0&&!reduced?{values:visual.dice,duration,impulse:throwImpulse.current?.values===visual.dice?throwImpulse.current.impulse:undefined,onComplete:()=>setVisualQueue(q=>q[0]===visual?q.slice(1):q)}:undefined} graphicsQuality={graphicsQuality} onGraphicsQualityChange={changeGraphicsQuality} cameraControls={camera3D} ambientPaused={paused||pauseMenuOpen||pace==='turbo'||reduced} robberTile={game?.development.robber} producingTiles={visual?.kind==='production'&&duration>0&&!reduced?visual.tiles:undefined} pieces={{roads:(view?.roads??[]).map(r=>({edgeId:r.edgeId,color:view?.players.find(p=>p.id===r.playerId)?.color??'#ffffff'})),buildings:(view?.settlements??[]).map(v=>({vertexId:v.vertexId,kind:game?.settlements.some(s=>s.vertexId===v.vertexId&&s.kind==='city')?'city' as const:'settlement' as const,color:view?.players.find(p=>p.id===v.playerId)?.color??'#ffffff'}))}} legalVertices={[...validVertices]} legalEdges={[...validEdges]} onSelect={v=>setSelection(v)} onUnavailable={()=>{setWebglFailed(true);setExperimental3D(false);}}/></div>:<>
    <svg ref={svg} data-board-root="true" viewBox={[bounds.x+(bounds.w-viewW)/2+pan.x,bounds.y+(bounds.h-viewH)/2+pan.y,viewW,viewH].join(' ')} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onClickCapture={e=>{
         if(performance.now()-lastGestureEnd.current<320){e.preventDefault();e.stopPropagation();return;}
         if(!e.detail||!window.matchMedia('(pointer:coarse)').matches||(!vertexMode&&!roadMode)||!svg.current)return;
         const rect=svg.current.getBoundingClientRect(),scale=zoom*Math.min(rect.width/bounds.w,rect.height/bounds.h);
         if(scale<=0)return;
         const world=worldAt(bounds,rect,zoom,pan,{x:e.clientX,y:e.clientY}),radius=24/scale;
         const id=vertexMode?nearestVertex(points,validVertices,world,radius):nearestEdge(board.edges,points,validEdges,world,radius);
         if(id){e.preventDefault();e.stopPropagation();setSelection({kind:vertexMode?'vertex':'edge',id});}
       }} aria-label="Hexagonal island; drag with one finger, pinch with two to zoom" className={"board-root"+(reduced||hidden||pace==="turbo"||paused||visual?"":" ambient-active")+(roadMode?" road-mode":vertexMode?" vertex-mode":"")}>
      <defs><pattern id="waves" width="64" height="48" patternUnits="userSpaceOnUse"><path d="M8 13 Q16 11 25 13 M40 35 Q47 33 55 35" fill="none" stroke="#d6eeea" strokeWidth="1.4" strokeLinecap="round" opacity=".2"/></pattern></defs>
      <rect x={-10000} y={-10000} width={20000} height={20000} fill="url(#waves)" className="sea-texture" pointerEvents="none"/>
      {board.tiles.map(t=>{const p=tilePosition(t,R),meta=terrain[t.terrain];return <g key={t.id} role="button" tabIndex={0} aria-label={meta.name+' '+(t.number??'desert')} aria-pressed={activeTile?.id===t.id} onClick={()=>select('tile',t.id)} onKeyDown={e=>keySelect(e,'tile',t.id)} className="tile">
        <polygon points={t.vertices.map(id=>{const v=points.get(id)!;return v.x+','+v.y;}).join(' ')} fill={meta.color} stroke={activeTile?.id===t.id?'#fff4c9':'#3c615c'} strokeWidth={activeTile?.id===t.id?4:1.7}/>
        <TerrainArt terrain={t.terrain} p={p} harvesting={!reduced&&duration>0&&visual?.kind==='production'&&visual.tiles.includes(t.id)} duration={duration}/>
        {t.number!==null&&<><circle cx={p.x} cy={p.y+13} r={16} fill="#203b39" opacity=".20" pointerEvents="none"/><circle cx={p.x} cy={p.y+11} r={16} fill="#f4f0e5" stroke="#64736b" strokeWidth="1"/><text x={p.x} y={p.y+12} className={'token '+(t.number===6||t.number===8?'red':'')}>{t.number}</text><text x={p.x} y={p.y+37} className="pips">{'•'.repeat(6-Math.abs(7-t.number))}</text></>}
        {game?.development.robber===t.id&&!(visual?.kind==='robber'&&duration>0&&!reduced)&&<RobberArt p={{x:p.x+24,y:p.y-5}} styleId={loadout.robber}/>}
      </g>;})}
      {board.harbors.map(h=>{const e=board.edges.find(e=>e.id===h.edgeId)!,a=points.get(e.a)!,b=points.get(e.b)!,t=board.tiles.find(t=>t.id===e.tiles[0])!,center=tilePosition(t,R),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=mx-center.x,dy=my-center.y,len=Math.hypot(dx,dy),x=mx+dx/len*28,y=my+dy/len*28;return <g key={h.edgeId} aria-label={(h.resource?terrain[h.resource].resource:'Generic')+' harbor '+h.rate+':1'} pointerEvents="none"><HarborArt a={a} b={b} p={{x,y}} angle={Math.atan2(dy,dx)*180/Math.PI} resource={h.resource} rate={h.rate}/></g>;})}
      {board.edges.map(e=>{const a=points.get(e.a)!,b=points.get(e.b)!;const owner=view?.roads.find(x=>x.edgeId===e.id);const revealing=visualQueue.some(v=>(v.kind==='road'||v.kind==='spend'&&v.build==='road')&&v.id===e.id)&&duration>0&&!reduced;const color=revealing?undefined:view?.players.find(p=>p.id===owner?.playerId)?.color;return <g key={e.id} role="button" tabIndex={0} aria-label={'Road edge '+e.id} aria-pressed={activeEdge?.id===e.id} onClick={()=>select('edge',e.id)} onKeyDown={ev=>keySelect(ev,'edge',e.id)} className={"edge"+(validEdges.has(e.id)?" legal-site":"")}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={34}/>{color?<RoadArt a={a} b={b} color={color} styleId={humans===1&&owner?.playerId===0?loadout.road:DEFAULT_LOADOUT.road}/>:<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={activeEdge?.id===e.id?'#ffffff':color??(validEdges.has(e.id)?'#ffe39b':'#e4d7af')} opacity={color||activeEdge?.id===e.id||validEdges.has(e.id)?1:.55} strokeWidth={activeEdge?.id===e.id||validEdges.has(e.id)?5:1.5}/>}</g>;})}
      {board.vertices.map(v=>{const p=points.get(v.id)!;const owner=view?.settlements.find(x=>x.vertexId===v.id);const revealing=visualQueue.some(e=>(e.kind==='settlement'||e.kind==='spend'&&e.build==='settlement')&&e.id===v.id)&&duration>0&&!reduced;const upgrading=visual?.kind==='city'&&visual.id===v.id&&duration>0&&!reduced;const color=revealing||upgrading?undefined:view?.players.find(x=>x.id===owner?.playerId)?.color;const city=game?.settlements.some(s=>s.vertexId===v.id&&s.kind==='city')&&!(visualQueue.some(e=>(e.kind==='city'||e.kind==='spend'&&e.build==='city')&&e.id===v.id)&&duration>0&&!reduced);return <g key={v.id} role="button" tabIndex={0} aria-label={'Building vertex '+v.id} aria-pressed={activeVertex?.id===v.id} onClick={()=>select('vertex',v.id)} onKeyDown={e=>keySelect(e,'vertex',v.id)} className={"vertex"+(validVertices.has(v.id)?" legal-site":"")}><circle cx={p.x} cy={p.y} r={20} fill="transparent"/>{validVertices.has(v.id)&&<circle cx={p.x} cy={p.y} r={12} fill="none" stroke={activeVertex?.id===v.id?"#ffffff":"#ffe39b"} strokeWidth={2.5} pointerEvents="none"/>}{color?<BuildingArt p={p} city={!!city} color={color} styleId={humans===1&&owner?.playerId===0?(city?loadout.city:loadout.settlement):(city?DEFAULT_LOADOUT.city:DEFAULT_LOADOUT.settlement)}/>:<circle cx={p.x} cy={p.y} r={activeVertex?.id===v.id?8:validVertices.has(v.id)?6:3.5} fill={activeVertex?.id===v.id||validVertices.has(v.id)?'#ffe39b':'#e4d7af'} stroke="#24434a" strokeWidth={1}/>}</g>;})}
      {visual&&duration>0&&!reduced&&<BoardEffects key={visualQueue.length+":"+visual.kind+":"+(game?.turn??setup?.step)} event={visual} loadout={humans===1&&visual.playerId===0?loadout:{...DEFAULT_LOADOUT,robber:loadout.robber}} board={board} points={points} r={R} duration={duration} color={view?.players.find(p=>p.id===visual.playerId)?.color??"#ffe39b"}/>}
    </svg></>}

    {game&&humanActive&&game.phase==='roll'&&active3D&&<button type="button" className="dice-flick-tray" aria-label="Drag to throw dice or click to roll" onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);diceGesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()};}} onPointerMove={e=>{const g=diceGesture.current;if(g?.id!==e.pointerId)return;if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>6)setDiceDrag({x:e.clientX-g.x,y:e.clientY-g.y});}} onPointerUp={e=>{const g=diceGesture.current;diceGesture.current=null;setDiceDrag(null);if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.hypot(dx,dy)<8){rollFromTray();return;}const seconds=Math.max(.08,(performance.now()-g.time)/1000),scale=.012/seconds;rollFromTray(dx*scale,dy*scale,e.clientX,e.clientY);}} onPointerCancel={()=>{diceGesture.current=null;setDiceDrag(null);}} onLostPointerCapture={()=>{diceGesture.current=null;setDiceDrag(null);}} onClick={e=>{if(e.detail===0)rollFromTray();}}><span style={{transform:diceDrag?'translate('+diceDrag.x+'px,'+diceDrag.y+'px)':undefined}}><Die3D value={5} index={0} rolling={false}/><Die3D value={3} index={1} rolling={false}/></span><small>Drag to throw</small></button>}
    {game?.dice&&<div className={"dice-display"+(visual?.kind==="dice"&&duration>0&&!reduced&&!active3D?" board-dice-throw":"")} style={visual?.kind==="dice"?{animationDuration:`${duration}ms`}:undefined} aria-label={'Dice total '+(game.dice[0]+game.dice[1])}>{game.dice.map((n,i)=><Die3D key={i+':'+(game.turn??0)+':'+(visual?.kind==='dice'?'roll':'rest')} value={n} index={i} rolling={visual?.kind==='dice'&&duration>0&&!reduced&&!active3D}/>)}<strong>{game.dice[0]+game.dice[1]}</strong><span className="muted">{game.paired?'Paired action':'Last roll'}</span></div>}
    <p className="map-help">{setup&&!game&&humanDecision&&setup.phase!=='complete'?(setup.phase==='settlement'?'🏠 Tap a highlighted junction':'🛤️ Tap a highlighted road'):game&&humanActive&&game.phase==='action'?(legal.length?'Tap a highlighted site to build':'Not enough resources or no legal sites for '+build):'Drag to move · pinch to zoom · tap a highlighted site'}</p>
    {setup&&!game&&humanDecision&&setup.phase!=='complete'&&<div className="map-confirm"><button disabled={!selectionLegal} onClick={confirmPlacement}>{selectionLegal?'✓ Confirm '+setup.phase:'Select a highlighted '+(setup.phase==='road'?'road':'junction')}</button></div>}
    {game&&humanActive&&game.phase==='action'&&selectionLegal&&<div className="map-confirm"><button onClick={confirmBuild}>✓ Build {build}</button></div>}
   </section>
   <aside id="action-panel" className="game-sidebar" aria-label="Game actions">
    {view&&<div className="drawer-heading"><strong>{activePanel==="info"?"Journal":activePanel==="cards"?"Your cards":"Trade"}</strong><button aria-label="Close game panel" onClick={()=>setDrawerOpen(false)}>✕</button></div>}{view&&<div className="panel-nav" aria-label="Match panels">{(['info','cards','trade'] as Panel[]).map(p=><button key={p} aria-pressed={activePanel===p} disabled={!!forcedPanel&&forcedPanel!==p||p==='cards'&&(!game||!humanDecision||!!game.offer||game.phase==='finished')||p==='trade'&&(!game||!humanDecision||game.phase!=='action')} onClick={()=>openPanel(p)} data-coach-target={p}>{p==='info'?'🗺️ Info':p==='cards'?'🃏 Cards':'⚓ Trade'}</button>)}</div>}
    {activePanel==='cards'&&game&&humanDecision&&!game.offer&&<DevelopmentPanel key={game.active+":"+game.turn} board={board} game={game} humanActive={humanActive} selectedTile={activeTile?.id} onSelectTile={id=>select('tile',id)} selectedEdge={activeEdge?.id} onChange={s=>{setGame(s);setSelection(null);}}/>}
    {activePanel==='trade'&&game&&humanDecision&&(game.phase==='action')&&<TradePanel key={game.active+":"+game.turn} board={board} game={game} humanActive={humanActive} onChange={s=>{setGame(s);setSelection(null);}}/>}
    {(!view||activePanel==='info'||!humanDecision)&&<div className="info-stack">{view&&activity.length>0&&<section className="match-feed" aria-label="Recent match events"><strong>📜 What happened</strong><p className="latest-event" aria-live="polite">{activity[0]}</p>{activity.slice(1,3).map((a,i)=><p className="muted" key={i}>{a}</p>)}</section>}{game&&game.dice&&<details className="panel production-details"><summary>🌾 Production this roll</summary><section className="setup-bar"><div><strong>Production this roll</strong><p className="muted">{game.players.map((p,i)=>p.name+': +'+Object.values(game.lastProduction[i]).reduce((a,b)=>a+b,0)).join(' · ')}{game.shortages.length?' · Bank shortage: '+game.shortages.map(k=>terrain[k].resource).join(', '):''}</p></div></section></details>}{game&&<section className="panel"><h2>Resource bank</h2><dl>{RESOURCES.map(k=><div className="bank-row" key={k}><dt>{resourceEmoji[k]} {terrain[k].resource}</dt><dd>{game.bank[k]}</dd></div>)}</dl></section>}<section className="panel cartographer"><h2>Cartographer</h2><p className="muted">Seed: {seed}</p><dl><dt>Hexes</dt><dd>{board.tiles.length}</dd><dt>Building sites</dt><dd>{board.vertices.length}</dd><dt>Road segments</dt><dd>{board.edges.length}</dd></dl></section>
   <section className="panel inspector" aria-live="polite"><h2>Selection</h2>{activeTile?<><strong>{terrain[activeTile.terrain].name}</strong><p>Resource: {terrain[activeTile.terrain].resource}</p><p>Production token: {activeTile.number??'None'}</p></>:activeVertex?<><strong>Building junction</strong><p>{activeVertex.id} · {activeVertex.tiles.length} adjacent hexes</p></>:activeEdge?<><strong>Road segment</strong><p>{activeEdge.tiles.length} adjacent hexes · {activeEdge.tiles.length===1?'Coast':'Inland'}</p></>:<p className="muted">Select a map feature to inspect it. Start local setup to place buildings and roads.</p>}</section>
   <section className="panel terrain-legend"><h2>Terrain</h2>{(Object.keys(terrain) as Terrain[]).map(t=><div key={t} className="legend"><span style={{background:terrain[t].color}} className="swatch"/><span>{terrain[t].name}</span><span>{board.tiles.filter(x=>x.terrain===t).length}</span></div>)}</section>{activity.length>0&&<details className="panel activity"><summary>📜 Activity</summary>{activity.slice(0,24).map((a,i)=><p key={i}>{a}</p>)}</details>}</div>}
   </aside>
  </div>
  {view&&myHand&&<ConstructionTray color={myHand.color} counts={pieceCounts} available={pieceAvailable} selected={build} onSelect={kind=>{setBuild(kind);setSelection(null);setBuildOpen(false);setDrawerOpen(false);}} onLocate={locateConstruction} onPlace={placeConstruction} onPreview={active3D?(kind,id)=>camera3D.current?.previewPiece(id?{kind,id,color:myHand.color}:null):undefined}/>}
  {view&&<nav className="match-dock" aria-label="Match controls"><div className="desktop-hand-label">{myHand?myHand.name+" · Your hand":"Private hand"}</div>{myHand?<ResourceHand key={myHand.id} resources={myHand.resources} queue={visualQueue} solo={humans===1} canDrag={humanDecision&&humanActive&&game?.phase==='action'&&!game.offer}/>:<div className="hand-strip">{handoffPending?"🔒 Hand hidden · pass device":"🤖 Opponent turn"}</div>}<div className="dock-actions"><button onClick={()=>setDrawerOpen(false)} aria-label="Map"><ControlIcon name="map"/> Map</button>{game&&humanActive&&game.phase==="action"&&<button onClick={()=>{setDrawerOpen(false);setBuildOpen(v=>!v);}} aria-expanded={buildOpen} aria-label="Build"><ControlIcon name="build"/> Build</button>}{game&&humanDecision&&game.phase==="action"&&<button onClick={()=>openPanel('trade')} aria-label="Trade"><ControlIcon name="trade"/> Trade</button>}{game&&humanDecision&&!game.offer&&<button onClick={()=>openPanel('cards')} aria-label="Cards"><ControlIcon name="cards"/> Cards</button>}{!game&&setup?.phase==="complete"?<span role="status">Starting the match…</span>:!game&&humanDecision&&setup?.phase!=="complete"?<button disabled={!selectionLegal} onClick={confirmPlacement}>✓ Place</button>:game&&humanActive&&game.phase==="roll"?<button data-coach-target="roll" onClick={()=>{setGame(applyGame(board,game,{kind:"roll",playerId:game.active,dice:rollDice()}));setSelection(null);}}><ControlIcon name="roll"/> Roll</button>:game&&humanActive&&game.phase==="action"?<button disabled={!!game.offer} onClick={()=>{setGame(applyGame(board,game,{kind:"end",playerId:game.active}));setSelection(null);}}><ControlIcon name="end"/> End turn</button>:<button onClick={()=>setPauseMenuOpen(true)}><ControlIcon name="menu"/> Menu</button>}</div></nav>}
  {handoffPending&&view&&decision!==null&&<div className="handoff-curtain" role="presentation"><section className="handoff-window" role="dialog" aria-modal="true" aria-label="Pass the device"><span className="handoff-sigil" aria-hidden="true">♜</span><p className="eyebrow">PRIVATE PLAYER TURN</p><h2>Pass the device</h2><p>Hand the screen to <strong>{view.players.find(p=>p.id===decision)?.name??'the next player'}</strong>.</p><p className="muted">Your cards and private actions remain hidden until you are ready.</p><button className="primary-action" autoFocus onClick={()=>{setRevealedSeat(decision);setSelection(null);setDrawerOpen(false);}}>✓ I'm ready</button></section></div>}
   {view&&pauseMenuOpen&&<div className="pause-curtain" onClick={()=>setPauseMenuOpen(false)}><section className="pause-window" role="dialog" aria-modal="true" aria-label="Pause menu" onClick={e=>e.stopPropagation()}><span className="pause-sigil">♜</span><p className="eyebrow">FOUNDERS OF ORVANE</p><h2>Game menu</h2><small aria-label="Build version">v1.1.0-beta.1</small><p className="muted">Bots pause while this menu is open.</p>
 <div className="mobile-pause-options tabletop-pause-options"><label>Bot pace <select aria-label="Pause menu bot pace" value={pace} onChange={e=>setPace(e.target.value as Pace)}>{(Object.keys(PACES) as Pace[]).map(p=><option key={p} value={p}>{PACES[p].label}</option>)}</select></label><button onClick={()=>{setPaused(v=>!v);setStepRequested(false);}}>{paused?'▶ Resume bots':'⏸ Pause bots'}</button>{paused&&<button disabled={!botBusy||stepRequested||!!visual} onClick={()=>{setPauseMenuOpen(false);setStepRequested(true);}}>Next action →</button>}{visual&&<button onClick={()=>setVisualQueue(q=>q.slice(1))}>Skip animation →</button>}</div>
 <div className="pause-commands"><button className="primary-action" onClick={()=>setPauseMenuOpen(false)}>▶ Resume game</button><button onClick={()=>{setPauseMenuOpen(false);setGuideOpen(true);}}>📖 How to play</button><button onClick={()=>{setPauseMenuOpen(false);activateTutorial();}}>🧭 Guided tutorial</button><button onClick={()=>{setPauseMenuOpen(false);setSoundOpen(true);}}>⚙️ Settings</button><button onClick={()=>{if(leave())setPauseMenuOpen(false);}}>💾 Save & exit to menu</button></div><small>ESC · Menu　　1 / 2 / 3 · Build　　I · Journal　　T · Trade　　C · Cards</small></section></div>}
   {visual&&(visual.kind==='income'||visual.kind==='spend')&&humans===1&&visual.playerId===0&&duration>0&&!reduced&&<IncomeFlights event={visual} camera3D={active3D?camera3D:undefined} svg={svg} points={points} duration={duration} spendPoint={visual.kind==='spend'?(visual.build==='road'?(()=>{const e=board.edges.find(e=>e.id===visual.id);const a=e&&points.get(e.a),b=e&&points.get(e.b);return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:undefined;})():points.get(visual.id)):undefined}/>}
  </>}
  {!view&&<footer>Local base game · Autosave · Offline play · Online optional.</footer>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode>{new URLSearchParams(window.location.search).get('preview')==='3d'?<Preview3D/>:<App/>}</StrictMode>);
