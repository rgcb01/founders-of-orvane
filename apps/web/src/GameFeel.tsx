import type {CSSProperties} from 'react';
import {RESOURCES} from '@orvane/engine';
import {resourceEmoji} from './resources';
import type {VisualEvent} from './visualEvents';
const pipPositions:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
export function DicePair({dice,duration}:{dice:[number,number];duration:number}){
 return <div className="dice-table" aria-label={'Dice '+dice.join(' + ')+' = '+(dice[0]+dice[1])}>{dice.map((n,i)=><div className={'physical-die die-'+i} key={i} style={{animationDuration:duration+'ms'}} aria-hidden="true">{Array.from({length:9},(_,j)=><i key={j} className={pipPositions[n].includes(j)?'pip on':'pip'}/>)}</div>)}<b className="dice-total" style={{animationDuration:duration+'ms'}}>{dice[0]+dice[1]}</b></div>;
}
export function TransferStage({event,name,other,duration}:{event:Extract<VisualEvent,{kind:'trade'|'offer'}>|Extract<VisualEvent,{kind:'steal'}>;name:string;other:string;duration:number}){
 const steal=event.kind==='steal',offer=event.kind==='offer';
 return <div className={'transfer-stage'+(offer?' proposed':'')} aria-label={steal?other+' loses one hidden card to '+name:offer?'Trade proposal':'Completed trade'}>
   <span className="transfer-person">{name}</span><div className="transfer-lanes">
   {!steal&&<div className="transfer-lane"><span className="transfer-token outgoing" style={{animationDuration:duration+'ms'}}>{event.give}</span><span aria-hidden="true">→</span></div>}
   <div className="transfer-lane"><span className="transfer-token incoming" style={{animationDuration:duration+'ms'}}>{steal?'🂠':event.want}</span><span aria-hidden="true">←</span></div></div>
   <span className="transfer-person">{other}</span>{offer&&<small>Proposed exchange · not yet accepted</small>}
 </div>;
}
export function SpendStage({event,duration}:{event:Extract<VisualEvent,{kind:'spend'}>;duration:number}){
 return <div className="spend-stage">{RESOURCES.filter(k=>(event.resources[k]??0)>0).map(k=><span key={k} style={{animationDuration:duration+'ms'}}>{resourceEmoji[k]} −{event.resources[k]}</span>)}<b>{event.build==='city'?'🏰':event.build==='settlement'?'🏠':'🛤️'}</b></div>;
}
export function Confetti({duration}:{duration:number}){
 return <div className="confetti" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{'--x':((i*47)%100)+'%','--drift':((i*37)%100-50)+'px','--spin':(i%2?360:-360)+'deg',background:['#e4bf70','#89bca4','#ef9b78','#8baacb'][i%4],animationDuration:duration+'ms',animationDelay:(i%5)*40+'ms'} as CSSProperties}/>)}</div>;
}
