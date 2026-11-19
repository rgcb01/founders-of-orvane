import {useLayoutEffect,useState,type RefObject,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {VisualEvent} from './visualEvents';
import {resourceEmoji} from './resources';
type Point={x:number;y:number};
type FlightStyle={label:string;style:CSSProperties};
export function IncomeFlights({event,svg,points,duration}:{event:VisualEvent;svg:RefObject<SVGSVGElement|null>;points:Map<string,Point>;duration:number}){
 const [items,setItems]=useState<FlightStyle[]>([]);
 useLayoutEffect(()=>{
   if(event.kind!=='income'||!svg.current)return;
   const matrix=svg.current.getScreenCTM();if(!matrix)return;
   const result:FlightStyle[]=[];
   for(const f of event.flights){
     const p=points.get(f.vertexId);if(!p)continue;
     const targets=Array.from(document.querySelectorAll<HTMLElement>('[data-income-target="'+f.resource+'"]'));
     const target=targets.find(t=>{const b=t.getBoundingClientRect();return b.width>0&&b.height>0&&b.bottom>0&&b.top<window.innerHeight;});
     if(!target)continue;
     const to=target.getBoundingClientRect(),from=new DOMPoint(p.x,p.y).matrixTransform(matrix);
     const x=Math.max(16,Math.min(window.innerWidth-16,from.x)),y=Math.max(16,Math.min(window.innerHeight-16,from.y));
     result.push({label:resourceEmoji[f.resource]+(f.count>1?'×'+f.count:''),style:{left:x,top:y,'--dx':(to.x+to.width/2-x)+'px','--dy':(to.y+to.height/2-y)+'px',animationDuration:duration+'ms'} as CSSProperties});
   }
   setItems(result);
 },[event,svg,points,duration]);
 return createPortal(<div className="income-layer" aria-hidden="true">{items.map((f,i)=><span key={i} className="income-flight" style={f.style}>{f.label}</span>)}</div>,document.body);
}
