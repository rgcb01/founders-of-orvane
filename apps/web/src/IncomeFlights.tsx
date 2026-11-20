import {useLayoutEffect,useState,type RefObject,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {VisualEvent} from './visualEvents';
import {ResourceFace} from './ResourceArt';
import type {Resource} from '@orvane/engine';
type Point={x:number;y:number};
type FlightStyle={resource:Resource;count:number;style:CSSProperties};
export function IncomeFlights({event,svg,points,duration,spendPoint}:{event:VisualEvent;svg:RefObject<SVGSVGElement|null>;points:Map<string,Point>;duration:number;spendPoint?:Point}){
 const [items,setItems]=useState<FlightStyle[]>([]);
 useLayoutEffect(()=>{
   if((event.kind!=='income'&&event.kind!=='spend')||!svg.current)return;
   const matrix=svg.current.getScreenCTM();if(!matrix)return;
   const result:FlightStyle[]=[];
   for(const f of event.kind==='income'?event.flights:Object.entries(event.resources).filter(([,n])=>n>0).map(([resource,count])=>({resource:resource as Resource,count,vertexId:event.id}))){
     const p=event.kind==='spend'?spendPoint:points.get(f.vertexId);if(!p)continue;
     const targets=Array.from(document.querySelectorAll<HTMLElement>('[data-income-target="'+f.resource+'"]'));
     const target=targets.find(t=>{const b=t.getBoundingClientRect();return b.width>0&&b.height>0&&b.bottom>0&&b.top<window.innerHeight;});
     if(!target)continue;
     const to=target.getBoundingClientRect(),from=new DOMPoint(p.x,p.y).matrixTransform(matrix);
     const x=Math.max(16,Math.min(window.innerWidth-16,from.x)),y=Math.max(16,Math.min(window.innerHeight-16,from.y));
     const tx=to.x+to.width/2,ty=to.y+to.height/2,spend=event.kind==='spend';
     result.push({resource:f.resource,count:f.count,style:{left:spend?tx:x,top:spend?ty:y,'--dx':(spend?x-tx:tx-x)+'px','--dy':(spend?y-ty:ty-y)+'px',animationDuration:duration+'ms'} as CSSProperties});
   }
   setItems(result);
 },[event,svg,points,duration,spendPoint?.x,spendPoint?.y]);
 return createPortal(<div className="income-layer" aria-hidden="true">{items.map((f,i)=><span key={i} className={"income-flight card-flight "+(event.kind==="spend"?"card-spend":"card-gain")} style={f.style}><ResourceFace resource={f.resource} count={f.count}/></span>)}</div>,document.body);
}
