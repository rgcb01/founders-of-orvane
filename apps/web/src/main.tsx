import {StrictMode,useMemo,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {generateBoard,tilePosition,vertexPosition,type BoardSize,type Terrain} from '@orvane/engine';
import './style.css';

const terrain:Record<Terrain,{name:string;icon:string;color:string;resource:string}>={
 forest:{name:'Forest',icon:'▲',color:'#4c7957',resource:'Lumber'},
 pasture:{name:'Pasture',icon:'✿',color:'#a2b96c',resource:'Wool'},
 field:{name:'Field',icon:'≋',color:'#d8b45b',resource:'Grain'},
 hill:{name:'Hills',icon:'◆',color:'#bb7350',resource:'Brick'},
 mountain:{name:'Mountain',icon:'⛰',color:'#7d8795',resource:'Ore'},
 desert:{name:'Desert',icon:'○',color:'#c9a97c',resource:'None'}
};
type Selection={kind:'tile'|'vertex'|'edge';id:string};
const R=49;
function App(){
 const [size,setSize]=useState<BoardSize>('extended');
 const [seed,setSeed]=useState('orvane-001');
 const [draft,setDraft]=useState(seed);
 const [selection,setSelection]=useState<Selection|null>(null);
 const [zoom,setZoom]=useState(1);
 const [pan,setPan]=useState({x:0,y:0});
 const svg=useRef<SVGSVGElement>(null);
 const drag=useRef<{id:number;x:number;y:number;panX:number;panY:number;moved:boolean}|null>(null);
 const board=useMemo(()=>generateBoard(seed,size),[seed,size]);
 const points=useMemo(()=>new Map(board.vertices.map(v=>[v.id,vertexPosition(v,R)])),[board]);
 const bounds=useMemo(()=>{
   const p=[...points.values()],xs=p.map(v=>v.x),ys=p.map(v=>v.y);
   return {x:Math.min(...xs)-42,y:Math.min(...ys)-42,w:Math.max(...xs)-Math.min(...xs)+84,h:Math.max(...ys)-Math.min(...ys)+84};
 },[points]);
 const activeTile=selection?.kind==='tile'?board.tiles.find(t=>t.id===selection.id):undefined;
 const activeVertex=selection?.kind==='vertex'?board.vertices.find(t=>t.id===selection.id):undefined;
 const activeEdge=selection?.kind==='edge'?board.edges.find(t=>t.id===selection.id):undefined;
 const setBoard=(s:BoardSize,seed:string)=>{setSize(s);setSeed(seed);setDraft(seed);setSelection(null);setPan({x:0,y:0});setZoom(1);};
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
  <header><div><p className="eyebrow">ORVANE / FIELD NOTES</p><h1>Founders of Orvane</h1><p className="subtitle">Build. Trade. Explore. Prosper.</p></div><span className="version">v0.1.0 · Board explorer</span></header>
  <section className="toolbar" aria-label="Board settings">
    <div className="sizes"><button aria-pressed={size==='standard'} onClick={()=>setBoard('standard',seed)}>3–4 players</button><button aria-pressed={size==='extended'} onClick={()=>setBoard('extended',seed)}>5–6 players</button></div>
    <form onSubmit={e=>{e.preventDefault();if(draft.trim())setBoard(size,draft.trim());}}><label htmlFor="seed">Map seed</label><input id="seed" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={80} required/><button type="submit">Generate</button><button type="button" onClick={()=>setBoard(size,crypto.randomUUID().slice(0,12))}>Random</button></form>
  </section>
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
      </g>;})}
      {board.edges.map(e=>{const a=points.get(e.a)!,b=points.get(e.b)!;return <g key={e.id} role="button" tabIndex={0} aria-label={'Road edge '+e.id} aria-pressed={activeEdge?.id===e.id} onClick={()=>select('edge',e.id)} onKeyDown={ev=>keySelect(ev,'edge',e.id)} className="edge"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14}/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={activeEdge?.id===e.id?'#ffe39b':'#e4d7af'} opacity={activeEdge?.id===e.id?1:.55} strokeWidth={activeEdge?.id===e.id?5:1.5}/></g>;})}
      {board.vertices.map(v=>{const p=points.get(v.id)!;return <g key={v.id} role="button" tabIndex={0} aria-label={'Building vertex '+v.id} aria-pressed={activeVertex?.id===v.id} onClick={()=>select('vertex',v.id)} onKeyDown={e=>keySelect(e,'vertex',v.id)} className="vertex"><circle cx={p.x} cy={p.y} r={11} fill="transparent"/><circle cx={p.x} cy={p.y} r={activeVertex?.id===v.id?6:3.5} fill={activeVertex?.id===v.id?'#ffe39b':'#e4d7af'} stroke="#24434a" strokeWidth={1}/></g>;})}
    </svg>
    <p className="map-help">Drag to pan · + / − to zoom · select a hex, junction or road</p>
   </section>
   <aside><section className="panel"><h2>Cartographer</h2><p className="muted">Seed: {seed}</p><dl><dt>Hexes</dt><dd>{board.tiles.length}</dd><dt>Building sites</dt><dd>{board.vertices.length}</dd><dt>Road segments</dt><dd>{board.edges.length}</dd></dl></section>
   <section className="panel" aria-live="polite"><h2>Selection</h2>{activeTile?<><strong>{terrain[activeTile.terrain].name}</strong><p>Resource: {terrain[activeTile.terrain].resource}</p><p>Production token: {activeTile.number??'None'}</p></>:activeVertex?<><strong>Building junction</strong><p>{activeVertex.id} · {activeVertex.tiles.length} adjacent hexes</p></>:activeEdge?<><strong>Road segment</strong><p>{activeEdge.tiles.length} adjacent hexes · {activeEdge.tiles.length===1?'Coast':'Inland'}</p></>:<p className="muted">Select a map feature to inspect it. Construction arrives in v0.2.</p>}</section>
   <section className="panel"><h2>Terrain</h2>{(Object.keys(terrain) as Terrain[]).map(t=><div key={t} className="legend"><span style={{background:terrain[t].color}} className="swatch"/><span>{terrain[t].name}</span><span>{board.tiles.filter(x=>x.terrain===t).length}</span></div>)}</section></aside>
  </div>
  <footer>Development preview · No gameplay, bots, or networking yet.</footer>
 </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
