import {StrictMode,useMemo,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {generateBoard,tilePosition,vertexPosition,type BoardSize,type Terrain,createSetup,activePlayer,legalSettlements,legalRoads,applySetup,type PlayerCount,type SetupState,startGame,applyGame,legalBuilds,rollDice,RESOURCES,COSTS,type GameState,type BuildKind,freeRoadSites,playerScore,VICTORY_TARGET,chooseFirstPlayer} from '@orvane/engine';
import './style.css';
import {DevelopmentPanel} from './DevelopmentPanel';
import {TradePanel} from './TradePanel';
import {resourceEmoji} from './resources';

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
 const [size,setSize]=useState<BoardSize>('extended');
 const [count,setCount]=useState<PlayerCount>(6);
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
 const playerId=game?game.active:setup?activePlayer(setup):null;
 const current=view?.players.find(p=>p.id===playerId);
 const legal=game?legalBuilds(board,game,build):[];
 const validVertices=new Set(game?(build==='road'?[]:legal):setup?legalSettlements(board,setup):[]);
 const validEdges=new Set(game?(game.phase==='freeRoad'?freeRoadSites(board,game):build==='road'?legal:[]):setup?legalRoads(board,setup):[]);
 const selectionLegal=!!selection&&(selection.kind==='vertex'?validVertices.has(selection.id):selection.kind==='edge'?validEdges.has(selection.id):false);
 const confirmBuild=()=>{if(!game||game.phase!=='action'||!selection||!selectionLegal||playerId===null)return;setGame(applyGame(board,game,{kind:'build',playerId,build,id:selection.id}));setSelection(null);};
 const confirmPlacement=()=>{if(!setup||!selection||!selectionLegal||playerId===null||selection.kind==='tile')return;setSetup(applySetup(board,setup,{kind:selection.kind==='vertex'?'settlement':'road',id:selection.id,playerId}));setSelection(null);};
 const points=useMemo(()=>new Map(board.vertices.map(v=>[v.id,vertexPosition(v,R)])),[board]);
 const bounds=useMemo(()=>{
   const p=[...points.values()],xs=p.map(v=>v.x),ys=p.map(v=>v.y);
   return {x:Math.min(...xs)-65,y:Math.min(...ys)-65,w:Math.max(...xs)-Math.min(...xs)+130,h:Math.max(...ys)-Math.min(...ys)+130};
 },[points]);
 const activeTile=selection?.kind==='tile'?board.tiles.find(t=>t.id===selection.id):undefined;
 const activeVertex=selection?.kind==='vertex'?board.vertices.find(t=>t.id===selection.id):undefined;
 const activeEdge=selection?.kind==='edge'?board.edges.find(t=>t.id===selection.id):undefined;
 const setBoard=(s:BoardSize,seed:string)=>{setSize(s);setGame(null);setSetup(null);setSeed(seed);setDraft(seed);setSelection(null);setPan({x:0,y:0});setZoom(1);};
 const select=(kind:Selection['kind'],id:string)=>setSelection({kind,id});
 const keySelect=(event:KeyboardEvent,kind:Selection['kind'],id:string)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(kind,id);}};
 function start(e:PointerEvent<SVGSVGElement>){
   if(e.button!==0)return;
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
 return <main>
  <header><div><p className="eyebrow">ORVANE / FIELD NOTES</p><h1>Founders of Orvane</h1><p className="subtitle">Build. Trade. Explore. Prosper.</p></div><span className="version">v0.6.0 · Victory & paired turns</span></header>
  <section className="toolbar" aria-label="Board settings">
    <div className="sizes">{([3,4,5,6] as PlayerCount[]).map(n=><button key={n} disabled={!!setup} aria-pressed={count===n} onClick={()=>{setCount(n);setBoard(n<=4?'standard':'extended',seed);}}>{n} players</button>)}</div>
    <form onSubmit={e=>{e.preventDefault();if(draft.trim())setBoard(size,draft.trim());}}><label htmlFor="seed">Map seed</label><input disabled={!!setup} id="seed" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={80} required/><button disabled={!!setup} type="submit">Generate</button><button disabled={!!setup} type="button" onClick={()=>setBoard(size,crypto.randomUUID().slice(0,12))}>Random</button></form>
  </section>
  <section className="setup-bar" aria-live="polite">
    {game?<><div><strong>{current?.name} · Round {game.round}{game.paired?' · Paired action':''}</strong><p className="muted">{game.phase==='finished'?'🏆 Game finished':game.phase==='roll'?'Roll the dice or play a card':game.phase==='discard'?'🥷 Discard required':game.phase==='robber'?'🥷 Move the robber':game.phase==='freeRoad'?'🛤️ Place free roads':(game.dice?game.dice.join(' + ')+' = '+game.dice.reduce((a,b)=>a+b,0)+' · ':'')+'Build, trade or end turn'}</p></div><div className="sizes"><button disabled={game.phase!=='roll'} onClick={()=>{setGame(applyGame(board,game,{kind:'roll',playerId:game.active,dice:rollDice()}));setSelection(null);}}>🎲 Roll dice</button><button disabled={game.phase!=='action'||!!game.offer} onClick={()=>{setGame(applyGame(board,game,{kind:'end',playerId:game.active}));setSelection(null);}}>⏭ End turn</button><button onClick={()=>{if(window.confirm('Discard current game?')){setGame(null);setSetup(null);setSelection(null);}}}>Reset game</button></div></>:setup?<><div><strong>{setup.phase==='complete'?'Initial placement complete':current?.name+' · '+(setup.phase==='settlement'?'Place a settlement':'Place its road')}</strong><p className="muted">{setup.phase==='complete'?'All players have two settlements and two roads. Begin the first turn.':'Round '+(setup.step<count?1:2)+' of 2 · Placement '+(setup.step+1)+' / '+setup.order.length}</p></div><div className="sizes">{setup.phase==='complete'?<button onClick={()=>{setGame(startGame(board,setup));setSelection(null);}}>Begin game</button>:<button disabled={!selectionLegal} onClick={confirmPlacement}>Confirm placement</button>}<button onClick={()=>{if(window.confirm('Discard current setup?')){setSetup(null);setSelection(null);}}}>Reset setup</button></div></>:<><div><strong>Local setup</strong><p className="muted">Pass the device between players. Place two settlements and roads each.</p></div><button onClick={()=>{setSelection(null);setSetup(createSetup(board,count,chooseFirstPlayer(count)));}}>Start setup</button></>}
  </section>
  {game?.winner!==null&&game?.winner!==undefined&&<section className="winner-banner" role="status"><h2>🏆 {game.players.find(p=>p.id===game.winner)?.name} wins!</h2><p>{playerScore(game,game.winner,true).total} victory points · {game.round} rounds</p><button onClick={()=>{setGame(null);setSetup(null);setSelection(null);}}>New game</button></section>}
  {view&&<section className="player-strip" aria-label="Players">{view.players.map(p=><div key={p.id} className={'player '+(playerId===p.id?'active':'')}><span className="swatch" style={{background:p.color}}/><div><strong>{p.name}</strong>{game&&<p className="score-line">🏆 {playerScore(game,p.id,p.id===playerId||game.phase==='finished').total}/{VICTORY_TARGET} · 🛤️ {game.awards.roadLengths[p.id]} · ⚔️ {game.development.knights[p.id]}{game.awards.longestRoad===p.id?' · 🏅 Road':''}{game.awards.largestArmy===p.id?' · 🏅 Army':''}</p>}<p>{view.settlements.filter(s=>s.playerId===p.id).length} settlements · {view.roads.filter(s=>s.playerId===p.id).length} roads</p><p>{game&&p.id!==playerId?Object.values(p.resources).reduce((a,b)=>a+b,0)+' cards':Object.entries(p.resources).filter(([,n])=>n>0).map(([k,n])=>resourceEmoji[k as keyof typeof resourceEmoji]+' '+n).join(' · ')||'No resources'}</p></div></div>)}</section>}
  {game&&<section className="setup-bar"><div><strong>Construction</strong><p className="muted">{RESOURCES.filter(k=>COSTS[build][k]>0).map(k=>resourceEmoji[k]+' '+terrain[k].resource+' ×'+COSTS[build][k]).join(' · ')} · {legal.length} available sites</p></div><div className="sizes">{(['road','settlement','city'] as BuildKind[]).map(k=><button key={k} aria-pressed={build===k} disabled={game.phase!=='action'||!!game.offer} onClick={()=>{setBuild(k);setSelection(null);}}>{({road:'🛤️',settlement:'🏠',city:'🏰'})[k]} {k}</button>)}<button disabled={!selectionLegal||game.phase!=='action'} onClick={confirmBuild}>Build selected</button></div></section>}
  {game&&game.dice&&<section className="setup-bar"><div><strong>Production this roll</strong><p className="muted">{game.players.map((p,i)=>p.name+': +'+Object.values(game.lastProduction[i]).reduce((a,b)=>a+b,0)).join(' · ')}{game.shortages.length?' · Bank shortage: '+game.shortages.map(k=>terrain[k].resource).join(', '):''}</p></div></section>}
  <div className="layout">
   <section className="board-panel" aria-label="Interactive island map">
    <div className="map-top"><span>ISLAND / {board.tiles.length} HEXES</span><div><button aria-label="Zoom out" disabled={zoom<=.75} onClick={()=>setZoom(z=>Math.max(.75,z-.25))}>−</button><button aria-label="Reset view" onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>Fit</button><button aria-label="Zoom in" disabled={zoom>=2.5} onClick={()=>setZoom(z=>Math.min(2.5,z+.25))}>+</button></div></div>
    <svg ref={svg} viewBox={[bounds.x+(bounds.w-viewW)/2+pan.x,bounds.y+(bounds.h-viewH)/2+pan.y,viewW,viewH].join(' ')} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{drag.current=null;}} aria-label="Hexagonal island; drag to pan">
      <defs><pattern id="waves" width="36" height="28" patternUnits="userSpaceOnUse"><path d="M0 14 Q9 7 18 14 T36 14" fill="none" stroke="#9ec1c2" opacity=".12"/></pattern></defs>
      <rect x={-10000} y={-10000} width={20000} height={20000} fill="url(#waves)"/>
      {board.tiles.map(t=>{const p=tilePosition(t,R),meta=terrain[t.terrain];return <g key={t.id} role="button" tabIndex={0} aria-label={meta.name+' '+(t.number??'desert')} aria-pressed={activeTile?.id===t.id} onClick={()=>select('tile',t.id)} onKeyDown={e=>keySelect(e,'tile',t.id)} className="tile">
        <polygon points={t.vertices.map(id=>{const v=points.get(id)!;return v.x+','+v.y;}).join(' ')} fill={meta.color} stroke={activeTile?.id===t.id?'#fff4c9':'#183a3e'} strokeWidth={activeTile?.id===t.id?4:2}/>
        <text x={p.x} y={p.y-14} className="terrain-symbol">{meta.icon}</text>
        {t.number!==null&&<><circle cx={p.x} cy={p.y+11} r={17} fill="#f3e5c8" stroke="#806e56"/><text x={p.x} y={p.y+12} className={'token '+(t.number===6||t.number===8?'red':'')}>{t.number}</text><text x={p.x} y={p.y+37} className="pips">{'•'.repeat(6-Math.abs(7-t.number))}</text></>}
        {game?.development.robber===t.id&&<text x={p.x+24} y={p.y-5} textAnchor="middle" fontSize="25" pointerEvents="none">🥷</text>}
      </g>;})}
      {board.harbors.map(h=>{const e=board.edges.find(e=>e.id===h.edgeId)!,a=points.get(e.a)!,b=points.get(e.b)!,t=board.tiles.find(t=>t.id===e.tiles[0])!,center=tilePosition(t,R),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=mx-center.x,dy=my-center.y,len=Math.hypot(dx,dy),x=mx+dx/len*28,y=my+dy/len*28;return <g key={h.edgeId} aria-label={(h.resource?terrain[h.resource].resource:'Generic')+' harbor '+h.rate+':1'} pointerEvents="none"><line x1={a.x} y1={a.y} x2={x} y2={y} stroke="#b8a57e" strokeWidth="2"/><line x1={b.x} y1={b.y} x2={x} y2={y} stroke="#b8a57e" strokeWidth="2"/><rect x={x-20} y={y-12} width={40} height={24} rx={7} fill="#e8d5aa" stroke="#806e56"/><text x={x} y={y+4} textAnchor="middle" fontSize={10} fill="#183a3e" fontWeight="bold">{h.resource?resourceEmoji[h.resource]:'⚓'} {h.rate}:1</text></g>;})}
      {board.edges.map(e=>{const a=points.get(e.a)!,b=points.get(e.b)!;const owner=view?.roads.find(x=>x.edgeId===e.id);const color=view?.players.find(p=>p.id===owner?.playerId)?.color;return <g key={e.id} role="button" tabIndex={0} aria-label={'Road edge '+e.id} aria-pressed={activeEdge?.id===e.id} onClick={()=>select('edge',e.id)} onKeyDown={ev=>keySelect(ev,'edge',e.id)} className="edge"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14}/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color??(activeEdge?.id===e.id?'#ffe39b':validEdges.has(e.id)?'#fff4c9':'#e4d7af')} opacity={color||activeEdge?.id===e.id||validEdges.has(e.id)?1:.55} strokeWidth={color?7:activeEdge?.id===e.id||validEdges.has(e.id)?5:1.5}/></g>;})}
      {board.vertices.map(v=>{const p=points.get(v.id)!;const owner=view?.settlements.find(x=>x.vertexId===v.id);const color=view?.players.find(x=>x.id===owner?.playerId)?.color;const city=game?.settlements.some(s=>s.vertexId===v.id&&s.kind==='city');return <g key={v.id} role="button" tabIndex={0} aria-label={'Building vertex '+v.id} aria-pressed={activeVertex?.id===v.id} onClick={()=>select('vertex',v.id)} onKeyDown={e=>keySelect(e,'vertex',v.id)} className="vertex"><circle cx={p.x} cy={p.y} r={11} fill="transparent"/>{color?<path d={`M ${p.x-8} ${p.y-1} L ${p.x} ${p.y-9} L ${p.x+8} ${p.y-1} V ${p.y+8} H ${p.x-8} Z`} fill={color} stroke="#15292e" strokeWidth={city?4:2}/>:<circle cx={p.x} cy={p.y} r={activeVertex?.id===v.id?7:validVertices.has(v.id)?5:3.5} fill={activeVertex?.id===v.id||validVertices.has(v.id)?'#ffe39b':'#e4d7af'} stroke="#24434a" strokeWidth={1}/>} {city&&<text x={p.x} y={p.y+5} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#15292e" pointerEvents="none">II</text>}</g>;})}
    </svg>
    <p className="map-help">Drag to pan · + / − to zoom · select a hex, junction or road</p>
   </section>
   <aside>{game&&<DevelopmentPanel key={game.active+":"+game.turn} board={board} game={game} selectedTile={activeTile?.id} onSelectTile={id=>select('tile',id)} selectedEdge={activeEdge?.id} onChange={s=>{setGame(s);setSelection(null);}}/>}{game&&<TradePanel key={game.active+":"+game.turn} board={board} game={game} onChange={s=>{setGame(s);setSelection(null);}}/>}{game&&<section className="panel"><h2>Resource bank</h2><dl>{RESOURCES.map(k=><div className="bank-row" key={k}><dt>{resourceEmoji[k]} {terrain[k].resource}</dt><dd>{game.bank[k]}</dd></div>)}</dl></section>}<section className="panel"><h2>Cartographer</h2><p className="muted">Seed: {seed}</p><dl><dt>Hexes</dt><dd>{board.tiles.length}</dd><dt>Building sites</dt><dd>{board.vertices.length}</dd><dt>Road segments</dt><dd>{board.edges.length}</dd></dl></section>
   <section className="panel" aria-live="polite"><h2>Selection</h2>{activeTile?<><strong>{terrain[activeTile.terrain].name}</strong><p>Resource: {terrain[activeTile.terrain].resource}</p><p>Production token: {activeTile.number??'None'}</p></>:activeVertex?<><strong>Building junction</strong><p>{activeVertex.id} · {activeVertex.tiles.length} adjacent hexes</p></>:activeEdge?<><strong>Road segment</strong><p>{activeEdge.tiles.length} adjacent hexes · {activeEdge.tiles.length===1?'Coast':'Inland'}</p></>:<p className="muted">Select a map feature to inspect it. Start local setup to place buildings and roads.</p>}</section>
   <section className="panel"><h2>Terrain</h2>{(Object.keys(terrain) as Terrain[]).map(t=><div key={t} className="legend"><span style={{background:terrain[t].color}} className="swatch"/><span>{terrain[t].name}</span><span>{board.tiles.filter(x=>x.terrain===t).length}</span></div>)}</section></aside>
  </div>
  <footer>Local base game · First to 10 victory points · Bots and online multiplayer are pending.</footer>
 </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
