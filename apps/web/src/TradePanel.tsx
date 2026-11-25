import {useState,useEffect,useRef,type FormEvent} from 'react';
import {applyGame,tradeRate,emptyResources,RESOURCES,type Resource,type Resources,type Board,type GameState,type TradeAction} from '@orvane/engine';
import {resourceEmoji,resourceName} from './resources';
import {ResourceFace} from './ResourceArt';
function TradeCards({bundle}:{bundle:Resources}){return <div className="trade-card-lane" aria-label={describe(bundle)||'No cards'}>{RESOURCES.flatMap(k=>Array.from({length:Math.min(24,Math.max(0,Math.floor(bundle[k]||0)))},(_,i)=><span className="trade-mini-card" key={k+i}><ResourceFace resource={k}/></span>))}</div>;}

const describe=(b:Resources)=>RESOURCES.filter(k=>b[k]).map(k=>resourceEmoji[k]+' '+b[k]).join(' + ');
export function TradePanel({board,game,onChange,humanActive}:{board:Board;game:GameState;onChange:(s:GameState)=>void;humanActive:boolean}){
 const [give,setGive]=useState<Resource>('forest'),[want,setWant]=useState<Resource>('hill');
 const [target,setTarget]=useState(game.players.find(p=>p.id!==game.active)!.id);
 const [offerGive,setOfferGive]=useState<Resources>(emptyResources),[offerWant,setOfferWant]=useState<Resources>(emptyResources);
 const [error,setError]=useState('');
 const actor=game.players.find(p=>p.id===game.active)!;
 const offer=game.offer;
 const responder=offer?game.players.find(p=>p.id===offer.to):undefined;
 const rate=tradeRate(board,game,game.active,give);
 const send=(action:TradeAction)=>{try{onChange(applyGame(board,game,action));setError('');setOfferGive(emptyResources());setOfferWant(emptyResources());}catch(e){setError(e instanceof Error?e.message:'Invalid trade');}};
 const submit=(e:FormEvent)=>{e.preventDefault();send(offer?{kind:'counter',playerId:offer.to,give:offerGive,want:offerWant}:{kind:'offer',playerId:game.active,to:target,give:offerGive,want:offerWant});};
 const disabled=game.phase!=='action';
 const panel=useRef<HTMLElement|null>(null);
 useEffect(()=>{const el=panel.current;if(!el)return;const drop=(e:Event)=>{const k=(e as CustomEvent<Resource>).detail;if(disabled||offer||!humanActive||!RESOURCES.includes(k)||actor.resources[k]<1)return;const target=(e.target as HTMLElement).closest<HTMLElement>('[data-card-drop]');if(target?.dataset.cardDrop==='bank')setGive(k);if(target?.dataset.cardDrop==='offer'&&!game.paired)setOfferGive(v=>({...v,[k]:Math.min(actor.resources[k],v[k]+1)}));};el.addEventListener('orvane-card-drop',drop);return()=>el.removeEventListener('orvane-card-drop',drop);},[disabled,offer,humanActive,actor,game.paired]);
 return <section className="panel trade-panel" ref={panel} id="trading-post">
 <h2>⚓ Trading post</h2>

 {!offer&&humanActive&&<div className="trade-box"><strong>🏦 Bank & harbors</strong><div className="trade-line">
 <label data-card-drop="bank">Give {rate}<select value={give} onChange={e=>setGive(e.target.value as Resource)}>{RESOURCES.map(k=><option key={k} value={k}>{resourceEmoji[k]} {resourceName[k]} ({tradeRate(board,game,game.active,k)}:1)</option>)}</select></label>
 <span>⇄</span><label>Receive 1<select value={want} onChange={e=>setWant(e.target.value as Resource)}>{RESOURCES.map(k=><option key={k} value={k}>{resourceEmoji[k]} {resourceName[k]}</option>)}</select></label>
 <button disabled={disabled||give===want||actor.resources[give]<rate||game.bank[want]<1} onClick={()=>send({kind:'bankTrade',playerId:game.active,give,want})}>Exchange</button></div></div>}
 {offer&&<div className="trade-box" aria-live="polite"><strong>🤝 {game.players.find(p=>p.id===offer.from)?.name} → {responder?.name}</strong><div className="trade-preview"><div><small>They give</small><TradeCards bundle={offer.give}/></div><span>⇄</span><div><small>You give</small><TradeCards bundle={offer.want}/></div></div><p className="muted">Pass the device to {responder?.name} to respond.</p><p>{responder&&describe(responder.resources)||'No resources'}</p><div className="sizes"><button disabled={!responder||RESOURCES.some(k=>responder.resources[k]<offer.want[k])} onClick={()=>send({kind:'accept',playerId:offer.to})}>Accept</button><button onClick={()=>send({kind:'reject',playerId:offer.to})}>Reject</button>{humanActive&&<button onClick={()=>send({kind:'cancel',playerId:game.active})}>Cancel</button>}</div></div>}
 {game.paired?<p className="muted">Paired action: bank and harbor trade only.</p>:<form className="offer-form" onSubmit={submit}><strong>{offer?'↪ Counteroffer':'🤝 Player offer'}</strong>
 {!offer&&<label>Partner <select value={target} onChange={e=>setTarget(Number(e.target.value))}>{game.players.filter(p=>p.id!==game.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
 <div className="trade-preview"><div data-card-drop="offer"><small>You give · drop cards here</small><TradeCards bundle={offerGive}/></div><span>⇄</span><div><small>You receive</small><TradeCards bundle={offerWant}/></div></div>{([{label:'Give',bundle:offerGive,set:setOfferGive},{label:'Want',bundle:offerWant,set:setOfferWant}]).map(({label,bundle,set})=><div className="trade-picker" key={label}><small>{label==='Give'?'Offer cards':'Request cards'}</small><div className="trade-picker-cards">{RESOURCES.map(k=><div className="trade-pick" key={k}><button type="button" className="trade-pick-face" aria-label={'Add '+label.toLowerCase()+' '+resourceName[k]} disabled={bundle[k]>=24||(label==='Give'&&bundle[k]>=((offer?responder:actor)?.resources[k]??0))} onClick={()=>set(v=>({...v,[k]:v[k]+1}))}><ResourceFace resource={k}/></button><div className="trade-pick-count"><button type="button" aria-label={'Remove '+label.toLowerCase()+' '+resourceName[k]} disabled={!bundle[k]} onClick={()=>set(v=>({...v,[k]:Math.max(0,v[k]-1)}))}>−</button><b>{bundle[k]}</b></div></div>)}</div></div>)}
 <button type="submit" disabled={disabled||!RESOURCES.some(k=>offerGive[k]>0)||!RESOURCES.some(k=>offerWant[k]>0)||RESOURCES.some(k=>offerGive[k]>0&&offerWant[k]>0)}>{offer?'Send counteroffer':'Send offer'}</button>
 </form>}{error&&<p role="alert" className="trade-error">{error}</p>}
 </section>;
}
