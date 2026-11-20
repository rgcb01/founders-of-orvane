/** ViewBox math for touch gestures. Coordinates are CSS pixels for input, world units for state. */
export type Point={x:number;y:number};
export type Rect={left:number;top:number;width:number;height:number};
export type Bounds={x:number;y:number;w:number;h:number};
export const MIN_ZOOM=.75,MAX_ZOOM=3;
export const clampZoom=(v:number)=>Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,v));
const scale=(bounds:Bounds,rect:Rect)=>Math.min(rect.width/bounds.w,rect.height/bounds.h);
export function localPoint(bounds:Bounds,rect:Rect,client:Point):Point{
 const s=scale(bounds,rect);
 if(!Number.isFinite(s)||s<=0)return {x:bounds.w/2,y:bounds.h/2};
 return {x:(client.x-rect.left-(rect.width-bounds.w*s)/2)/s,y:(client.y-rect.top-(rect.height-bounds.h*s)/2)/s};
}
export function clampPan(bounds:Bounds,zoom:number,pan:Point):Point{
 // Allow small framing adjustments at fit, but never lose the entire island.
 const mx=Math.max(0,(bounds.w-bounds.w/zoom)/2)+bounds.w*.12;
 const my=Math.max(0,(bounds.h-bounds.h/zoom)/2)+bounds.h*.12;
 return {x:Math.max(-mx,Math.min(mx,pan.x)),y:Math.max(-my,Math.min(my,pan.y))};
}
export function worldAt(bounds:Bounds,rect:Rect,zoom:number,pan:Point,client:Point):Point{
 const local=localPoint(bounds,rect,client);
 return {x:bounds.x+bounds.w/2+pan.x+(local.x-bounds.w/2)/zoom,y:bounds.y+bounds.h/2+pan.y+(local.y-bounds.h/2)/zoom};
}
export function panAroundWorld(bounds:Bounds,rect:Rect,anchor:Point,client:Point,zoom:number):Point{
 const local=localPoint(bounds,rect,client);
 return clampPan(bounds,zoom,{x:anchor.x-(bounds.x+bounds.w/2)-(local.x-bounds.w/2)/zoom,y:anchor.y-(bounds.y+bounds.h/2)-(local.y-bounds.h/2)/zoom});
}
export function dragPan(bounds:Bounds,rect:Rect,zoom:number,startPan:Point,start:Point,current:Point):Point{
 const s=scale(bounds,rect)*zoom;if(s<=0)return startPan;
 return clampPan(bounds,zoom,{x:startPan.x-(current.x-start.x)/s,y:startPan.y-(current.y-start.y)/s});
}
export function mid(a:Point,b:Point):Point{return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
export function distance(a:Point,b:Point):number{return Math.hypot(a.x-b.x,a.y-b.y);}

/** Fuzzy targets let a finger land near legal junctions/roads without selecting a tile by accident. */
export function nearestVertex(points:Map<string,Point>,legal:ReadonlySet<string>,at:Point,radius:number):string|null{
 let id:string|null=null,best=radius;
 for(const key of legal){const p=points.get(key);if(!p)continue;const d=distance(p,at);if(d<best){best=d;id=key;}}
 return id;
}
export function segmentDistance(at:Point,a:Point,b:Point):number{
 const dx=b.x-a.x,dy=b.y-a.y,denom=dx*dx+dy*dy;
 const t=denom===0?0:Math.max(0,Math.min(1,((at.x-a.x)*dx+(at.y-a.y)*dy)/denom));
 return distance(at,{x:a.x+t*dx,y:a.y+t*dy});
}
export function nearestEdge(edges:readonly {id:string;a:string;b:string}[],points:Map<string,Point>,legal:ReadonlySet<string>,at:Point,radius:number):string|null{
 let id:string|null=null,best=radius;
 for(const edge of edges){if(!legal.has(edge.id))continue;const a=points.get(edge.a),b=points.get(edge.b);if(!a||!b)continue;
   const d=segmentDistance(at,a,b);if(d<best){best=d;id=edge.id;}}
 return id;
}
