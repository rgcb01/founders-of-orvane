import {useState} from 'react';
import {applyGame,canBuy,canPlay,robberVictims,freeRoadSites,emptyResources,RESOURCES,type Board,type GameState,type GameAction,type Resource,type Resources} from '@orvane/engine';
import {resourceEmoji,resourceName} from './resources';
import {CardArt} from './CardArt';
export function DevelopmentPanel({board,game,onChange,selectedTile,selectedEdge,onSelectTile,humanActive}:{board:Board;game:GameState;onChange:(g:GameState)=>void;selectedTile?:string;selectedEdge?:string;onSelectTile:(id:string)=>void;humanActive:boolean}){
 const [discard,setDiscard]=useState<Resources>(emptyResources);
 const [victim,setVictim]=useState<number|null>(null);
 const [first,setFirst]=useState<Resource>('forest'),[second,setSecond]=useState<Resource>('hill');
 const [error,setError]=useState('');
 const d=game.development;
 const actor=game.players.find(p=>p.id===game.active)!;
 const pending=game.players.find(p=>d.discards[p.id]>0);
 const target=selectedTile??'';
 const validTarget=board.tiles.some(t=>t.id===target&&t.id!==d.robber);
 const victims=validTarget?robberVictims(board,game,target):[];
 const chosen=victim!==null&&victims.includes(victim)?victim:victims[0]??null;
 const sites=freeRoadSites(board,game);
 const send=(a:GameAction)=>{try{onChange(applyGame(board,game,a));setDiscard(emptyResources());setError('');setVictim(null);}catch(e){setError(e instanceof Error?e.message:'Invalid action');}};
 return <section className="panel development-panel" id="development-actions"><h2>🃏 Development & robber</h2>
 <p>Deck: {d.deck.length}{humanActive?' · ⚔️ Played knights: '+d.knights[actor.id]:''}</p>
 {game.phase==='discard'&&pending&&<div className="trade-box"><strong>🥷 {pending.name}: discard {d.discards[pending.id]}</strong><p className="muted">Pass the device to this player.</p>{RESOURCES.map(k=><label className="discard-row" key={k}>{resourceEmoji[k]} {resourceName[k]} ({pending.resources[k]})<input type="number" min={0} max={pending.resources[k]} value={discard[k]} onChange={e=>setDiscard({...discard,[k]:Number(e.target.value)})}/></label>)}<button disabled={Object.values(discard).reduce((a,b)=>a+b,0)!==d.discards[pending.id]} onClick={()=>send({kind:'discard',playerId:pending.id,resources:discard})}>Discard</button></div>}
 {game.phase==='robber'&&<div className="trade-box"><strong>🥷 Move robber</strong><p className="muted">Select a different hex on the map or below.</p><select value={validTarget?target:''} onChange={e=>{onSelectTile(e.target.value);setVictim(null);}}><option value="">Choose hex</option>{board.tiles.filter(t=>t.id!==d.robber).map(t=><option key={t.id} value={t.id}>{t.terrain} · {t.number??'desert'} ({t.id})</option>)}</select>{victims.length>0&&<select value={chosen??''} onChange={e=>setVictim(Number(e.target.value))}>{victims.map(id=><option key={id} value={id}>{game.players.find(p=>p.id===id)?.name}</option>)}</select>}<button disabled={!validTarget} onClick={()=>send({kind:'moveRobber',playerId:game.active,tileId:target,victim:chosen,random:Math.random()})}>Move & steal</button></div>}
 {game.phase==='freeRoad'&&<div className="trade-box"><strong>🛤️ Free roads left: {d.freeRoads}</strong><p className="muted">Select a highlighted road on the board.</p><button disabled={!selectedEdge||!sites.includes(selectedEdge)} onClick={()=>send({kind:'freeRoad',playerId:game.active,edgeId:selectedEdge!})}>Place free road</button></div>}
 {humanActive&&<><button disabled={!canBuy(game)} onClick={()=>send({kind:'buyCard',playerId:game.active})}>Buy 🃏 · 🐑 🌾 ⛰️</button>
 <p className="muted">{actor.name}'s cards (private hand in local play)</p>
 {d.hands[actor.id].length===0&&<p>No development cards.</p>}
 {d.hands[actor.id].some(c=>c.kind==='plenty'||c.kind==='monopoly')&&<div className="trade-line"><label>Resource<select value={first} onChange={e=>setFirst(e.target.value as Resource)}>{RESOURCES.map(k=><option key={k} value={k}>{resourceEmoji[k]} {resourceName[k]}</option>)}</select></label><label>Second<select value={second} onChange={e=>setSecond(e.target.value as Resource)}>{RESOURCES.map(k=><option key={k} value={k}>{resourceEmoji[k]} {resourceName[k]}</option>)}</select></label></div>}
 {d.hands[actor.id].map(c=><div className="card-item" key={c.id}><CardArt kind={c.kind}/>{c.kind==='victory'?<small>+1 hidden VP</small>:<button disabled={!canPlay(game,c)} onClick={()=>send({kind:'playCard',playerId:game.active,cardId:c.id,resource:first,resources:Object.values(game.bank).reduce((a,b)=>a+b,0)===1?[first]:[first,second]})}>Play</button>}</div>)}
 </>}{error&&<p role="alert" className="trade-error">{error}</p>}</section>;
}
