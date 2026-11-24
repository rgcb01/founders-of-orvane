import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {tilePosition,vertexPosition,type Board} from '@orvane/engine';
import {TERRAIN_COLORS} from './TerrainArt';

type BoardSelection={kind:'tile'|'vertex'|'edge';id:string};
type Pieces={roads:{edgeId:string;color:string}[];buildings:{vertexId:string;color:string;kind:'settlement'|'city'}[]};
export function BoardScene3D({board,onUnavailable,pieces,onSelect,legalVertices,legalEdges,robberTile,producingTiles}:{board:Board;onUnavailable:()=>void;pieces?:Pieces;onSelect?:(selection:BoardSelection)=>void;legalVertices?:readonly string[];legalEdges?:readonly string[];robberTile?:string;producingTiles?:readonly string[]}){
 const [quality,setQuality]=useState<'auto'|'low'|'medium'|'high'>(()=>{try{const q=localStorage.getItem('orvane.graphics');return q==='low'||q==='medium'||q==='high'?q:'auto';}catch{return 'auto';}});
 const host=useRef<HTMLDivElement>(null);
 const resetCamera=useRef(()=>{});
 const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
 const sharedGeometry=useRef(new Map<string,THREE.BufferGeometry>());
 const staticTerrain=useRef<{board:Board;objects:THREE.Object3D[];vegetation:{mesh:THREE.Mesh;phase:number}[];batches:Map<string,{mesh:THREE.InstancedMesh;items:{mesh:THREE.Mesh;phase:number}[]}>;selectable:THREE.Object3D[];geometry:THREE.CylinderGeometry;materials:Map<string,THREE.MeshStandardMaterial>}|null>(null);
 const harborCache=useRef<{board:Board;objects:THREE.Object3D[];boats:THREE.Group[]}|null>(null);
 const waterCache=useRef<{board:Board;mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>}|null>(null);
 const sharedMaterials=useRef(new Map<string,THREE.MeshStandardMaterial>());
 useEffect(()=>{return()=>{rendererRef.current?.dispose();rendererRef.current?.domElement.remove();rendererRef.current=null;harborCache.current=null;waterCache.current?.mesh.geometry.dispose();waterCache.current?.mesh.material.dispose();waterCache.current=null;const terrain=staticTerrain.current;if(terrain){terrain.geometry.dispose();terrain.materials.forEach(m=>m.dispose());terrain.batches.forEach(b=>b.mesh.dispose());staticTerrain.current=null;}for(const g of sharedGeometry.current.values())g.dispose();sharedGeometry.current.clear();for(const m of sharedMaterials.current.values())m.dispose();sharedMaterials.current.clear();};},[]);
 const previousRobber=useRef<{board:Board;tile?:string}|null>(null);
 const pieceCache=useRef<{board:Board;entries:Map<string,{objects:THREE.Object3D[];pick:THREE.Object3D}>}|null>(null);
 const previousPieces=useRef<{board:Board;keys:Set<string>}|null>(null);
 const cameraPose=useRef({zoom:1,azimuth:0,panX:0,panY:0});
 // Parent game UI creates fresh arrays on every render; only rebuild WebGL when their content changes.
 const productionKey=(producingTiles??[]).join('|');
 const piecesKey=JSON.stringify(pieces??null);
 const legalVerticesKey=(legalVertices??[]).join('|');
 const legalEdgesKey=(legalEdges??[]).join('|');
 const [selected,setSelected]=useState<BoardSelection|null>(null);
 const selectionCallback=useRef(onSelect);selectionCallback.current=onSelect;
 const fallback=useRef(onUnavailable);fallback.current=onUnavailable;
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=rendererRef.current??new THREE.WebGLRenderer({antialias:true,alpha:false});rendererRef.current=renderer;renderer.shadowMap.autoUpdate=true;}catch{fallback.current();return;}
  const tier=quality==='auto'?(window.matchMedia('(pointer: coarse)').matches?'medium':'high'):quality;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#183e49');
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,500);
  const selectable:THREE.Object3D[]=[];
  const positions=board.tiles.map(t=>({tile:t,p:tilePosition(t,1)}));
  const bounds=new THREE.Box3();
  if(staticTerrain.current&&staticTerrain.current.board!==board){const old=staticTerrain.current;old.geometry.dispose();old.materials.forEach(m=>m.dispose());old.batches.forEach(b=>b.mesh.dispose());staticTerrain.current=null;}
  const cachedTerrain=staticTerrain.current;
  const geometry=cachedTerrain?.geometry??new THREE.CylinderGeometry(.98,.98,.24,6);
  const materials=cachedTerrain?.materials??new Map<string,THREE.MeshStandardMaterial>();
  const geometryCache=sharedGeometry.current;
  const details:THREE.BufferGeometry[]=[];const detailMaterials=new Map<string,THREE.MeshStandardMaterial>();
  const add=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>{const key=g.type+JSON.stringify((g as THREE.BoxGeometry).parameters);const cached=geometryCache.get(key);if(cached){g.dispose();g=cached;}else{geometryCache.set(key,g);}let m=sharedMaterials.current.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,flatShading:true,roughness:1});sharedMaterials.current.set(color,m);}const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);scene.add(mesh);return mesh;};
  const vegetation: {mesh:THREE.Mesh;phase:number}[]=cachedTerrain?.vegetation??[];
  if(cachedTerrain){scene.add(...cachedTerrain.objects);selectable.push(...cachedTerrain.selectable);}else for(const {tile,p} of positions){
   const color=TERRAIN_COLORS[tile.terrain];
   let mat=materials.get(color);if(!mat){mat=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});materials.set(color,mat);}
   const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(p.x,0,p.y);scene.add(mesh);mesh.userData={selection:{kind:'tile',id:tile.id}};selectable.push(mesh);bounds.expandByObject(mesh);
   const x=p.x,z=p.y;
   switch(tile.terrain){
    case 'forest': for(const [dx,dz,h] of [[-.38,-.22,.58],[.24,-.34,.45],[.32,.24,.62],[-.25,.35,.4]]){add(new THREE.CylinderGeometry(.045,.06,.19,5),'#795740',x+dx,.21,z+dz);vegetation.push({mesh:add(new THREE.ConeGeometry(.23,h*.7,5),'#315d45',x+dx,.26+h*.35,z+dz),phase:x+z+dx});vegetation.push({mesh:add(new THREE.ConeGeometry(.16,h*.65,5),'#497458',x+dx,.35+h*.65,z+dz),phase:x+z+dx});}break;
    case 'pasture': for(const [dx,dz] of [[-.32,-.22],[.27,.15],[-.12,.38]]){add(new THREE.IcosahedronGeometry(.13,0),'#e0d9bd',x+dx,.24,z+dz).scale.set(1.4,.8,1);add(new THREE.IcosahedronGeometry(.055,0),'#665e50',x+dx+.14,.24,z+dz);}break;
    case 'field': for(let i=0;i<5;i++){add(new THREE.BoxGeometry(.13,.035,.85),'#8f713e',x+(i-2)*.18,.14,z);for(let j=0;j<5;j++)vegetation.push({mesh:add(new THREE.ConeGeometry(.055,.15,4),'#e3bf65',x+(i-2)*.18,.22,z+(j-2)*.16),phase:x+z+i*.3+j*.2});}break;
    case 'hill': for(const [dx,dz,h] of [[-.25,-.15,.27],[.28,.22,.36]]){add(new THREE.IcosahedronGeometry(.35,0),'#b67d55',x+dx,.12+h*.3,z+dz).scale.set(1,h/.35,1);}break;
    case 'mountain': for(const [dx,dz,h] of [[-.28,-.13,.85],[.30,.14,.62]]){add(new THREE.ConeGeometry(.36,h,5),'#697b85',x+dx,.12+h/2,z+dz);add(new THREE.ConeGeometry(.13,h*.35,5),'#e2e6df',x+dx,.12+h*.825,z+dz);}break;
    case 'desert': add(new THREE.SphereGeometry(.5,6,3),'#e2c18a',x,.12,z).scale.set(1,.24,.65);break;
   }
  }
  const oldRobber=previousRobber.current;previousRobber.current={board,tile:robberTile};
  const origin=oldRobber?.board===board&&oldRobber.tile!==robberTile&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches?positions.find(({tile})=>tile.id===oldRobber.tile):undefined;
  const robberMeshes:THREE.Mesh[]=[];
  const batches=cachedTerrain?.batches??new Map<string,{mesh:THREE.InstancedMesh;items:typeof vegetation}>();
  if(!cachedTerrain){
  const grouped=new Map<string,typeof vegetation>();for(const item of vegetation){const key=item.mesh.geometry.uuid+':'+(item.mesh.material as THREE.Material).uuid;const list=grouped.get(key)??[];list.push(item);grouped.set(key,list);}
  for(const [key,items] of grouped){const first=items[0].mesh;const mesh=new THREE.InstancedMesh(first.geometry,first.material,items.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);items.forEach((item,i)=>{item.mesh.updateMatrix();mesh.setMatrixAt(i,item.mesh.matrix);scene.remove(item.mesh);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);batches.set(key,{mesh,items});}
  staticTerrain.current={board,objects:[...scene.children],vegetation,batches,selectable:[...selectable],geometry,materials};}
  const robber=positions.find(({tile})=>tile.id===robberTile);
  if(robber){
   const {x,y:z}=robber.p;
   const base=add(new THREE.CylinderGeometry(.19,.24,.09,8),'#292e35',x,.18,z+.40);
   base.userData={selection:{kind:'tile',id:robber.tile.id}};selectable.push(base);
   const body=add(new THREE.CylinderGeometry(.10,.17,.38,6),'#343942',x,.40,z+.40);
   body.userData=base.userData;selectable.push(body);
   const head=add(new THREE.IcosahedronGeometry(.12,0),'#252a31',x,.66,z+.40);
   head.userData=base.userData;selectable.push(head);robberMeshes.push(base,body,head);
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
  const keys=new Set([...display.roads.map(r=>'road:'+r.edgeId),...display.buildings.map(b=>b.kind+':'+b.vertexId)]);
  const prior=previousPieces.current;previousPieces.current={board,keys};
  const animate=!!pieces&&prior?.board===board&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(pieceCache.current?.board!==board)pieceCache.current={board,entries:new Map()};
  const entries=pieceCache.current.entries;
  const activeKeys=new Set([...display.roads.map(r=>'road:'+r.edgeId+':'+r.color),...display.buildings.map(b=>b.kind+':'+b.vertexId+':'+b.color)]);
  for(const key of entries.keys())if(!activeKeys.has(key))entries.delete(key);
  const reuse=(key:string)=>{const entry=entries.get(key);if(!entry)return false;for(const object of entry.objects){object.scale.y=object instanceof THREE.Group?1:object.scale.y;scene.add(object);}selectable.push(entry.pick);return true;};
  const animated:THREE.Group[]=[];
  const groupNew=(key:string,start:number,x:number,z:number)=>{if(!animate||prior?.keys.has(key))return;const group=new THREE.Group();group.position.set(x,.12,z);scene.add(group);for(const mesh of scene.children.slice(start,-1)){if(mesh instanceof THREE.Mesh)group.attach(mesh);}animated.push(group);};
  for(const road of display.roads){const edge=board.edges.find(e=>e.id===road.edgeId);if(!edge)continue;const a=vertices.get(edge.a),b=vertices.get(edge.b);if(!a||!b)continue;
   const cacheKey='road:'+road.edgeId+':'+road.color;if(reuse(cacheKey))continue;
   const start=scene.children.length;
   const length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);
   add(new THREE.BoxGeometry(length*.92,.11,.13),'#52463e',(a.x+b.x)/2,.17,(a.y+b.y)/2).rotation.y=-angle;
   const pick=add(new THREE.BoxGeometry(length*.9,.07,.18),road.color,(a.x+b.x)/2,.25,(a.y+b.y)/2);pick.rotation.y=-angle;pick.userData={selection:{kind:'edge',id:edge.id}};selectable.push(pick);groupNew('road:'+road.edgeId,start,(a.x+b.x)/2,(a.y+b.y)/2);entries.set(cacheKey,{objects:scene.children.slice(start),pick});
  }
  for(const building of display.buildings){const p=vertices.get(building.vertexId);if(!p)continue;
   const cacheKey=building.kind+':'+building.vertexId+':'+building.color;if(reuse(cacheKey))continue;
   const start=scene.children.length;
   const pick=add(new THREE.BoxGeometry(.49,.07,.43),'#746656',p.x,.17,p.y);pick.userData={selection:{kind:'vertex',id:building.vertexId}};selectable.push(pick);
   const house=(x:number,z:number,w:number,h:number)=>{add(new THREE.BoxGeometry(w,h,w*.85),building.color,x,.21+h/2,z);const roof=add(new THREE.CylinderGeometry(0,w*.77,w*.48,4),building.color,x,.21+h+w*.24,z);roof.rotation.y=Math.PI/4;add(new THREE.BoxGeometry(w*.22,h*.6,.025),'#443e37',x,.21+h*.3,z+w*.43);};
   if(building.kind==='city'){house(p.x-.12,p.y,.26,.36);house(p.x+.15,p.y+.04,.21,.24);}else house(p.x,p.y,.30,.23);groupNew(building.kind+':'+building.vertexId,start,p.x,p.y);entries.set(cacheKey,{objects:scene.children.slice(start),pick});
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
  const cachedHarbors=harborCache.current?.board===board?harborCache.current:null;
  const boats:THREE.Group[]=cachedHarbors?.boats??[];
  const harborStart=scene.children.length;
  if(cachedHarbors){scene.add(...cachedHarbors.objects);}else for(const harbor of board.harbors){
   const edge=board.edges.find(e=>e.id===harbor.edgeId);if(!edge)continue;const a=vertices.get(edge.a),b=vertices.get(edge.b),t=positions.find(t=>t.tile.id===edge.tiles[0]);if(!a||!b||!t)continue;
   const x=(a.x+b.x)/2,z=(a.y+b.y)/2,dx=x-t.p.x,dz=z-t.p.y,len=Math.hypot(dx,dz);if(!len)continue;const ux=dx/len,uz=dz/len,angle=Math.atan2(uz,ux);
   add(new THREE.BoxGeometry(.65,.1,.27),'#a7855c',x+ux*.24,.03,z+uz*.24).rotation.y=-angle;
   const sx=x+ux*.78,sz=z+uz*.78;
   const boatStart=scene.children.length;
   add(new THREE.SphereGeometry(.29,6,4),'#624b38',sx,-.03,sz).scale.set(1.5,.5,.65);
   add(new THREE.CylinderGeometry(.025,.025,.45,6),'#825d40',sx,.23,sz);
   add(new THREE.ConeGeometry(.23,.42,3),'#e9dfbe',sx,.35,sz).scale.set(1,1,.28);
   const boat=new THREE.Group();boat.position.set(sx,0,sz);scene.add(boat);for(const mesh of scene.children.slice(boatStart,-1))boat.attach(mesh);boats.push(boat);
  }
  if(!cachedHarbors)harborCache.current={board,objects:scene.children.slice(harborStart),boats};
  scene.updateMatrixWorld(true);bounds.setFromObject(scene);
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const span=Math.max(size.x,size.z)+3;
  if(waterCache.current?.board!==board){waterCache.current?.mesh.geometry.dispose();waterCache.current?.mesh.material.dispose();waterCache.current={board,mesh:new THREE.Mesh(new THREE.PlaneGeometry(span*8,span*8,24,24),new THREE.MeshStandardMaterial({color:'#285963',roughness:.85}))};}
  const water=waterCache.current.mesh;const waterGeometry=water.geometry;water.rotation.x=-Math.PI/2;water.position.set(center.x,-.15,center.z);scene.add(water);water.receiveShadow=true;
  scene.add(new THREE.HemisphereLight('#fff1d8','#526b72',1.65));
  const sun=new THREE.DirectionalLight('#fff0d0',2.2);sun.position.set(center.x-5,12,center.z+6);sun.target.position.copy(center);scene.add(sun,sun.target);
  renderer.shadowMap.enabled=tier!=='low';renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  sun.castShadow=true;const shadowSize=tier==='high'?1024:512;sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.camera.left=-span;sun.shadow.camera.right=span;sun.shadow.camera.top=span;sun.shadow.camera.bottom=-span;sun.shadow.camera.near=.5;sun.shadow.camera.far=span*4+20;sun.shadow.normalBias=.025;sun.shadow.bias=-.0002;sun.shadow.camera.updateProjectionMatrix();
  scene.traverse(object=>{if(object instanceof THREE.Mesh&&object!==water&&object.material instanceof THREE.MeshStandardMaterial){object.castShadow=true;object.receiveShadow=true;}});
  camera.position.set(center.x,span*1.3,center.z+span);camera.lookAt(center);camera.updateMatrixWorld(true);
  const projected=new THREE.Box3();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  let {zoom,azimuth,panX,panY}=cameraPose.current;const pointers=new Map<number,{x:number;y:number}>();let pinchDistance=0;const target=center.clone();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,tier==='high'?2:tier==='medium'?1.5:1));el.appendChild(renderer.domElement);
  const draw=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;camera.position.set(target.x+Math.sin(azimuth)*span,target.y+span*1.3,target.z+Math.cos(azimuth)*span);camera.lookAt(target);camera.updateMatrixWorld(true);const projected=new THREE.Box3();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));const fit=projected.getSize(new THREE.Vector3()),mid=projected.getCenter(new THREE.Vector3());const aspect=w/h,half=Math.max(fit.y/2,fit.x/(2*aspect))*1.08/zoom;camera.left=mid.x+panX-half*aspect;camera.right=mid.x+panX+half*aspect;camera.top=mid.y+panY+half;camera.bottom=mid.y+panY-half;camera.updateProjectionMatrix();if(renderer.domElement.width!==Math.floor(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);const canvas=renderer.domElement;canvas.dataset.cameraPose=JSON.stringify({zoom,azimuth,panX,panY});canvas.dataset.legalVertices=JSON.stringify([...legalVertexSet].flatMap(id=>{const p=vertices.get(id);if(!p)return [];const q=new THREE.Vector3(p.x,.32,p.y).project(camera);return [{id,x:(q.x+1)*w/2,y:(1-q.y)*h/2}]}));canvas.dataset.legalEdges=JSON.stringify([...legalEdgeSet].flatMap(id=>{const edge=board.edges.find(e=>e.id===id);if(!edge)return [];const a=vertices.get(edge.a),b=vertices.get(edge.b);if(!a||!b)return [];const q=new THREE.Vector3((a.x+b.x)/2,.29,(a.y+b.y)/2).project(camera);return [{id,x:(q.x+1)*w/2,y:(1-q.y)*h/2}]}));};
  const productionGeometry=new THREE.TorusGeometry(.78,.045,8,48);
  const productionMaterial=new THREE.MeshBasicMaterial({color:'#ffe39b',transparent:true,opacity:.85,depthTest:false});
  const productionRings=positions.filter(({tile})=>producingTiles?.includes(tile.id)).map(({p})=>{const ring=new THREE.Mesh(productionGeometry,productionMaterial);ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.28,p.y);ring.renderOrder=8;scene.add(ring);return ring;});
  const markerGeometry=new THREE.TorusGeometry(.23,.035,8,32);
  const markerMaterial=new THREE.MeshBasicMaterial({color:'#fff2a8',depthTest:false});
  const marker=new THREE.Mesh(markerGeometry,markerMaterial);marker.rotation.x=-Math.PI/2;marker.visible=false;marker.renderOrder=10;scene.add(marker);
  const canvas=renderer.domElement;canvas.style.touchAction='none';
  const raycaster=new THREE.Raycaster();const ndc=new THREE.Vector2();let start:{x:number;y:number}|null=null;let moved=false;
  const selectAt=(x:number,y:number)=>{const rect=canvas.getBoundingClientRect();ndc.set((x-rect.left)/rect.width*2-1,-((y-rect.top)/rect.height*2-1));raycaster.setFromCamera(ndc,camera);const hit=raycaster.intersectObjects([...pickObjects,...selectable],false)[0];const selection=hit?.object.userData.selection as BoardSelection|undefined;if(selection){const point=hit.object.getWorldPosition(new THREE.Vector3());marker.position.set(point.x,Math.max(point.y+.18,.35),point.z);marker.scale.setScalar(selection.kind==='tile'?2.8:1);marker.visible=true;setSelected(selection);selectionCallback.current?.(selection);draw();}};
  const distance=()=>{const a=[...pointers.values()];return a.length===2?Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y):0;};
  const down=(e:PointerEvent)=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){start={x:e.clientX,y:e.clientY};moved=false;}else moved=true;pinchDistance=distance();};
  const move=(e:PointerEvent)=>{const prev=pointers.get(e.pointerId);if(!prev)return;if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)moved=true;const oldPair=[...pointers.values()];pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const pair=[...pointers.values()],d=distance(),rect=canvas.getBoundingClientRect();const oldAngle=Math.atan2(oldPair[1].y-oldPair[0].y,oldPair[1].x-oldPair[0].x),angle=Math.atan2(pair[1].y-pair[0].y,pair[1].x-pair[0].x);if(pinchDistance>12&&d>12){const oldZoom=zoom;zoom=Math.max(.65,Math.min(3,zoom*d/pinchDistance));const ratio=oldZoom/zoom;const w=camera.right-camera.left,h=camera.top-camera.bottom;const ox=(oldPair[0].x+oldPair[1].x)/2-rect.left,oy=(oldPair[0].y+oldPair[1].y)/2-rect.top;const nx=(pair[0].x+pair[1].x)/2-rect.left,ny=(pair[0].y+pair[1].y)/2-rect.top;panX=THREE.MathUtils.clamp(panX+(ox/rect.width-.5)*w-(nx/rect.width-.5)*w*ratio,-span/2,span/2);panY=THREE.MathUtils.clamp(panY+(.5-oy/rect.height)*h-(.5-ny/rect.height)*h*ratio,-span/2,span/2);azimuth+=Math.atan2(Math.sin(angle-oldAngle),Math.cos(angle-oldAngle));}pinchDistance=d;}else if(pointers.size===1){if(e.pointerType==='touch'||e.shiftKey){panX=THREE.MathUtils.clamp(panX-(e.clientX-prev.x)*(camera.right-camera.left)/Math.max(1,el.clientWidth),-span/2,span/2);panY=THREE.MathUtils.clamp(panY+(e.clientY-prev.y)*(camera.top-camera.bottom)/Math.max(1,el.clientHeight),-span/2,span/2);}else azimuth+=(e.clientX-prev.x)*.008;}cameraPose.current={zoom,azimuth,panX,panY};draw();};
  const up=(e:PointerEvent)=>{if(e.type==='pointerup'&&pointers.size===1&&!moved)selectAt(e.clientX,e.clientY);pointers.delete(e.pointerId);pinchDistance=distance();if(!pointers.size)start=null;};
  const wheel=(e:WheelEvent)=>{e.preventDefault();zoom=Math.max(.65,Math.min(3,zoom*Math.exp(-e.deltaY*.001)));cameraPose.current={zoom,azimuth,panX,panY};draw();};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});
  resetCamera.current=()=>{zoom=1;azimuth=0;panX=0;panY=0;cameraPose.current={zoom,azimuth,panX,panY};draw();};
  const ambientEnabled=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ambientTimer=0;const ambientStart=performance.now();
  let samples=0,totalMs=0,slowWindows=0;let sampleStart=performance.now();let ambientStride=1,ambientCount=0;
  const ambient=()=>{if(document.hidden||!el.clientWidth||!el.clientHeight){samples=0;totalMs=0;sampleStart=performance.now();return;}if(++ambientCount%ambientStride!==0)return;const begin=performance.now();const t=(performance.now()-ambientStart)/1000;for(const {mesh:batch,items} of batches.values()){items.forEach(({mesh,phase},i)=>{mesh.rotation.z=.055*Math.sin(t*1.6+phase);mesh.rotation.x=.025*Math.cos(t*1.2+phase);mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);});batch.instanceMatrix.needsUpdate=true;}boats.forEach((boat,i)=>{boat.position.y=.035*Math.sin(t*1.7+i);boat.rotation.z=.045*Math.sin(t*1.3+i);});const pos=waterGeometry.attributes.position;for(let i=0;i<pos.count;i++)pos.setZ(i,.035*Math.sin(pos.getX(i)*.8+t)+.025*Math.cos(pos.getY(i)*.9-t*.8));pos.needsUpdate=true;waterGeometry.computeVertexNormals();renderer.render(scene,camera);totalMs+=performance.now()-begin;samples++;if(samples>=30){const now=performance.now();const mean=totalMs/samples;const ambientFps=samples*1000/Math.max(1,now-sampleStart);canvas.dataset.renderMetrics=JSON.stringify({ambientFps,cpuRenderMs:mean,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,ambientStride});if(quality==='auto'){slowWindows=mean>18?slowWindows+1:0;if(slowWindows>=2){ambientStride=Math.min(4,ambientStride+1);renderer.shadowMap.autoUpdate=false;slowWindows=0;}else if(mean<8&&ambientStride>1){ambientStride--;if(ambientStride===1)renderer.shadowMap.autoUpdate=true;}}samples=0;totalMs=0;sampleStart=now;}};
  const observer=new ResizeObserver(draw);observer.observe(el);let frame=0;const started=performance.now();
  const robberTargets=robberMeshes.map(mesh=>mesh.position.clone());
  const movingRobber=!!origin&&!!robber&&robberMeshes.length>0;
  const tick=(now:number)=>{const elapsed=now-started,t=Math.min(1,elapsed/380),ease=1-Math.pow(1-t,3);for(const group of animated)group.scale.set(1,Math.max(.05,ease),1);
   const u=Math.min(1,elapsed/520),smooth=u*u*(3-2*u);
   if(movingRobber&&origin&&robber){robberMeshes.forEach((mesh,i)=>{const dest=robberTargets[i];mesh.position.set(dest.x+(origin.p.x-robber.p.x)*(1-smooth),dest.y+Math.sin(Math.PI*u)*.48,dest.z+(origin.p.y-robber.p.y)*(1-smooth));});}
   const pulse=Math.min(1,elapsed/650);for(const ring of productionRings)ring.scale.setScalar(.85+.15*Math.sin(Math.PI*pulse));productionMaterial.opacity=.85*(1-pulse);scene.updateMatrixWorld(true);draw();if((animated.length>0&&t<1)||(movingRobber&&u<1)||(productionRings.length>0&&pulse<1))frame=requestAnimationFrame(tick);};
  if(animated.length||movingRobber||productionRings.length)tick(started);else draw();
  if(ambientEnabled&&tier!=='low')ambientTimer=window.setInterval(ambient,1000/(tier==='high'?30:20));
  const lost=(e:Event)=>{e.preventDefault();fallback.current();};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{observer.disconnect();window.clearInterval(ambientTimer);cancelAnimationFrame(frame);productionGeometry.dispose();productionMaterial.dispose();markerGeometry.dispose();markerMaterial.dispose();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);renderer.domElement.removeEventListener('webglcontextlost',lost);pickGeometry.forEach(g=>g.dispose());pickMaterial.dispose();textures.forEach(t=>t.dispose());details.forEach(g=>g.dispose());detailMaterials.forEach(m=>m.dispose());sun.shadow.dispose();renderer.renderLists.dispose();};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[board,piecesKey,legalVerticesKey,legalEdgesKey,robberTile,productionKey,quality]);
 return <div style={{width:'100%',height:'100%',minHeight:240,position:'relative'}}><div ref={host} aria-label="Experimental 3D board preview" style={{width:'100%',height:'100%',minHeight:240}}/><select aria-label="Graphics quality" value={quality} onChange={e=>{const q=e.target.value as typeof quality;setQuality(q);try{localStorage.setItem('orvane.graphics',q);}catch{}}} style={{position:'absolute',right:12,top:12,zIndex:2,maxWidth:115}}><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><button type="button" aria-label="Reset 3D camera" onClick={()=>resetCamera.current()} style={{position:'absolute',right:12,bottom:12,zIndex:2}}>⌂</button>{selected&&<output aria-live="polite" style={{position:'absolute',left:12,bottom:12,background:'#19333c',color:'#fff',padding:'8px 12px',borderRadius:8,pointerEvents:'none'}}>Selected {selected.kind}: {selected.id}</output>}</div>;
}
