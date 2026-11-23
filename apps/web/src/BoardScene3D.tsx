import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {tilePosition,vertexPosition,type Board} from '@orvane/engine';
import {TERRAIN_COLORS} from './TerrainArt';

type BoardSelection={kind:'tile'|'vertex'|'edge';id:string};
type Pieces={roads:{edgeId:string;color:string}[];buildings:{vertexId:string;color:string;kind:'settlement'|'city'}[]};
export function BoardScene3D({board,onUnavailable,pieces,onSelect,legalVertices,legalEdges}:{board:Board;onUnavailable:()=>void;pieces?:Pieces;onSelect?:(selection:BoardSelection)=>void;legalVertices?:readonly string[];legalEdges?:readonly string[]}){
 const host=useRef<HTMLDivElement>(null);
 const [selected,setSelected]=useState<BoardSelection|null>(null);
 const selectionCallback=useRef(onSelect);selectionCallback.current=onSelect;
 const fallback=useRef(onUnavailable);fallback.current=onUnavailable;
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{fallback.current();return;}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#183e49');
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,500);
  const selectable:THREE.Object3D[]=[];
  const positions=board.tiles.map(t=>({tile:t,p:tilePosition(t,1)}));
  const bounds=new THREE.Box3();
  const geometry=new THREE.CylinderGeometry(.98,.98,.24,6);
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  const details:THREE.BufferGeometry[]=[];const detailMaterials=new Map<string,THREE.MeshStandardMaterial>();
  const add=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>{details.push(g);let m=detailMaterials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,flatShading:true,roughness:1});detailMaterials.set(color,m);}const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);scene.add(mesh);return mesh;};
  for(const {tile,p} of positions){
   const color=TERRAIN_COLORS[tile.terrain];
   let mat=materials.get(color);if(!mat){mat=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});materials.set(color,mat);}
   const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(p.x,0,p.y);scene.add(mesh);mesh.userData={selection:{kind:'tile',id:tile.id}};selectable.push(mesh);bounds.expandByObject(mesh);
   const x=p.x,z=p.y;
   switch(tile.terrain){
    case 'forest': for(const [dx,dz,h] of [[-.38,-.22,.58],[.24,-.34,.45],[.32,.24,.62],[-.25,.35,.4]]){add(new THREE.CylinderGeometry(.045,.06,.19,5),'#795740',x+dx,.21,z+dz);add(new THREE.ConeGeometry(.23,h*.7,5),'#315d45',x+dx,.26+h*.35,z+dz);add(new THREE.ConeGeometry(.16,h*.65,5),'#497458',x+dx,.35+h*.65,z+dz);}break;
    case 'pasture': for(const [dx,dz] of [[-.32,-.22],[.27,.15],[-.12,.38]]){add(new THREE.IcosahedronGeometry(.13,0),'#e0d9bd',x+dx,.24,z+dz).scale.set(1.4,.8,1);add(new THREE.IcosahedronGeometry(.055,0),'#665e50',x+dx+.14,.24,z+dz);}break;
    case 'field': for(let i=0;i<5;i++){add(new THREE.BoxGeometry(.13,.035,.85),'#8f713e',x+(i-2)*.18,.14,z);for(let j=0;j<5;j++)add(new THREE.ConeGeometry(.055,.15,4),'#e3bf65',x+(i-2)*.18,.22,z+(j-2)*.16);}break;
    case 'hill': for(const [dx,dz,h] of [[-.25,-.15,.27],[.28,.22,.36]]){add(new THREE.IcosahedronGeometry(.35,0),'#b67d55',x+dx,.12+h*.3,z+dz).scale.set(1,h/.35,1);}break;
    case 'mountain': for(const [dx,dz,h] of [[-.28,-.13,.85],[.30,.14,.62]]){add(new THREE.ConeGeometry(.36,h,5),'#697b85',x+dx,.12+h/2,z+dz);add(new THREE.ConeGeometry(.13,h*.35,5),'#e2e6df',x+dx,.12+h*.825,z+dz);}break;
    case 'desert': add(new THREE.SphereGeometry(.5,6,3),'#e2c18a',x,.12,z).scale.set(1,.24,.65);break;
   }
  }
  const vertices=new Map(board.vertices.map(v=>[v.id,vertexPosition(v,1)]));
  // Preview samples only; real matches will supply their own piece data.
  const sample:Pieces={roads:[],buildings:[]};
  const colors=['#bd5145','#4189b8','#e9d8b4','#de963f'];
  const occupied=new Set<string>();
  for(const [i,color] of colors.entries()){
   const edge=board.edges.find((e,j)=>j>=Math.floor(i*board.edges.length/4)&&!occupied.has(e.a)&&!occupied.has(e.b));
   if(!edge)continue;occupied.add(edge.a);occupied.add(edge.b);
   sample.roads.push({edgeId:edge.id,color});sample.buildings.push({vertexId:edge.a,color,kind:i%2?'city':'settlement'});
  }
  const display=pieces??sample;
  for(const road of display.roads){const edge=board.edges.find(e=>e.id===road.edgeId);if(!edge)continue;const a=vertices.get(edge.a),b=vertices.get(edge.b);if(!a||!b)continue;
   const length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);
   add(new THREE.BoxGeometry(length*.92,.11,.13),'#52463e',(a.x+b.x)/2,.17,(a.y+b.y)/2).rotation.y=-angle;
   const pick=add(new THREE.BoxGeometry(length*.9,.07,.18),road.color,(a.x+b.x)/2,.25,(a.y+b.y)/2);pick.rotation.y=-angle;pick.userData={selection:{kind:'edge',id:edge.id}};selectable.push(pick);
  }
  for(const building of display.buildings){const p=vertices.get(building.vertexId);if(!p)continue;
   const pick=add(new THREE.BoxGeometry(.49,.07,.43),'#746656',p.x,.17,p.y);pick.userData={selection:{kind:'vertex',id:building.vertexId}};selectable.push(pick);
   const house=(x:number,z:number,w:number,h:number)=>{add(new THREE.BoxGeometry(w,h,w*.85),building.color,x,.21+h/2,z);const roof=add(new THREE.CylinderGeometry(0,w*.77,w*.48,4),building.color,x,.21+h+w*.24,z);roof.rotation.y=Math.PI/4;add(new THREE.BoxGeometry(w*.22,h*.6,.025),'#443e37',x,.21+h*.3,z+w*.43);};
   if(building.kind==='city'){house(p.x-.12,p.y,.26,.36);house(p.x+.15,p.y+.04,.21,.24);}else house(p.x,p.y,.30,.23);
  }
  // Invisible selection volumes cover every buildable graph location, including empty sites.
  // Keep them separate from visible meshes so construction remains possible before ownership.
  const legalVertexSet=new Set(legalVertices??[]),legalEdgeSet=new Set(legalEdges??[]);
  const pickGeometry:THREE.BufferGeometry[]=[];
  const pickMaterial=new THREE.MeshBasicMaterial({visible:false,depthWrite:false});
  const pickObjects:THREE.Object3D[]=[];
  for(const vertex of board.vertices){
   const p=vertices.get(vertex.id);if(!p)continue;
   const g=new THREE.SphereGeometry(.20,8,6);pickGeometry.push(g);
   const mesh=new THREE.Mesh(g,pickMaterial);mesh.position.set(p.x,.32,p.y);mesh.userData={selection:{kind:'vertex',id:vertex.id}};scene.add(mesh);pickObjects.push(mesh);
   if(legalVertexSet.has(vertex.id))add(new THREE.TorusGeometry(.19,.035,6,12),'#f5d784',p.x,.20,p.y).rotation.x=-Math.PI/2;
  }
  for(const edge of board.edges){
   const a=vertices.get(edge.a),b=vertices.get(edge.b);if(!a||!b)continue;
   const length=Math.hypot(b.x-a.x,b.y-a.y);
   const g=new THREE.BoxGeometry(length*.68,.13,.16);pickGeometry.push(g);
   const mesh=new THREE.Mesh(g,pickMaterial);mesh.position.set((a.x+b.x)/2,.29,(a.y+b.y)/2);
   mesh.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);mesh.userData={selection:{kind:'edge',id:edge.id}};scene.add(mesh);pickObjects.push(mesh);
   if(legalEdgeSet.has(edge.id)){const marker=add(new THREE.BoxGeometry(length*.65,.045,.065),'#f5d784',(a.x+b.x)/2,.23,(a.y+b.y)/2);marker.rotation.y=mesh.rotation.y;}
  }
  // Number tokens use canvas textures, independent of the UI font.
  const textures:THREE.Texture[]=[];
  for(const {tile,p} of positions){
   if(!('number' in tile)||typeof tile.number!=='number'||tile.number<2)continue;
   const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)continue;
   ctx.fillStyle='#f3e6c8';ctx.fillRect(0,0,128,128);ctx.fillStyle=tile.number===6||tile.number===8?'#a43e32':'#39352e';ctx.font='bold 76px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(tile.number),64,68);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
   add(new THREE.CylinderGeometry(.23,.23,.06,32),'#cbbd9f',p.x,.18,p.y+.62);
   const g=new THREE.CircleGeometry(.21,32);details.push(g);const m=new THREE.MeshBasicMaterial({map:texture});detailMaterials.set('token-'+tile.id,m as unknown as THREE.MeshStandardMaterial);const token=new THREE.Mesh(g,m);token.rotation.x=-Math.PI/2;token.position.set(p.x,.215,p.y+.62);scene.add(token);
  }
  for(const harbor of board.harbors){
   const edge=board.edges.find(e=>e.id===harbor.edgeId);if(!edge)continue;const a=vertices.get(edge.a),b=vertices.get(edge.b),t=positions.find(t=>t.tile.id===edge.tiles[0]);if(!a||!b||!t)continue;
   const x=(a.x+b.x)/2,z=(a.y+b.y)/2,dx=x-t.p.x,dz=z-t.p.y,len=Math.hypot(dx,dz);if(!len)continue;const ux=dx/len,uz=dz/len,angle=Math.atan2(uz,ux);
   add(new THREE.BoxGeometry(.65,.1,.27),'#a7855c',x+ux*.24,.03,z+uz*.24).rotation.y=-angle;
   const sx=x+ux*.78,sz=z+uz*.78;
   add(new THREE.SphereGeometry(.29,6,4),'#624b38',sx,-.03,sz).scale.set(1.5,.5,.65);
   add(new THREE.CylinderGeometry(.025,.025,.45,6),'#825d40',sx,.23,sz);
   add(new THREE.ConeGeometry(.23,.42,3),'#e9dfbe',sx,.35,sz).scale.set(1,1,.28);
  }
  scene.updateMatrixWorld(true);bounds.setFromObject(scene);
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const span=Math.max(size.x,size.z)+3;
  const waterGeometry=new THREE.PlaneGeometry(span*8,span*8);
  const waterMaterial=new THREE.MeshStandardMaterial({color:'#285963',roughness:.85});
  const water=new THREE.Mesh(waterGeometry,waterMaterial);water.rotation.x=-Math.PI/2;water.position.set(center.x,-.15,center.z);scene.add(water);
  scene.add(new THREE.HemisphereLight('#fff1d8','#526b72',2));
  const sun=new THREE.DirectionalLight('#fff0d0',2);sun.position.set(-5,12,6);scene.add(sun);
  camera.position.set(center.x,span*1.3,center.z+span);camera.lookAt(center);camera.updateMatrixWorld(true);
  const projected=new THREE.Box3();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  let zoom=1,azimuth=0;const pointers=new Map<number,{x:number;y:number}>();let pinchDistance=0;const target=center.clone();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));el.appendChild(renderer.domElement);
  const draw=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;camera.position.set(target.x+Math.sin(azimuth)*span,target.y+span*1.3,target.z+Math.cos(azimuth)*span);camera.lookAt(target);camera.updateMatrixWorld(true);const projected=new THREE.Box3();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));const fit=projected.getSize(new THREE.Vector3()),mid=projected.getCenter(new THREE.Vector3());const aspect=w/h,half=Math.max(fit.y/2,fit.x/(2*aspect))*1.08/zoom;camera.left=mid.x-half*aspect;camera.right=mid.x+half*aspect;camera.top=mid.y+half;camera.bottom=mid.y-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false);renderer.render(scene,camera);};
  const canvas=renderer.domElement;canvas.style.touchAction='none';
  const raycaster=new THREE.Raycaster();const ndc=new THREE.Vector2();let start:{x:number;y:number}|null=null;let moved=false;
  const selectAt=(x:number,y:number)=>{const rect=canvas.getBoundingClientRect();ndc.set((x-rect.left)/rect.width*2-1,-((y-rect.top)/rect.height*2-1));raycaster.setFromCamera(ndc,camera);const hit=raycaster.intersectObjects([...pickObjects,...selectable],false)[0];const selection=hit?.object.userData.selection as BoardSelection|undefined;if(selection){setSelected(selection);selectionCallback.current?.(selection);}};
  const distance=()=>{const a=[...pointers.values()];return a.length===2?Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y):0;};
  const down=(e:PointerEvent)=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){start={x:e.clientX,y:e.clientY};moved=false;}else moved=true;pinchDistance=distance();};
  const move=(e:PointerEvent)=>{const prev=pointers.get(e.pointerId);if(!prev)return;if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)moved=true;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const d=distance();if(pinchDistance>0)zoom=Math.max(.65,Math.min(3,zoom*d/pinchDistance));pinchDistance=d;}else if(pointers.size===1){azimuth+=(e.clientX-prev.x)*.008;}draw();};
  const up=(e:PointerEvent)=>{if(e.type==='pointerup'&&pointers.size===1&&!moved)selectAt(e.clientX,e.clientY);pointers.delete(e.pointerId);pinchDistance=distance();if(!pointers.size)start=null;};
  const wheel=(e:WheelEvent)=>{e.preventDefault();zoom=Math.max(.65,Math.min(3,zoom*Math.exp(-e.deltaY*.001)));draw();};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});
  const observer=new ResizeObserver(draw);observer.observe(el);draw();
  const lost=(e:Event)=>{e.preventDefault();fallback.current();};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);renderer.domElement.removeEventListener('webglcontextlost',lost);geometry.dispose();pickGeometry.forEach(g=>g.dispose());pickMaterial.dispose();textures.forEach(t=>t.dispose());details.forEach(g=>g.dispose());detailMaterials.forEach(m=>m.dispose());waterGeometry.dispose();waterMaterial.dispose();materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
 },[board,pieces,legalVertices,legalEdges]);
 return <div style={{width:'100%',height:'100%',minHeight:240,position:'relative'}}><div ref={host} aria-label="Experimental 3D board preview" style={{width:'100%',height:'100%',minHeight:240}}/>{selected&&<output aria-live="polite" style={{position:'absolute',left:12,bottom:12,background:'#19333c',color:'#fff',padding:'8px 12px',borderRadius:8,pointerEvents:'none'}}>Selected {selected.kind}: {selected.id}</output>}</div>;
}
