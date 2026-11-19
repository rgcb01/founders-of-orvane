import {tilePosition,type Board} from '@orvane/engine';
import type {VisualEvent} from './visualEvents';
type Point={x:number;y:number};
type Bounds={x:number;y:number;w:number;h:number};
export function focusPoints(event:VisualEvent,board:Board,points:Map<string,Point>,r:number):Point[]{
 const tile=(id:string)=>{const t=board.tiles.find(t=>t.id===id);return t?tilePosition(t,r):undefined;};
 if(event.kind==='road'){const e=board.edges.find(e=>e.id===event.id);return e?[points.get(e.a)!,points.get(e.b)!]:[];}
 if(event.kind==='settlement'||event.kind==='city'){const p=points.get(event.id);return p?[p]:[];}
 if(event.kind==='robber'){const a=tile(event.from),b=tile(event.to);return [a,b].filter((p):p is Point=>!!p);}
 if(event.kind==='production')return event.tiles.map(tile).filter((p):p is Point=>!!p);
 return [];
}
export function cameraTarget(bounds:Bounds,zoom:number,pan:Point,points:Point[]):{pan:Point;zoom:number}|null{
 if(!points.length)return null;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const cx=bounds.x+bounds.w/2,cy=bounds.y+bounds.h/2;
 const w=bounds.w/zoom,h=bounds.h/zoom;
 if(minX>=cx+pan.x-w*.4&&maxX<=cx+pan.x+w*.4&&minY>=cy+pan.y-h*.4&&maxY<=cy+pan.y+h*.4)return null;
 const z=Math.max(.75,Math.min(zoom,bounds.w/Math.max(1,maxX-minX+110),bounds.h/Math.max(1,maxY-minY+110)));
 const clamp=(x:number,m:number)=>Math.max(-m,Math.min(m,x));
 return {zoom:z,pan:{x:clamp((minX+maxX)/2-cx,Math.max(0,(bounds.w-bounds.w/z)/2)),y:clamp((minY+maxY)/2-cy,Math.max(0,(bounds.h-bounds.h/z)/2))}};
}
