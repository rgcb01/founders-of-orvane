import {effectPalette} from './PieceArt';
import type {CSSProperties} from 'react';
import {RESOURCES,type Resource} from '@orvane/engine';
import {ResourceFace} from './ResourceArt';
import type {VisualEvent} from './visualEvents';
const pipPositions:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function DieFace({value,face}:{value:number;face:string}){
 return <span className={'cube-face cube-'+face}>{Array.from({length:9},(_,j)=><i key={j} className={pipPositions[value].includes(j)?'pip on':'pip'}/>)}</span>;
}
export function DicePair({dice,duration}:{dice:[number,number];duration:number}){
 return <div className="dice-table physical-table" aria-label={'Dice '+dice.join(' + ')+' = '+(dice[0]+dice[1])}>
 {dice.map((n,i)=>{const side=[1,2,3,4,5,6].filter(v=>v!==n&&v!==7-n);return <div className={'dice-landing landing-'+i} key={i} aria-hidden="true" style={{animationDuration:duration+'ms'}}><span className="dice-shadow" style={{animationDuration:duration+'ms'}}/><div className={'physical-die cube-die die-'+i} style={{animationDuration:duration+'ms'}}><DieFace value={n} face="front"/><DieFace value={7-n} face="back"/><DieFace value={side[0]} face="right"/><DieFace value={7-side[0]} face="left"/><DieFace value={side.find(v=>v!==side[0]&&v!==7-side[0])!} face="top"/><DieFace value={7-side.find(v=>v!==side[0]&&v!==7-side[0])!} face="bottom"/></div></div>})}
 <b className="dice-total" style={{animationDuration:duration+'ms'}}>{dice[0]+dice[1]}</b></div>;
}
function TransferCards({cards,hidden=false,incoming=false,duration,proposal=false}:{cards:Resource[];hidden?:boolean;incoming?:boolean;duration:number;proposal?:boolean}){
 const items=hidden?[null]:cards;
 return <div className={'transfer-lane card-exchange-lane'+(proposal?' static-exchange':'')} aria-hidden="true">
 {items.map((resource,i)=>{const delay=proposal?0:Math.min(duration*.38,i*60);return <span key={i} className={'exchange-card '+(incoming?'exchange-in':'exchange-out')} style={{'--card-offset':(i-(items.length-1)/2)*Math.min(12,70/Math.max(1,items.length-1))+'px',animationDelay:delay+'ms',animationDuration:(duration-delay)+'ms'} as CSSProperties}>{resource?<ResourceFace resource={resource}/>:<span className="resource-card-back"><span>◇</span></span>}</span>})}
 </div>;
}
export function TransferStage({event,name,other,duration}:{event:Extract<VisualEvent,{kind:'trade'|'offer'}>|Extract<VisualEvent,{kind:'steal'}>;name:string;other:string;duration:number}){
 const steal=event.kind==='steal',offer=event.kind==='offer';
 const cards=(bundle:Partial<Record<Resource,number>>|undefined)=>RESOURCES.flatMap(k=>Array.from({length:bundle?.[k]??0},()=>k));
 return <div className={'transfer-stage'+(offer?' proposed':'')} aria-label={steal?other+' loses one hidden card to '+name:offer?'Trade proposal: '+event.give+' for '+event.want:'Completed trade: '+event.give+' for '+event.want}>
 <span className="transfer-person">{name}</span><div className="transfer-lanes">
 {!steal&&<TransferCards cards={cards(event.giveCards)} duration={duration} proposal={offer}/>}
 <TransferCards cards={steal?[]:cards(event.wantCards)} hidden={steal} incoming duration={duration} proposal={offer}/>
 </div><span className="transfer-person">{other}</span>{offer&&<small>Proposed exchange · not yet accepted</small>}
 </div>;
}
export function SpendStage({event,duration}:{event:Extract<VisualEvent,{kind:'spend'}>;duration:number}){
 return <div className="spend-stage spend-cards">{RESOURCES.flatMap(k=>Array.from({length:event.resources[k]??0},(_,i)=><span className="spend-single" key={k+i} style={{animationDuration:duration+'ms'}}><ResourceFace resource={k}/></span>))}<b>{event.build==='city'?'🏰':event.build==='settlement'?'🏠':'🛤️'}</b></div>;
}
export function Confetti({duration,effectId='classic-effects'}:{duration:number;effectId?:string}){
 return <div className="confetti" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{'--x':((i*47)%100)+'%','--drift':((i*37)%100-50)+'px','--spin':(i%2?360:-360)+'deg',background:effectPalette(effectId)[i%4],animationDuration:duration+'ms',animationDelay:(i%5)*40+'ms'} as CSSProperties}/>)}</div>;
}
