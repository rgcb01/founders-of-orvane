import {tilePosition,type Board} from '@orvane/engine';
import type {VisualEvent} from './visualEvents';
import {CardArt} from './CardArt';
import {resourceEmoji} from './resources';
type Point={x:number;y:number};
export function BoardEffects({event,board,points,r,duration,color}:{event:VisualEvent;board:Board;points:Map<string,Point>;r:number;duration:number;color:string}){
 const time=duration+'ms';
 const tile=(id:string)=>{const t=board.tiles.find(t=>t.id===id);return t?tilePosition(t,r):null;};
 const ring=(p:Point,key:string)=><circle key={key} cx={p.x} cy={p.y} r={18} fill="none" stroke="#fff4c9" strokeWidth={4} className="event-ring" style={{animationDuration:time}}/>;
 if(event.kind==='production')return <g className="board-effects" aria-hidden="true">
   {event.tiles.map(id=>{const t=board.tiles.find(t=>t.id===id)!;return <polygon key={id} points={t.vertices.map(v=>{const p=points.get(v)!;return p.x+','+p.y;}).join(' ')} fill="#ffe39b" fillOpacity=".25" stroke="#fff4c9" strokeWidth="4" className="production-glow" style={{animationDuration:time}}/>;})}
   {event.flights.map((f,i)=>{const a=tile(f.tileId),b=points.get(f.vertexId);if(!a||!b)return null;return <g key={i}><text textAnchor="middle" fontSize="20" className="resource-flight">{resourceEmoji[f.resource]}{f.count>1?'×'+f.count:''}<animateMotion path={'M '+a.x+' '+a.y+' L '+b.x+' '+(b.y-8)} dur={time} fill="freeze"/></text>{ring(b,'r'+i)}</g>;})}
 </g>;
 if(event.kind==='road'){const e=board.edges.find(x=>x.id===event.id);if(!e)return null;const a=points.get(e.a)!,b=points.get(e.b)!;return <g className="board-effects" aria-hidden="true"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff4c9" strokeWidth="12" strokeLinecap="round" pathLength="1" className="road-reveal" style={{animationDuration:time}}/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="7" strokeLinecap="round" pathLength="1" className="road-reveal" style={{animationDuration:time}}/></g>;}
 if(event.kind==='settlement'||event.kind==='city'){const p=points.get(event.id);if(!p)return null;return <g className="board-effects" aria-hidden="true">{ring(p,'build')}<g transform={'translate('+p.x+' '+p.y+')'}><text textAnchor="middle" y="-12" fontSize="30" className="building-pop" style={{animationDuration:time}}>{event.kind==='city'?'🏰':'🏠'}</text></g></g>;}
 if(event.kind==='robber'){const a=tile(event.from),b=tile(event.to);if(!a||!b)return null;return <g className="board-effects" aria-hidden="true">{ring(b,'robber')}<text textAnchor="middle" fontSize="32">🥷<animateMotion path={'M '+a.x+' '+a.y+' Q '+((a.x+b.x)/2)+' '+(Math.min(a.y,b.y)-65)+' '+b.x+' '+b.y} dur={time} fill="freeze"/></text></g>;}
 return null;
}
export function EventStage({event,name,other,duration,color}:{event:VisualEvent;name:string;other:string;duration:number;color:string}){
 const symbols:Record<VisualEvent['kind'],string>={dice:'🎲',production:'🌾',income:'🎒',road:'🛤️',settlement:'🏠',city:'🏰',robber:'🥷',trade:'🤝',offer:'🤝',card:'🃏',award:'🏅',victory:'🏆',turn:'🎲',discard:'🃏'};
 return <div className={'event-stage event-'+event.kind} style={{borderColor:color,animationDuration:duration+'ms'}} role="status" aria-label={name+' '+event.kind}>
  <span className="event-actor" style={{borderColor:color}}>{name}</span>
  {event.kind==='dice'?<div className="animated-dice">{event.dice.map((n,i)=><span key={i} className="rolling-die" style={{animationDuration:Math.min(duration,600)+'ms'}}>{['⚀','⚁','⚂','⚃','⚄','⚅'][n-1]}</span>)}<b>{event.dice[0]+event.dice[1]}</b></div>:event.kind==='card'?<div className="played-card" style={{animationDuration:duration+'ms'}}><CardArt kind={event.card}/></div>:event.kind==='trade'||event.kind==='offer'?<div className="exchange-stage"><span>{name}</span><span className="exchange-flow">{event.give} →<br/>← {event.want}</span><span>{other}</span></div>:<div className="event-symbol" style={{animationDuration:duration+'ms'}}>{'symbol' in event?event.symbol:symbols[event.kind]}{(event.kind==='production'||event.kind==='income')&&<span className="event-count"> +{event.flights.reduce((n,f)=>n+f.count,0)}</span>}</div>}
 </div>;
}
