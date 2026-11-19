import {useState} from 'react';
import {soloStats,type Library,type SavedMatch} from './persistence';
export function SavedGames({library,onResume,onDelete,onBack}:{library:Library;onResume:(m:SavedMatch)=>void;onDelete:(id:string)=>void;onBack:()=>void}){
 const [confirm,setConfirm]=useState<string|null>(null);
 const stats=soloStats(library);
 return <section className="panel saved-games"><div className="save-heading"><button onClick={onBack}>← Main menu</button><h2>💾 Saved games</h2></div>
 <div className="save-stats"><div><strong>{stats.played}</strong><small>Solo games</small></div><div><strong>{stats.wins}</strong><small>Victories</small></div><div><strong>{stats.losses}</strong><small>Defeats</small></div></div>
 {library.matches.length===0&&<p className="muted">No saved matches yet. Start a game to create one automatically.</p>}
 {library.matches.map(m=><article key={m.id} className="save-item"><span className="save-icon">{m.game?.phase==='finished'?'🏆':'🏝️'}</span><div><strong>{m.seed}</strong><p>{m.preferences.count} players · {m.preferences.humans} human · {m.game?m.game.phase==='finished'?'Finished':'Round '+m.game.round:'Initial placement'}</p><small>{new Date(m.updatedAt).toLocaleString()}</small></div><div className="sizes"><button onClick={()=>onResume(m)}>{m.game?.phase==='finished'?'Review':'Continue'}</button>{confirm===m.id?<><button onClick={()=>{onDelete(m.id);setConfirm(null);}}>Confirm delete</button><button onClick={()=>setConfirm(null)}>Cancel</button></>:<button aria-label={'Delete '+m.seed} onClick={()=>setConfirm(m.id)}>🗑️</button>}</div></article>)}
 {library.results.length>0&&<details><summary>📜 Match history</summary>{library.results.map(r=><p key={r.id}>{r.humans===1?(r.winner===0?'🏆 Victory':'Defeat'):'🏆 '+r.winnerName} · {r.players} players · {r.rounds} rounds · {new Date(r.endedAt).toLocaleDateString()}</p>)}</details>}
 <p className="muted">Saves stay on this browser/device. Clearing site data can remove them.</p></section>;
}
