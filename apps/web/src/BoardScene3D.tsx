import {placementPose} from './placementMotion';
import {useEffect,useRef,useState,type RefObject} from 'react';
import * as THREE from 'three';
import {loadDicePhysics,createPhysicalDice,type DiceObstacle,type DiceImpulse} from './PhysicalDice';
import {tilePosition,vertexPosition,type Board} from '@orvane/engine';
import {TERRAIN_COLORS} from './TerrainArt';
import {adaptResolution,resolutionCap,resolutionStart,nextFrameDeadline,TARGET_FPS,canRecoverCadence,adaptShadows,type ResolutionState} from './adaptiveResolution';

export type GraphicsQuality='auto'|'low'|'medium'|'high';
export function readGraphicsQuality():GraphicsQuality{try{const q=localStorage.getItem('orvane.graphics');return q==='low'||q==='medium'||q==='high'?q:'auto';}catch{return 'auto';}}
export function GraphicsQualitySelect({value,onChange}:{value:GraphicsQuality;onChange:(q:GraphicsQuality)=>void}){return <select aria-label="Graphics quality" value={value} onChange={e=>onChange(e.target.value as GraphicsQuality)}><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>;}
export function persistGraphicsQuality(q:GraphicsQuality){try{localStorage.setItem('orvane.graphics',q);}catch{}}
export type BoardCameraControls={zoomBy:(delta:number)=>void;reset:()=>void;project:(kind:'tile'|'vertex'|'edge',id:string)=>{x:number;y:number}|undefined;throwVector:(dx:number,dy:number,releaseX?:number,releaseY?:number)=>DiceImpulse;previewPiece:(piece:{kind:'road'|'settlement'|'city';id:string;color:string}|null)=>void};
type BoardSelection={kind:'tile'|'vertex'|'edge';id:string};
type BoatBatch={mesh:THREE.InstancedMesh;parts:{boat:THREE.Group;local:THREE.Matrix4}[]};
type Pieces={roads:{edgeId:string;color:string}[];buildings:{vertexId:string;color:string;kind:'settlement'|'city'}[]};
export function BoardScene3D({board,onUnavailable,pieces,onSelect,legalVertices,legalEdges,robberTile,producingTiles,cameraControls,ambientPaused=false,graphicsQuality,onGraphicsQualityChange,diceRoll,canMoveRobber=false,onRobberDrop}:{board:Board;onUnavailable:()=>void;pieces?:Pieces;onSelect?:(selection:BoardSelection)=>void;legalVertices?:readonly string[];legalEdges?:readonly string[];robberTile?:string;producingTiles?:readonly string[];cameraControls?:RefObject<BoardCameraControls|null>;ambientPaused?:boolean;graphicsQuality?:GraphicsQuality;onGraphicsQualityChange?:(q:GraphicsQuality)=>void;canMoveRobber?:boolean;onRobberDrop?:(id:string)=>void;diceRoll?:{values:[number,number];duration:number;impulse?:DiceImpulse;onImpact?:(strength:number)=>void;onComplete?:()=>void}}){
 const [localQuality,setLocalQuality]=useState<GraphicsQuality>(readGraphicsQuality);
 const quality=graphicsQuality??localQuality;
 const changeQuality=(q:GraphicsQuality)=>{if(onGraphicsQualityChange)onGraphicsQualityChange(q);else{setLocalQuality(q);persistGraphicsQuality(q);}};
 const diagnosticQuality=new URLSearchParams(window.location.search).has('benchmark3d')||new URLSearchParams(window.location.search).has('perf');
 const host=useRef<HTMLDivElement>(null);
 const perfHud=useRef<HTMLOutputElement>(null);
 const showPerf=new URLSearchParams(window.location.search).get('perf')==='1';
 const resetCamera=useRef(()=>{});
 const ambientControl=useRef<(()=>void)|null>(null);
 const ambientPausedRef=useRef(ambientPaused);
 const renderCounts=useRef({frames:0,shadowUpdates:0,ambientFrames:0,animationFrames:0,animationShadowUpdates:0,completedAnimations:0});
 const automaticResolution=useRef<ResolutionState|undefined>(undefined);
 const autoShadows=useRef({enabled:true,slow:0,fast:0});
 const ambientSampling=useRef<{quality:string;tier:string;running:boolean;samples:number;totalMs:number;sampleStart:number;slowWindows:number;stride:number;count:number}|null>(null);
 useEffect(()=>{ambientPausedRef.current=ambientPaused;ambientControl.current?.();},[ambientPaused]);
 const harborLabels=useRef<HTMLDivElement>(null);
 const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
 const sceneResources=useRef<{scene:THREE.Scene;camera:THREE.OrthographicCamera;hemisphere:THREE.HemisphereLight;sun:THREE.DirectionalLight}|null>(null);
 const sharedGeometry=useRef(new Map<string,THREE.BufferGeometry>());
 const staticTerrain=useRef<{board:Board;objects:THREE.Object3D[];vegetation:{mesh:THREE.Mesh;phase:number}[];batches:Map<string,{mesh:THREE.InstancedMesh;items:{mesh:THREE.Mesh;phase:number}[]}>;selectable:THREE.Object3D[];geometry:THREE.CylinderGeometry;materials:Map<string,THREE.MeshStandardMaterial>;staticBatches:THREE.InstancedMesh[];staticSources:number}|null>(null);
 const harborCache=useRef<{board:Board;objects:THREE.Object3D[];boats:THREE.Group[];batches:THREE.InstancedMesh[];boatBatches:BoatBatch[]}|null>(null);
 const waterCache=useRef<{board:Board;mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>}|null>(null);
 const sharedMaterials=useRef(new Map<string,THREE.MeshStandardMaterial>());
 const tokenResources=useRef<{geometry:THREE.CircleGeometry;materials:Map<number,THREE.MeshBasicMaterial>}|null>(null);
 const tokenObjects=useRef<{board:Board;objects:THREE.InstancedMesh[];numberTokens:number}|null>(null);
 const legalMarkerCache=useRef<{board:Board;key:string;meshes:THREE.InstancedMesh[]}|null>(null);
 const pickCache=useRef<{board:Board;objects:THREE.Object3D[];vertexGeometry:THREE.SphereGeometry;edgeGeometry:THREE.BoxGeometry;material:THREE.MeshBasicMaterial}|null>(null);
 const disposePicks=()=>{const cache=pickCache.current;if(cache){cache.vertexGeometry.dispose();cache.edgeGeometry.dispose();cache.material.dispose();pickCache.current=null;}};
 useEffect(()=>{return()=>{rendererRef.current?.dispose();rendererRef.current?.domElement.remove();rendererRef.current=null;sceneResources.current?.sun.shadow.dispose();sceneResources.current?.scene.clear();sceneResources.current=null;robberCache.current=null;harborCache.current?.batches.forEach(b=>b.dispose());harborCache.current?.boatBatches.forEach(b=>b.mesh.dispose());harborCache.current=null;roadBatchCache.current?.meshes.forEach(m=>m.dispose());roadBatchCache.current=null;buildingBatchCache.current?.meshes.forEach(m=>m.dispose());buildingBatchCache.current=null;pieceCache.current=null;previousPieces.current=null;previousRobber.current=null;tokenObjects.current?.objects.forEach(mesh=>mesh.dispose());tokenObjects.current=null;const tokens=tokenResources.current;if(tokens){tokens.geometry.dispose();tokens.materials.forEach(m=>{m.map?.dispose();m.dispose();});tokenResources.current=null;}disposePicks();legalMarkerCache.current?.meshes.forEach(m=>m.dispose());legalMarkerCache.current=null;waterCache.current?.mesh.geometry.dispose();waterCache.current?.mesh.material.map?.dispose();waterCache.current?.mesh.material.dispose();waterCache.current=null;const terrain=staticTerrain.current;if(terrain){terrain.geometry.dispose();terrain.materials.forEach(m=>m.dispose());terrain.batches.forEach(b=>b.mesh.dispose());terrain.staticBatches.forEach(b=>b.dispose());staticTerrain.current=null;}for(const g of sharedGeometry.current.values())g.dispose();sharedGeometry.current.clear();for(const m of sharedMaterials.current.values())m.dispose();sharedMaterials.current.clear();};},[]);
 const robberCache=useRef<THREE.Mesh[]|null>(null);
 const previousRobber=useRef<{board:Board;tile?:string}|null>(null);
 const roadBatchCache=useRef<{board:Board;key:string;meshes:THREE.InstancedMesh[]}|null>(null);
 const buildingBatchCache=useRef<{board:Board;key:string;meshes:THREE.InstancedMesh[]}|null>(null);
 const pieceCache=useRef<{board:Board;entries:Map<string,{objects:THREE.Object3D[];pick:THREE.Object3D}>}|null>(null);
 const previousPieces=useRef<{board:Board;keys:Set<string>}|null>(null);
 const cameraPose=useRef({zoom:1,azimuth:0,panX:0,panY:0});
 // Parent game UI creates fresh arrays on every render; only rebuild WebGL when their content changes.
 const diceKey=diceRoll?diceRoll.values.join(',')+':'+diceRoll.duration:'';
 useEffect(()=>{void loadDicePhysics().catch(()=>{});},[]);
 const productionKey=(producingTiles??[]).join('|');
 const piecesKey=JSON.stringify(pieces??null);
 const legalVerticesKey=(legalVertices??[]).join('|');
 const legalEdgesKey=(legalEdges??[]).join('|');
 const [selected,setSelected]=useState<BoardSelection|null>(null);
 const robberDropCallback=useRef(onRobberDrop);robberDropCallback.current=onRobberDrop;
 const selectionCallback=useRef(onSelect);selectionCallback.current=onSelect;
 const fallback=useRef(onUnavailable);fallback.current=onUnavailable;
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=rendererRef.current??new THREE.WebGLRenderer({antialias:true,alpha:false});rendererRef.current=renderer;renderer.shadowMap.autoUpdate=false;}catch{fallback.current();return;}
  const tier=quality==='auto'?(window.matchMedia('(pointer: coarse)').matches?'medium':'high'):quality;
  if(!sceneResources.current){const scene=new THREE.Scene();scene.background=new THREE.Color('#183e49');sceneResources.current={scene,camera:new THREE.OrthographicCamera(-1,1,1,-1,.1,500),hemisphere:new THREE.HemisphereLight('#fff0d9','#69808a',1.25),sun:new THREE.DirectionalLight('#ffe4ba',2.45)};}
  const {scene,camera,hemisphere,sun}=sceneResources.current;
  // Reconcile root membership without detaching unchanged objects from the live scene.
  const previousRoots=new Set(scene.children);
  const desired:THREE.Object3D[]=[];
  const desiredSet=new Set<THREE.Object3D>();
  const include=(...objects:THREE.Object3D[])=>{for(const object of objects){if(!desiredSet.has(object)){desiredSet.add(object);desired.push(object);}if(object.parent!==scene)scene.add(object);}};
  const exclude=(object:THREE.Object3D)=>{desiredSet.delete(object);const index=desired.indexOf(object);if(index>=0)desired.splice(index,1);};
  const groupSince=(group:THREE.Group,start:number)=>{const members=desired.slice(start);include(group);for(const mesh of members){if(mesh instanceof THREE.Mesh){group.attach(mesh);exclude(mesh);}}};
  const selectable:THREE.Object3D[]=[];
  const positions=board.tiles.map(t=>({tile:t,p:tilePosition(t,1)}));
  const bounds=new THREE.Box3();
  if(staticTerrain.current&&staticTerrain.current.board!==board){const old=staticTerrain.current;old.geometry.dispose();old.materials.forEach(m=>m.dispose());old.batches.forEach(b=>b.mesh.dispose());old.staticBatches.forEach(b=>b.dispose());staticTerrain.current=null;}
  const cachedTerrain=staticTerrain.current;
  const geometry=cachedTerrain?.geometry??new THREE.CylinderGeometry(.98,.98,.24,6);
  if(!cachedTerrain){
   const positions=geometry.getAttribute('position'),colors=new Float32Array(positions.count*3);
   const lower=new THREE.Color('#b5ac91'),upper=new THREE.Color('#ffffff');
   for(let i=0;i<positions.count;i++){const c=lower.clone().lerp(upper,THREE.MathUtils.smoothstep(positions.getY(i),-.12,.12));c.toArray(colors,i*3);}
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  }
  const materials=cachedTerrain?.materials??new Map<string,THREE.MeshStandardMaterial>();
  const geometryCache=sharedGeometry.current;
  
  const add=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>{const key=g.type+JSON.stringify((g as THREE.BoxGeometry).parameters);const cached=geometryCache.get(key);if(cached){g.dispose();g=cached;}else{geometryCache.set(key,g);}let m=sharedMaterials.current.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,flatShading:true,roughness:1});sharedMaterials.current.set(color,m);}const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);include(mesh);return mesh;};
  const vegetation: {mesh:THREE.Mesh;phase:number}[]=cachedTerrain?.vegetation??[];
  if(cachedTerrain){include(...cachedTerrain.objects);selectable.push(...cachedTerrain.selectable);}else for(const {tile,p} of positions){
   const color=TERRAIN_COLORS[tile.terrain];
   let mat=materials.get(color);if(!mat){mat=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true,vertexColors:true});materials.set(color,mat);}
   const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(p.x,0,p.y);include(mesh);mesh.userData={selection:{kind:'tile',id:tile.id}};selectable.push(mesh);bounds.expandByObject(mesh);
   const x=p.x,z=p.y;
   // Miniature terrain uses shared unit geometry and per-instance transforms.
   // Leave the southern token shelf and perimeter construction sites clear.
   const rotation=((Math.round(p.x*100)*31+Math.round(p.y*100)*17)%17)*.045;
   const detail=(g:THREE.BufferGeometry,c:string,dx:number,y:number,dz:number,sx=1,sy=1,sz=1)=>{const m=add(g,c,x+dx,y,z+dz);m.scale.set(sx,sy,sz);m.rotation.y=rotation;return m;};
   switch(tile.terrain){
    case 'forest': {
     const trees=[[-.42,-.26,.92],[.02,-.40,1.15],[.42,-.22,.8],[-.25,.17,1.04],[.27,.21,.88]];
     for(const [dx,dz,h] of trees){
      detail(new THREE.CylinderGeometry(.038,.053,.22,5),'#76553b',dx,.23,dz,1,h,1);
      detail(new THREE.ConeGeometry(.23,.42,6),'#315d45',dx,.32+h*.12,dz,h,h,h);
      detail(new THREE.ConeGeometry(.17,.34,6),'#497458',dx,.51+h*.12,dz,h,h,h);
     }
     break;
    }
    case 'pasture': {
     for(const [dx,dz,scale] of [[-.31,-.24,1],[.07,-.32,.85],[.34,.04,.9],[-.22,.22,.75]]){
      detail(new THREE.IcosahedronGeometry(.13,0),'#e0d9bd',dx,.24,dz,1.4*scale,.8*scale,scale);
      detail(new THREE.IcosahedronGeometry(.055,0),'#665e50',dx+.14*scale,.24,dz,scale,scale,scale);
     }
     for(const [dx,dz] of [[-.45,.03],[.18,.34],[.42,-.3]])detail(new THREE.ConeGeometry(.09,.12,4),'#7d9460',dx,.16,dz,1,.7,1);
     break;
    }
    case 'field': {
     for(let i=0;i<5;i++){
      const dx=(i-2)*.18;
      detail(new THREE.BoxGeometry(.13,.035,.78),'#8f713e',dx,.14,-.12).rotation.y=0;
      for(let j=0;j<5;j++){
       const plant=detail(new THREE.ConeGeometry(.055,.15,4),'#e3bf65',dx,.22,(j-2)*.15-.12,1,.85+((i+j)%3)*.15,1);
       vegetation.push({mesh:plant,phase:x+z+i*.3+j*.2});
      }
     }
     break;
    }
    case 'hill': {
     for(const [dx,dz,h] of [[-.34,-.18,.28],[.18,-.22,.36],[.36,.17,.24],[-.16,.23,.18]]){
      detail(new THREE.IcosahedronGeometry(.35,0),'#b67d55',dx,.12+h*.3,dz,.9,h/.35,.85);
     }
     for(const [dx,dz] of [[-.34,.05],[.12,.15],[.43,-.14]])detail(new THREE.IcosahedronGeometry(.10,0),'#d69a71',dx,.17,dz,1,.55,.85);
     break;
    }
    case 'mountain': {
     for(const [dx,dz,h,w] of [[-.30,-.20,.85,.37],[.26,-.12,.66,.32],[.02,.20,.43,.26]]){
      const peak=detail(new THREE.ConeGeometry(1,1,5),'#697b85',dx,.12+h/2,dz,w,h,w);
      const snow=detail(new THREE.ConeGeometry(1,1,5),'#e2e6df',dx,.12+h*.825,dz,w*.35,h*.35,w*.35);snow.rotation.y=peak.rotation.y;
     }
     break;
    }
    case 'desert': {
     detail(new THREE.SphereGeometry(.5,6,3),'#e2c18a',-.18,-.01,-.13,1,.36,.65);
     detail(new THREE.SphereGeometry(.5,6,3),'#e2c18a',.32,-.025,.13,.65,.33,.45);
     break;
    }
   }
  }
  const oldRobber=previousRobber.current;previousRobber.current={board,tile:robberTile};
  const origin=oldRobber?.board===board&&oldRobber.tile!==robberTile&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches?positions.find(({tile})=>tile.id===oldRobber.tile):undefined;
  const robberMeshes:THREE.Mesh[]=[];
  const batches=cachedTerrain?.batches??new Map<string,{mesh:THREE.InstancedMesh;items:typeof vegetation}>();
  if(!cachedTerrain){
  const grouped=new Map<string,typeof vegetation>();for(const item of vegetation){const key=item.mesh.geometry.uuid+':'+(item.mesh.material as THREE.Material).uuid;const list=grouped.get(key)??[];list.push(item);grouped.set(key,list);}
  for(const [key,items] of grouped){const first=items[0].mesh;const mesh=new THREE.InstancedMesh(first.geometry,first.material,items.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);items.forEach((item,i)=>{item.mesh.updateMatrix();mesh.setMatrixAt(i,item.mesh.matrix);scene.remove(item.mesh);exclude(item.mesh);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();include(mesh);batches.set(key,{mesh,items});}
  // Static decoration only: terrain hexes retain their individual raycast IDs,
  // and animated vegetation keeps its separate dynamic instance buffers.
  const pickable=new Set(selectable);
  const groups=new Map<string,THREE.Mesh[]>();
  for(const object of desired){
   if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||pickable.has(object)||Array.isArray(object.material))continue;
   const key=object.geometry.uuid+':'+object.material.uuid;
   const list=groups.get(key)??[];list.push(object);groups.set(key,list);
  }
  const staticBatches:THREE.InstancedMesh[]=[];let staticSources=0;
  for(const items of groups.values()){
   if(items.length<2)continue;
   const first=items[0],batch=new THREE.InstancedMesh(first.geometry,first.material,items.length);
   items.forEach((item,i)=>{item.updateMatrix();batch.setMatrixAt(i,item.matrix);scene.remove(item);exclude(item);});
   batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();
   include(batch);staticBatches.push(batch);staticSources+=items.length;
  }
  staticTerrain.current={board,objects:[...desired],vegetation,batches,selectable:[...selectable],geometry,materials,staticBatches,staticSources};}
  const robber=positions.find(({tile})=>tile.id===robberTile);
  if(robber){
   const {x,y:z}=robber.p;
   if(!robberCache.current){robberCache.current=[
    add(new THREE.CylinderGeometry(.19,.24,.09,8),'#292e35',x,.18,z+.40),
    add(new THREE.CylinderGeometry(.10,.17,.38,6),'#343942',x,.40,z+.40),
    add(new THREE.IcosahedronGeometry(.12,0),'#252a31',x,.66,z+.40)
   ];}
   robberCache.current.forEach((mesh,i)=>{mesh.position.set(x,[.18,.40,.66][i],z+.40);mesh.userData={selection:{kind:'tile',id:robber.tile.id}};include(mesh);selectable.push(mesh);robberMeshes.push(mesh);});
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
  // Synthetic render-only workload, opt-in solely through the benchmark URL.
  // Never writes to game state or the save. Counts are capped by board topology.
  const params=new URLSearchParams(window.location.search);
  const stress=params.get('benchmark3d')==='1'?params.get('stress3d'):null;
  const levels:Record<string,[number,number,number]>={early:[12,12,0],mid:[35,18,6],late:[60,20,18],max:[90,30,24]};
  const load=stress&&Object.prototype.hasOwnProperty.call(levels,stress)?levels[stress]:null;
  const stressColors=['#bd5145','#4189b8','#e9d8b4','#de963f','#56885a','#8c629f'];
  const synthetic:Pieces|null=load?{
   roads:board.edges.slice(0,load[0]).map((edge,i)=>({edgeId:edge.id,color:stressColors[i%6]})),
   buildings:board.vertices.slice(0,load[1]+load[2]).map((vertex,i)=>({vertexId:vertex.id,color:stressColors[i%6],kind:i<load[1]?'settlement':'city'}))
  }:null;
  const display=synthetic??pieces??sample;
  if(synthetic)renderer.domElement.dataset.stress3d=JSON.stringify({level:stress,roads:synthetic.roads.length,settlements:synthetic.buildings.filter(b=>b.kind==='settlement').length,cities:synthetic.buildings.filter(b=>b.kind==='city').length});
  else delete renderer.domElement.dataset.stress3d;
  const keys=new Set([...display.roads.map(r=>'road:'+r.edgeId),...display.buildings.map(b=>b.kind+':'+b.vertexId)]);
  const prior=previousPieces.current;previousPieces.current={board,keys};
  const animate=!synthetic&&!!pieces&&prior?.board===board&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(pieceCache.current?.board!==board)pieceCache.current={board,entries:new Map()};
  const entries=pieceCache.current.entries;
  const activeKeys=new Set([...display.roads.map(r=>'road:'+r.edgeId+':'+r.color),...display.buildings.map(b=>b.kind+':'+b.vertexId+':'+b.color)]);
  for(const key of entries.keys())if(!activeKeys.has(key))entries.delete(key);
  const reuse=(key:string)=>{const entry=entries.get(key);if(!entry)return false;for(const object of entry.objects){if(object instanceof THREE.Group){object.scale.y=1;object.position.y=.12;}include(object);}selectable.push(entry.pick);return true;};
  const animated:THREE.Group[]=[];
  const groupNew=(key:string,start:number,x:number,z:number)=>{if(!animate||prior?.keys.has(key))return;const group=new THREE.Group();group.position.set(x,.12,z);groupSince(group,start);animated.push(group);};
  const settledRoads:{id:string;color:string;length:number;x:number;z:number;angle:number}[]=[];
  for(const road of display.roads){const edge=board.edges.find(e=>e.id===road.edgeId);if(!edge)continue;const a=vertices.get(edge.a),b=vertices.get(edge.b);if(!a||!b)continue;
   const cacheKey='road:'+road.edgeId+':'+road.color;
   const length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);
   if(!animate||prior?.keys.has('road:'+road.edgeId)){
    settledRoads.push({id:road.edgeId,color:road.color,length,x:(a.x+b.x)/2,z:(a.y+b.y)/2,angle});entries.delete(cacheKey);continue;
   }
   if(reuse(cacheKey))continue;
   const start=desired.length;
   // A stone verge and a raised, owner-coloured road surface retain the same two meshes.
   add(new THREE.BoxGeometry(length*.94,.095,.22),'#97846a',(a.x+b.x)/2,.1675,(a.y+b.y)/2).rotation.y=-angle;
   const pick=add(new THREE.BoxGeometry(length*.88,.045,.15),road.color,(a.x+b.x)/2,.2375,(a.y+b.y)/2);pick.rotation.y=-angle;pick.userData={selection:{kind:'edge',id:edge.id}};selectable.push(pick);groupNew('road:'+road.edgeId,start,(a.x+b.x)/2,(a.y+b.y)/2);entries.set(cacheKey,{objects:desired.slice(start),pick});
  }
  // Settled roads have two shared unit geometries and per-instance owner colours.
  // New roads still use the existing placement group until the next reconciliation.
  const roadKey=JSON.stringify(settledRoads.map(r=>[r.id,r.color]).sort((a,b)=>a[0].localeCompare(b[0])));
  if(roadBatchCache.current?.board!==board||roadBatchCache.current.key!==roadKey){
   roadBatchCache.current?.meshes.forEach(m=>m.dispose());
   const meshes:THREE.InstancedMesh[]=[];
   if(settledRoads.length){
    const dummy=new THREE.Object3D();
    for(const layer of [{y:.1675,h:.095,w:.22,l:.94,color:'#97846a'},{y:.2375,h:.045,w:.15,l:.88,color:null}]){
     const source=add(new THREE.BoxGeometry(1,layer.h,layer.w),'#ffffff',0,0,0);
     scene.remove(source);exclude(source);
     const batch=new THREE.InstancedMesh(source.geometry,source.material,settledRoads.length);
     settledRoads.forEach((road,i)=>{
      dummy.position.set(road.x,layer.y,road.z);dummy.rotation.set(0,-road.angle,0);dummy.scale.set(road.length*layer.l,1,1);dummy.updateMatrix();
      batch.setMatrixAt(i,dummy.matrix);batch.setColorAt(i,new THREE.Color(layer.color??road.color));
     });
     batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;
     batch.computeBoundingBox();batch.computeBoundingSphere();meshes.push(batch);
    }
   }
   roadBatchCache.current={board,key:roadKey,meshes};
  }
  include(...roadBatchCache.current.meshes);
  const settledBuildings=display.buildings.filter(building=>!animate||prior?.keys.has(building.kind+':'+building.vertexId));
  const buildingKey=JSON.stringify(settledBuildings.map(v=>[v.kind,v.vertexId,v.color]).sort((a,b)=>a[1].localeCompare(b[1])));
  const cachedBuildings=buildingBatchCache.current?.board===board&&buildingBatchCache.current.key===buildingKey?buildingBatchCache.current:null;
  const settledParts:THREE.Mesh[]=[];
  for(const building of display.buildings){const p=vertices.get(building.vertexId);if(!p)continue;
   const cacheKey=building.kind+':'+building.vertexId+':'+building.color;
   const settled=!animate||prior?.keys.has(building.kind+':'+building.vertexId);
   if(settled){entries.delete(cacheKey);if(cachedBuildings)continue;}else if(reuse(cacheKey))continue;
   const start=desired.length;
   // The plinth and roof identify the owner from every camera angle.
   // A gabled cottage uses the same three meshes as the old pyramid house.
   const pick=add(new THREE.BoxGeometry(.49,.07,.43),building.color,p.x,.17,p.y);pick.userData={selection:{kind:'vertex',id:building.vertexId}};if(!settled)selectable.push(pick);
   const house=(x:number,z:number,w:number,h:number)=>{
    add(new THREE.BoxGeometry(w,h,w*.85),'#e1c9a3',x,.21+h/2,z);
    const r=w*.65;
    const roof=add(new THREE.CylinderGeometry(r,r,w*.98,3,1),building.color,x,.21+h+r*.5,z);
    roof.rotation.x=-Math.PI/2;
    add(new THREE.BoxGeometry(w*.25,h*.65,.025),'#493a30',x,.21+h*.325,z+w*.43);
    for(const side of [-1,1]){const window=add(new THREE.BoxGeometry(.018,.065,.065),'#675c48',x+side*w*.505,.21+h*.65,z);window.rotation.y=0;}
   };
   const tower=(x:number,z:number)=>{
    const w=.22,h=.41;
    add(new THREE.CylinderGeometry(w*.48,w*.58,h,6),'#b7ad96',x,.21+h/2,z);
    add(new THREE.ConeGeometry(w*.69,.19,6),building.color,x,.21+h+.095,z);
    add(new THREE.BoxGeometry(.055,.11,.018),'#514b40',x,.21+h*.68,z+w*.51);
    add(new THREE.CylinderGeometry(.13,.13,.035,6),'#d6c7a6',x,.21+h*.80,z);
   };
   if(building.kind==='city'){tower(p.x-.12,p.y-.015);house(p.x+.13,p.y+.025,.25,.23);}else house(p.x,p.y,.30,.23);
   if(settled){
    for(const mesh of desired.slice(start)){
     if(mesh instanceof THREE.Mesh){settledParts.push(mesh);scene.remove(mesh);exclude(mesh);}
    }
   }else{
    groupNew(building.kind+':'+building.vertexId,start,p.x,p.y);entries.set(cacheKey,{objects:desired.slice(start),pick});
   }
  }
  // Settled structures reuse the same source geometry as animated structures.
  // A neutral shared material with instance colors preserves all player and stone colors.
  if(!cachedBuildings){
   buildingBatchCache.current?.meshes.forEach(m=>m.dispose());
   const groups=new Map<string,THREE.Mesh[]>();
   for(const mesh of settledParts){const list=groups.get(mesh.geometry.uuid)??[];list.push(mesh);groups.set(mesh.geometry.uuid,list);}
   let material=sharedMaterials.current.get('building-instance-neutral');
   if(!material){material=new THREE.MeshStandardMaterial({color:'#ffffff',flatShading:true,roughness:1});sharedMaterials.current.set('building-instance-neutral',material);}
   const meshes:THREE.InstancedMesh[]=[];
   for(const items of groups.values()){
    const batch=new THREE.InstancedMesh(items[0].geometry,material,items.length);
    items.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);batch.setColorAt(i,(mesh.material as THREE.MeshStandardMaterial).color);});
    batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;
    batch.computeBoundingBox();batch.computeBoundingSphere();meshes.push(batch);
   }
   buildingBatchCache.current={board,key:buildingKey,meshes};
  }
  include(...buildingBatchCache.current!.meshes);
  // Invisible selection volumes cover every buildable graph location, including empty sites.
  // Keep them separate from visible meshes so construction remains possible before ownership.
  const legalVertexSet=new Set(legalVertices??[]),legalEdgeSet=new Set(legalEdges??[]);
  // Pick volumes are immutable for a board. All vertices share one sphere and
  // all edges share one unit box scaled to their individual length.
  if(pickCache.current?.board!==board){
   disposePicks();
   const vertexGeometry=new THREE.SphereGeometry(.20,8,6);
   const edgeGeometry=new THREE.BoxGeometry(1,.13,.16);
   const material=new THREE.MeshBasicMaterial({visible:false,depthWrite:false});
   const objects:THREE.Object3D[]=[];
   for(const vertex of board.vertices){
    const p=vertices.get(vertex.id);if(!p)continue;
    const mesh=new THREE.Mesh(vertexGeometry,material);mesh.position.set(p.x,.32,p.y);
    mesh.userData={selection:{kind:'vertex',id:vertex.id}};objects.push(mesh);
   }
   for(const edge of board.edges){
    const a=vertices.get(edge.a),b=vertices.get(edge.b);if(!a||!b)continue;
    const mesh=new THREE.Mesh(edgeGeometry,material);mesh.scale.x=Math.hypot(b.x-a.x,b.y-a.y)*.68;
    mesh.position.set((a.x+b.x)/2,.29,(a.y+b.y)/2);
    mesh.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);
    mesh.userData={selection:{kind:'edge',id:edge.id}};objects.push(mesh);
   }
   pickCache.current={board,objects,vertexGeometry,edgeGeometry,material};
  }
  const pickObjects=pickCache.current.objects;include(...pickObjects);
  // Batch legal markers separately from the immutable, invisible pick volumes.
  const markerKey=JSON.stringify([[...legalVertexSet].sort(),[...legalEdgeSet].sort()]);
  if(legalMarkerCache.current?.board!==board||legalMarkerCache.current.key!==markerKey){
   legalMarkerCache.current?.meshes.forEach(mesh=>mesh.dispose());
   const meshes:THREE.InstancedMesh[]=[];
   const rings:THREE.Mesh[]=[],roads:THREE.Mesh[]=[];
   for(const id of legalVertexSet){const p=vertices.get(id);if(p){const m=add(new THREE.TorusGeometry(.19,.035,6,12),'#f5d784',p.x,.20,p.y);m.rotation.x=-Math.PI/2;rings.push(m);}}
   for(const edge of board.edges){
    if(!legalEdgeSet.has(edge.id))continue;
    const a=vertices.get(edge.a),b=vertices.get(edge.b);if(!a||!b)continue;
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    const m=add(new THREE.BoxGeometry(1,.045,.065),'#f5d784',(a.x+b.x)/2,.23,(a.y+b.y)/2);
    m.scale.x=length*.65;m.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);roads.push(m);
   }
   for(const items of [rings,roads]){
    if(!items.length)continue;
    const batch=new THREE.InstancedMesh(items[0].geometry,items[0].material,items.length);
    items.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);scene.remove(mesh);exclude(mesh);});
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();
    meshes.push(batch);
   }
   legalMarkerCache.current={board,key:markerKey,meshes};
  }
  include(...legalMarkerCache.current.meshes);
  // One texture/material per dice number, rather than per tile or scene update.
  const tokens=tokenResources.current??(tokenResources.current={geometry:new THREE.CircleGeometry(.26,32),materials:new Map()});
  if(tokenObjects.current?.board===board){include(...tokenObjects.current.objects);}else{
   tokenObjects.current?.objects.forEach(mesh=>mesh.dispose());
   const groups=new Map<string,THREE.Mesh[]>();let numberTokens=0;
   const groupToken=(mesh:THREE.Mesh)=>{const key=mesh.geometry.uuid+':'+(mesh.material as THREE.Material).uuid;const group=groups.get(key)??[];group.push(mesh);groups.set(key,group);};
   for(const {tile,p} of positions){
    if(!('number' in tile)||typeof tile.number!=='number'||tile.number<2||tile.number>12||tile.number===7)continue;
    const number=tile.number;let material=tokens.materials.get(number);
    if(!material){
     const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)continue;
     const ink=number===6||number===8?'#922e27':'#292820';
     ctx.fillStyle='#f9edce';ctx.fillRect(0,0,128,128);
     ctx.strokeStyle='#a78b56';ctx.lineWidth=4;ctx.beginPath();ctx.arc(64,64,58,0,Math.PI*2);ctx.stroke();
     ctx.fillStyle=ink;ctx.font='bold 72px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(number),64,51);
     const pips=6-Math.abs(7-number);
     for(let i=0;i<pips;i++){ctx.beginPath();ctx.arc(64+(i-(pips-1)/2)*13,94,4,0,Math.PI*2);ctx.fill();}
     const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
     material=new THREE.MeshBasicMaterial({map:texture});tokens.materials.set(number,material);
    }
    const base=add(new THREE.CylinderGeometry(.28,.28,.09,32),'#cbb083',p.x,.205,p.y+.48);exclude(base);groupToken(base);
    const token=new THREE.Mesh(tokens.geometry,material);token.rotation.x=-Math.PI/2;token.position.set(p.x,.253,p.y+.48);groupToken(token);numberTokens++;
   }
   const objects:THREE.InstancedMesh[]=[];
   for(const items of groups.values()){const first=items[0];const batch=new THREE.InstancedMesh(first.geometry,first.material,items.length);items.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);});batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();include(batch);objects.push(batch);}
   tokenObjects.current={board,objects,numberTokens};
  }
  const cachedHarbors=harborCache.current?.board===board?harborCache.current:null;
  const boats:THREE.Group[]=cachedHarbors?.boats??[];
  const boatMatrix=new THREE.Matrix4();
  const boatBatches:BoatBatch[]=cachedHarbors?.boatBatches??[];
  const harborStart=desired.length;
  if(cachedHarbors){include(...cachedHarbors.objects);}else for(const harbor of board.harbors){
   const edge=board.edges.find(e=>e.id===harbor.edgeId);if(!edge)continue;const a=vertices.get(edge.a),b=vertices.get(edge.b),t=positions.find(t=>t.tile.id===edge.tiles[0]);if(!a||!b||!t)continue;
   const x=(a.x+b.x)/2,z=(a.y+b.y)/2,dx=x-t.p.x,dz=z-t.p.y,len=Math.hypot(dx,dz);if(!len)continue;const ux=dx/len,uz=dz/len,angle=Math.atan2(uz,ux);
   // Wooden jetty, with a darker crosspiece at its seaward end.
   add(new THREE.BoxGeometry(.65,.10,.30),'#98764e',x+ux*.24,.03,z+uz*.24).rotation.y=-angle;
   const end=add(new THREE.BoxGeometry(.065,.13,.36),'#624b38',x+ux*.51,.045,z+uz*.51);end.rotation.y=-angle;
   const sx=x+ux*.78,sz=z+uz*.78;
   const boatStart=desired.length;
   // Long, tapered clinker hull oriented alongside the dock.
   const hull=add(new THREE.SphereGeometry(.29,8,4),'#684d36',sx,-.03,sz);hull.scale.set(1.35,.45,.60);hull.rotation.y=-angle+Math.PI/2;
   add(new THREE.CylinderGeometry(.021,.025,.48,6),'#825d40',sx,.23,sz);
   // A triangular canvas sail, coloured by the existing harbour specialization.
   const sailColor=harbor.resource?TERRAIN_COLORS[harbor.resource]:'#e9dfbe';
   const sail=add(new THREE.CylinderGeometry(.22,.22,.035,3,1),sailColor,sx,.36,sz);
   sail.rotation.set(Math.PI/2,0,-angle);
   sail.scale.set(1,1,1.10);
   const boat=new THREE.Group();boat.position.set(sx,0,sz);groupSince(boat,boatStart);boats.push(boat);
  }
  if(!cachedHarbors){
   harborCache.current?.batches.forEach(b=>b.dispose());
   harborCache.current?.boatBatches.forEach(b=>b.mesh.dispose());
   // Only dock meshes are static; animated boat groups keep their original transforms.
   const groups=new Map<string,THREE.Mesh[]>();
   for(const object of desired.slice(harborStart)){
    if(!(object instanceof THREE.Mesh)||Array.isArray(object.material))continue;
    const key=object.geometry.uuid+':'+object.material.uuid;
    const items=groups.get(key)??[];items.push(object);groups.set(key,items);
   }
   const batches:THREE.InstancedMesh[]=[];
   for(const items of groups.values()){
    if(items.length<2)continue;
    const batch=new THREE.InstancedMesh(items[0].geometry,items[0].material,items.length);
    items.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);scene.remove(mesh);exclude(mesh);});
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();
    include(batch);batches.push(batch);
   }
   // Three shared geometry batches: hull, mast and sail. Instance colours
   // preserve each harbour's resource palette without splitting sail draw calls.
   const byGeometry=new Map<string,{boat:THREE.Group;part:THREE.Mesh}[]>();
   for(const boat of boats){
    boat.updateMatrix();
    for(const part of boat.children){
     if(!(part instanceof THREE.Mesh)||!(part.material instanceof THREE.MeshStandardMaterial))continue;
     part.updateMatrix();const key=part.geometry.uuid;
     const items=byGeometry.get(key)??[];items.push({boat,part});byGeometry.set(key,items);
    }
   }
   const matrix=new THREE.Matrix4();
   let boatMaterial=sharedMaterials.current.get('boat-instance-neutral');
   if(!boatMaterial){boatMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',flatShading:true,roughness:1});sharedMaterials.current.set('boat-instance-neutral',boatMaterial);}
   for(const items of byGeometry.values()){
    const batch=new THREE.InstancedMesh(items[0].part.geometry,boatMaterial,items.length);
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const parts=items.map(({boat,part},i)=>{
     const local=part.matrix.clone();batch.setMatrixAt(i,matrix.multiplyMatrices(boat.matrix,local));
     batch.setColorAt(i,(part.material as THREE.MeshStandardMaterial).color);
     return {boat,local};
    });
    batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;
    batch.computeBoundingBox();batch.computeBoundingSphere();
    // Animated displacement is small; disable culling to avoid edge popping.
    batch.frustumCulled=false;
    include(batch);boatBatches.push({mesh:batch,parts});
   }
   for(const boat of boats){scene.remove(boat);exclude(boat);}
   harborCache.current={board,objects:desired.slice(harborStart),boats,batches,boatBatches};
  }
  scene.updateMatrixWorld(true);bounds.makeEmpty();for(const object of desired)bounds.expandByObject(object);
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const span=Math.max(size.x,size.z)+3;
  if(waterCache.current?.board!==board){
   waterCache.current?.mesh.geometry.dispose();waterCache.current?.mesh.material.map?.dispose();waterCache.current?.mesh.material.dispose();
   // The wave mesh keeps its existing 25x25 topology. A cached procedural
   // depth texture provides a finer coastal gradient without new draw calls.
   const plane=new THREE.PlaneGeometry(span*8,span*8,24,24);
   const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.76});
   const resolution=256,extent=span*8,data=new Uint8Array(resolution*resolution*4);
   const deep=new THREE.Color('#24515d'),shallow=new THREE.Color('#588f89'),sand=new THREE.Color('#96ad92');
   const sample=new THREE.Color();
   for(let row=0;row<resolution;row++)for(let col=0;col<resolution;col++){
    const wx=center.x+((col+.5)/resolution-.5)*extent,wz=center.z+(.5-(row+.5)/resolution)*extent;
    let distance=Infinity;
    for(const {p} of positions)distance=Math.min(distance,Math.hypot(wx-p.x,wz-p.y));
    const coast=Math.max(0,distance-.9);
    sample.copy(shallow).lerp(deep,THREE.MathUtils.smoothstep(coast,.15,2.4));
    sample.lerp(sand,(1-THREE.MathUtils.smoothstep(coast,.04,.45))*.45);
    sample.convertLinearToSRGB();
    const offset=(row*resolution+col)*4;
    data[offset]=Math.round(sample.r*255);data[offset+1]=Math.round(sample.g*255);data[offset+2]=Math.round(sample.b*255);data[offset+3]=255;
   }
   const texture=new THREE.DataTexture(data,resolution,resolution,THREE.RGBAFormat);
   texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
   material.map=texture;
   waterCache.current={board,mesh:new THREE.Mesh(plane,material)};
  }
  const water=waterCache.current.mesh;const waterGeometry=water.geometry;water.rotation.x=-Math.PI/2;water.position.set(center.x,-.15,center.z);include(water);water.receiveShadow=true;
  // The two separable waves have analytic slopes. Precompute spatial phases
  // once per scene update; animate without rebuilding triangle normals.
  const waveSize=25,waveX=new Float32Array(waveSize),waveY=new Float32Array(waveSize);
  const waveDx=new Float32Array(waveSize),waveDy=new Float32Array(waveSize);
  const waterPosition=waterGeometry.attributes.position,waterNormal=waterGeometry.attributes.normal;
  const phaseX=Array.from({length:waveSize},(_,i)=>waterPosition.getX(i)*.8);
  const phaseY=Array.from({length:waveSize},(_,i)=>waterPosition.getY(i*waveSize)*.9);
  if(waterPosition instanceof THREE.BufferAttribute&&waterPosition.version===0)waterPosition.setUsage(THREE.DynamicDrawUsage);
  if(waterNormal instanceof THREE.BufferAttribute&&waterNormal.version===0)waterNormal.setUsage(THREE.DynamicDrawUsage);
  const animateWater=(t:number)=>{
   for(let i=0;i<waveSize;i++){const x=phaseX[i]+t,y=phaseY[i]-t*.8;waveX[i]=.035*Math.sin(x);waveY[i]=.025*Math.cos(y);waveDx[i]=.028*Math.cos(x);waveDy[i]=-.0225*Math.sin(y);}
   for(let y=0;y<waveSize;y++)for(let x=0;x<waveSize;x++){const i=y*waveSize+x,dx=waveDx[x],dy=waveDy[y],length=Math.sqrt(1+dx*dx+dy*dy);waterPosition.setZ(i,waveX[x]+waveY[y]);waterNormal.setXYZ(i,-dx/length,-dy/length,1/length);}
   waterPosition.needsUpdate=true;waterNormal.needsUpdate=true;
  };
  include(hemisphere);
  sun.position.set(center.x-7,12,center.z+5);sun.target.position.copy(center);include(sun,sun.target);
  if(quality!=='auto'||ambientSampling.current?.quality!=='auto')autoShadows.current={enabled:true,slow:0,fast:0};
  renderer.shadowMap.enabled=tier!=='low'&&(quality!=='auto'||autoShadows.current.enabled);renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  sun.castShadow=true;const shadowSize=tier==='high'?1024:512;if(sun.shadow.mapSize.x!==shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(shadowSize,shadowSize);}sun.shadow.camera.left=-span;sun.shadow.camera.right=span;sun.shadow.camera.top=span;sun.shadow.camera.bottom=-span;sun.shadow.camera.near=.5;sun.shadow.camera.far=span*4+20;sun.shadow.normalBias=.018;sun.shadow.bias=-.0002;sun.shadow.camera.updateProjectionMatrix();
  for(const root of desired)if(!previousRoots.has(root))root.traverse(object=>{if(object instanceof THREE.Mesh&&object!==water&&object.material instanceof THREE.MeshStandardMaterial){object.castShadow=true;object.receiveShadow=true;}});
  camera.position.set(center.x,span*1.3,center.z+span);camera.lookAt(center);camera.updateMatrixWorld(true);
  const projected=new THREE.Box3();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  let {zoom,azimuth,panX,panY}=cameraPose.current;const pointers=new Map<number,{x:number;y:number}>();let pinchDistance=0;const target=center.clone();
  // Project readable, accessible port labels using the active camera, without allocating GPU textures.
  const labelAnchors=board.harbors.flatMap(h=>{const edge=board.edges.find(e=>e.id===h.edgeId);if(!edge)return [];const a=vertices.get(edge.a),b=vertices.get(edge.b),tile=positions.find(t=>t.tile.id===edge.tiles[0]);if(!a||!b||!tile)return [];const x=(a.x+b.x)/2,z=(a.y+b.y)/2,dx=x-tile.p.x,dz=z-tile.p.y,len=Math.hypot(dx,dz);if(!len)return [];return [{id:h.edgeId,point:new THREE.Vector3(x+dx/len*.78,.57,z+dz/len*.78)}];});
  const labelNodes=new Map(Array.from(harborLabels.current?.querySelectorAll<HTMLElement>('[data-harbor-edge]')??[]).map(node=>[node.dataset.harborEdge,node]));
  const projectedLabel=new THREE.Vector3();
  const cap=resolutionCap(window.devicePixelRatio,tier);
  const oldResolution=automaticResolution.current;
  const preserveResolution=quality==='auto'&&ambientSampling.current?.quality==='auto'&&oldResolution?.cap===cap;
  let resolution=preserveResolution&&oldResolution?oldResolution:resolutionStart(cap,quality==='auto'?oldResolution:undefined);
  if(quality==='auto')automaticResolution.current=resolution;
  const applyResolution=()=>{if(renderer.getPixelRatio()!==resolution.ratio)renderer.setPixelRatio(resolution.ratio);
   renderer.domElement.dataset.resolution=JSON.stringify({mode:quality,ratio:resolution.ratio,cap:resolution.cap,min:Math.min(.75,resolution.cap)});
  };
  applyResolution();el.appendChild(renderer.domElement);
  // Opt-in diagnostics: bounded samples, no frame timing overhead in normal play.
  const benchmarking=new URLSearchParams(window.location.search).get('benchmark3d')==='1';
  const benchmarkSamples:{ms:number;ambient:boolean;drawCalls:number;triangles:number}[]=[];
  const render=(ambient=false)=>{const counts=renderCounts.current;if(renderer.shadowMap.enabled&&renderer.shadowMap.needsUpdate)counts.shadowUpdates++;
   const begin=benchmarking?performance.now():0;
   renderer.render(scene,camera);counts.frames++;if(ambient)counts.ambientFrames++;
   const canvas=renderer.domElement;canvas.dataset.renderCounts=JSON.stringify(counts);
   if(benchmarking){
    benchmarkSamples.push({ms:performance.now()-begin,ambient,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
    if(benchmarkSamples.length>240)benchmarkSamples.shift();
    canvas.dataset.benchmark3d=JSON.stringify({samples:benchmarkSamples,frames:counts.frames,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),bufferWidth:canvas.width,bufferHeight:canvas.height,tiles:board.tiles.length});
   }
  };
  renderer.shadowMap.needsUpdate=renderer.shadowMap.enabled;
  let cameraFrame=0;
  const updateCamera=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return false;camera.position.set(target.x+Math.sin(azimuth)*span,target.y+span*1.3,target.z+Math.cos(azimuth)*span);camera.lookAt(target);camera.updateMatrixWorld(true);const projected=new THREE.Box3();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));const fit=projected.getSize(new THREE.Vector3()),mid=projected.getCenter(new THREE.Vector3());const aspect=w/h,half=Math.max(fit.y/2,fit.x/(2*aspect))*1.08/zoom;camera.left=mid.x+panX-half*aspect;camera.right=mid.x+panX+half*aspect;camera.top=mid.y+panY+half;camera.bottom=mid.y+panY-half;camera.updateProjectionMatrix();return true;};
  const draw=()=>{if(cameraFrame){cancelAnimationFrame(cameraFrame);cameraFrame=0;}if(document.hidden||!updateCamera())return;const w=el.clientWidth,h=el.clientHeight;if(renderer.domElement.width!==Math.floor(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);render();const canvas=renderer.domElement;canvas.dataset.cameraPose=JSON.stringify({zoom,azimuth,panX,panY});canvas.dataset.staticCache=JSON.stringify({tokenTextures:tokens.materials.size,numberTokens:tokenObjects.current?.numberTokens??0,tokenBatches:tokenObjects.current?.objects.length??0,tokenDrawCallsAvoided:2*(tokenObjects.current?.numberTokens??0)-(tokenObjects.current?.objects.length??0),tokenGeometry:tokens.geometry.uuid,firstToken:tokenObjects.current?.objects[0]?.uuid,pickGeometries:2,pickObjects:pickObjects.length,firstPick:pickObjects[0]?.uuid});for(const {id,point} of labelAnchors){const node=labelNodes.get(id);if(!node)continue;const p=projectedLabel.copy(point).project(camera);node.style.visibility=Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&Math.abs(p.z)<=1?'visible':'hidden';node.style.left=`${(p.x+1)*w/2}px`;node.style.top=`${(1-p.y)*h/2}px`;}canvas.dataset.legalVertices=JSON.stringify([...legalVertexSet].flatMap(id=>{const p=vertices.get(id);if(!p)return [];const q=new THREE.Vector3(p.x,.32,p.y).project(camera);return [{id,x:(q.x+1)*w/2,y:(1-q.y)*h/2}]}));canvas.dataset.legalEdges=JSON.stringify([...legalEdgeSet].flatMap(id=>{const edge=board.edges.find(e=>e.id===id);if(!edge)return [];const a=vertices.get(edge.a),b=vertices.get(edge.b);if(!a||!b)return [];const q=new THREE.Vector3((a.x+b.x)/2,.29,(a.y+b.y)/2).project(camera);return [{id,x:(q.x+1)*w/2,y:(1-q.y)*h/2}]}));};
  // High-frequency pointer/wheel events update pose immediately, but submit at most one frame per display refresh.
  const scheduleCameraDraw=()=>{if(!cameraFrame&&!document.hidden)cameraFrame=requestAnimationFrame(()=>{cameraFrame=0;draw();});};
  const productionGeometry=new THREE.TorusGeometry(.78,.045,8,48);
  const productionMaterial=new THREE.MeshBasicMaterial({color:'#ffe39b',transparent:true,opacity:.85,depthTest:false});
  const productionRings=positions.filter(({tile})=>producingTiles?.includes(tile.id)).map(({p})=>{const ring=new THREE.Mesh(productionGeometry,productionMaterial);ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.28,p.y);ring.renderOrder=8;include(ring);return ring;});
  const markerGeometry=new THREE.TorusGeometry(.23,.035,8,32);
  const markerMaterial=new THREE.MeshBasicMaterial({color:'#fff2a8',depthTest:false});
  const marker=new THREE.Mesh(markerGeometry,markerMaterial);marker.rotation.x=-Math.PI/2;marker.visible=false;marker.renderOrder=10;include(marker);
  const canvas=renderer.domElement;canvas.style.touchAction='none';canvas.style.width='100%';canvas.style.height='100%';canvas.style.display='block';
  // Only obsolete roots (removed pieces and transient overlays) are detached.
  let removedRoots=0;for(const root of [...scene.children])if(!desiredSet.has(root)){scene.remove(root);removedRoots++;}
  canvas.dataset.terrainBatchMetrics=JSON.stringify({sources:staticTerrain.current?.staticSources??0,batches:staticTerrain.current?.staticBatches.length??0,avoidedDrawCalls:(staticTerrain.current?.staticSources??0)-(staticTerrain.current?.staticBatches.length??0),firstBatch:staticTerrain.current?.staticBatches[0]?.uuid});
  canvas.dataset.sceneCache=JSON.stringify({scene:scene.uuid,camera:camera.uuid,sun:sun.uuid,hemisphere:hemisphere.uuid,roots:desired.length,retained:desired.filter(root=>previousRoots.has(root)).length,added:desired.filter(root=>!previousRoots.has(root)).length,removed:removedRoots});
  const raycaster=new THREE.Raycaster();const ndc=new THREE.Vector2();let start:{x:number;y:number}|null=null;let moved=false;
  const selectAt=(x:number,y:number)=>{const rect=canvas.getBoundingClientRect();ndc.set((x-rect.left)/rect.width*2-1,-((y-rect.top)/rect.height*2-1));raycaster.setFromCamera(ndc,camera);const hit=raycaster.intersectObjects([...pickObjects,...selectable],false)[0];const selection=hit?.object.userData.selection as BoardSelection|undefined;if(selection){const point=hit.object.getWorldPosition(new THREE.Vector3());marker.position.set(point.x,Math.max(point.y+.18,.35),point.z);marker.scale.setScalar(selection.kind==='tile'?2.8:1);marker.visible=true;setSelected(selection);selectionCallback.current?.(selection);draw();}};
  const distance=()=>{const a=[...pointers.values()];return a.length===2?Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y):0;};
  let robberDrag:number|null=null;
  const robberHome=robberMeshes.map(m=>m.position.clone());
  const dragRay=(x:number,y:number)=>{const rect=canvas.getBoundingClientRect();ndc.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);raycaster.setFromCamera(ndc,camera);return raycaster.ray;};
  const robberDestination=(x:number,y:number)=>{
   const rect=canvas.getBoundingClientRect();if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return undefined;
   if(!document.elementFromPoint(x,y)?.closest('.tabletop-world'))return undefined;
   const p=dragRay(x,y).intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.24),new THREE.Vector3());if(!p)return undefined;
   return positions.filter(t=>t.tile.id!==robberTile&&Math.hypot(t.p.x-p.x,t.p.y-p.z)<.86).sort((a,b)=>Math.hypot(a.p.x-p.x,a.p.y-p.z)-Math.hypot(b.p.x-p.x,b.p.y-p.z))[0];
  };
  const restoreRobber=()=>{robberMeshes.forEach((m,i)=>m.position.copy(robberHome[i]));marker.visible=false;canvas.style.cursor='';scheduleCameraDraw();};
  const down=(e:PointerEvent)=>{if(robberDrag!==null)return;
   if(canMoveRobber&&robber&&e.button===0){dragRay(e.clientX,e.clientY);if(raycaster.intersectObjects(robberMeshes,false).length){canvas.setPointerCapture(e.pointerId);robberDrag=e.pointerId;canvas.style.cursor='grabbing';return;}}
   canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){start={x:e.clientX,y:e.clientY};moved=false;}else moved=true;pinchDistance=distance();};
  const move=(e:PointerEvent)=>{if(robberDrag!==null){if(e.pointerId!==robberDrag)return;const hit=robberDestination(e.clientX,e.clientY);if(hit){robberMeshes.forEach((m,i)=>m.position.set(hit.p.x,robberHome[i].y+.18,hit.p.y+.40));marker.position.set(hit.p.x,.32,hit.p.y);marker.scale.setScalar(3);marker.visible=true;}else{robberMeshes.forEach((m,i)=>m.position.copy(robberHome[i]));marker.visible=false;}scheduleCameraDraw();return;}const prev=pointers.get(e.pointerId);if(!prev)return;if(cameraFrame)updateCamera();if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)moved=true;const oldPair=[...pointers.values()];pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const pair=[...pointers.values()],d=distance(),rect=canvas.getBoundingClientRect();const oldAngle=Math.atan2(oldPair[1].y-oldPair[0].y,oldPair[1].x-oldPair[0].x),angle=Math.atan2(pair[1].y-pair[0].y,pair[1].x-pair[0].x);if(pinchDistance>12&&d>12){const oldZoom=zoom;zoom=Math.max(.65,Math.min(3,zoom*d/pinchDistance));const ratio=oldZoom/zoom;const w=camera.right-camera.left,h=camera.top-camera.bottom;const ox=(oldPair[0].x+oldPair[1].x)/2-rect.left,oy=(oldPair[0].y+oldPair[1].y)/2-rect.top;const nx=(pair[0].x+pair[1].x)/2-rect.left,ny=(pair[0].y+pair[1].y)/2-rect.top;panX=THREE.MathUtils.clamp(panX+(ox/rect.width-.5)*w-(nx/rect.width-.5)*w*ratio,-span/2,span/2);panY=THREE.MathUtils.clamp(panY+(.5-oy/rect.height)*h-(.5-ny/rect.height)*h*ratio,-span/2,span/2);azimuth+=Math.atan2(Math.sin(angle-oldAngle),Math.cos(angle-oldAngle));}pinchDistance=d;}else if(pointers.size===1){if(e.pointerType==='touch'||e.shiftKey){panX=THREE.MathUtils.clamp(panX-(e.clientX-prev.x)*(camera.right-camera.left)/Math.max(1,el.clientWidth),-span/2,span/2);panY=THREE.MathUtils.clamp(panY+(e.clientY-prev.y)*(camera.top-camera.bottom)/Math.max(1,el.clientHeight),-span/2,span/2);}else azimuth+=(e.clientX-prev.x)*.008;}cameraPose.current={zoom,azimuth,panX,panY};scheduleCameraDraw();};
  const up=(e:PointerEvent)=>{if(robberDrag!==null){if(e.pointerId!==robberDrag)return;const hit=e.type==='pointerup'?robberDestination(e.clientX,e.clientY):undefined;robberDrag=null;restoreRobber();if(hit)robberDropCallback.current?.(hit.tile.id);return;}if(e.type==='pointerup'&&pointers.size===1&&!moved){if(cameraFrame)draw();selectAt(e.clientX,e.clientY);}pointers.delete(e.pointerId);pinchDistance=distance();if(!pointers.size)start=null;};
  const wheel=(e:WheelEvent)=>{e.preventDefault();zoom=Math.max(.65,Math.min(3,zoom*Math.exp(-e.deltaY*.001)));cameraPose.current={zoom,azimuth,panX,panY};scheduleCameraDraw();};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',up);canvas.addEventListener('wheel',wheel,{passive:false});
  resetCamera.current=()=>{zoom=1;azimuth=0;panX=0;panY=0;cameraPose.current={zoom,azimuth,panX,panY};draw();};
  // Transient preview shares the board camera, never participates in picking or shadows.
  let preview:THREE.Group|null=null,previewKey='';
  const clearPreview=()=>{if(!preview)return;scene.remove(preview);preview.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});preview=null;previewKey='';};
  const previewPiece:BoardCameraControls['previewPiece']=piece=>{
   const key=piece?piece.kind+':'+piece.id+':'+piece.color:'';
   if(key===previewKey)return;
   clearPreview();
   if(piece){
    const group=new THREE.Group();
    const mesh=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>{
     const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,transparent:true,opacity:.68,depthWrite:false,roughness:1,flatShading:true}));m.position.set(x,y,z);m.renderOrder=11;group.add(m);return m;
    };
    if(piece.kind==='road'){
     const edge=board.edges.find(e=>e.id===piece.id),a=edge&&vertices.get(edge.a),b=edge&&vertices.get(edge.b);
     if(!a||!b)return;
     const len=Math.hypot(b.x-a.x,b.y-a.y);group.position.set((a.x+b.x)/2,0,(a.y+b.y)/2);group.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);
     mesh(new THREE.BoxGeometry(len*.94,.095,.22),'#97846a',0,.1675,0);
     mesh(new THREE.BoxGeometry(len*.88,.045,.15),piece.color,0,.2375,0);
    }else{
     const p=vertices.get(piece.id);if(!p)return;group.position.set(p.x,0,p.y);
     mesh(new THREE.BoxGeometry(.49,.07,.43),piece.color,0,.17,0);
     const house=(x:number,z:number,w:number,h:number)=>{
      mesh(new THREE.BoxGeometry(w,h,w*.85),'#e1c9a3',x,.21+h/2,z);
      const r=w*.65;mesh(new THREE.CylinderGeometry(r,r,w*.98,3,1),piece.color,x,.21+h+r*.5,z).rotation.x=-Math.PI/2;
      mesh(new THREE.BoxGeometry(w*.25,h*.65,.025),'#493a30',x,.21+h*.325,z+w*.43);
      for(const side of [-1,1])mesh(new THREE.BoxGeometry(.018,.065,.065),'#675c48',x+side*w*.505,.21+h*.65,z);
     };
     if(piece.kind==='city'){
      const w=.22,h=.41,x=-.12,z=-.015;
      mesh(new THREE.CylinderGeometry(w*.48,w*.58,h,6),'#b7ad96',x,.21+h/2,z);
      mesh(new THREE.ConeGeometry(w*.69,.19,6),piece.color,x,.21+h+.095,z);
      mesh(new THREE.BoxGeometry(.055,.11,.018),'#514b40',x,.21+h*.68,z+w*.51);
      mesh(new THREE.CylinderGeometry(.13,.13,.035,6),'#d6c7a6',x,.21+h*.80,z);
      house(.13,.025,.25,.23);
     }else house(0,0,.30,.23);
    }
    preview=group;previewKey=key;scene.add(group);
   }
   scheduleCameraDraw();
  };
  const controls:BoardCameraControls={reset:resetCamera.current,previewPiece,throwVector:(dx,dy,releaseX,releaseY)=>{const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);const forward=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);const v=right.multiplyScalar(dx).addScaledVector(forward,-dy);v.y=0;if(v.length()>7)v.setLength(7);
   const rect=canvas.getBoundingClientRect();let origin:DiceImpulse['origin'];
   if(releaseX!==undefined&&releaseY!==undefined&&rect.width>0&&rect.height>0&&releaseX>=rect.left&&releaseX<=rect.right&&releaseY>=rect.top&&releaseY<=rect.bottom){
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((releaseX-rect.left)/rect.width*2-1,1-(releaseY-rect.top)/rect.height*2),camera);
    const hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-2.4),new THREE.Vector3());
    if(hit)origin={x:THREE.MathUtils.clamp(hit.x,center.x-size.x/2+.5,center.x+size.x/2-.5),z:THREE.MathUtils.clamp(hit.z,center.z-size.z/2+.5,center.z+size.z/2-.5)};
   }
   return {x:v.x,z:v.z,origin};},project:(kind,id)=>{
   let point:THREE.Vector3|undefined;
   if(kind==='tile'){const p=positions.find(t=>t.tile.id===id)?.p;if(p)point=new THREE.Vector3(p.x,.3,p.y+.48);}
   else if(kind==='vertex'){const p=vertices.get(id);if(p)point=new THREE.Vector3(p.x,.32,p.y);}
   else{const edge=board.edges.find(e=>e.id===id),a=edge&&vertices.get(edge.a),b=edge&&vertices.get(edge.b);if(a&&b)point=new THREE.Vector3((a.x+b.x)/2,.29,(a.y+b.y)/2);}
   if(!point||!updateCamera())return undefined;
   const q=point.project(camera),rect=canvas.getBoundingClientRect();
   if(!rect.width||!rect.height||Math.abs(q.z)>1)return undefined;
   return {x:rect.left+(q.x+1)*rect.width/2,y:rect.top+(1-q.y)*rect.height/2};
  },zoomBy:delta=>{zoom=THREE.MathUtils.clamp(zoom+delta,.65,3);cameraPose.current={zoom,azimuth,panX,panY};draw();}};
  if(cameraControls)cameraControls.current=controls;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let ambientFrame=0,nextDue=0,frame=0,lastAnimationTime=-1;const ambientStart=performance.now();
  const priorSampling=ambientSampling.current;
  const sampling=priorSampling?.quality===quality&&priorSampling.tier===tier?priorSampling:{quality,tier,running:false,samples:0,totalMs:0,sampleStart:performance.now(),slowWindows:0,stride:1,count:0};
  ambientSampling.current=sampling;
  let lastShadow=performance.now();
  const resetSamples=()=>{sampling.samples=0;sampling.totalMs=0;sampling.sampleStart=performance.now();};
  const resetAdaptation=()=>{resolution={...resolution,slow:0,fast:0};if(quality==='auto')automaticResolution.current=resolution;sampling.slowWindows=0;};
  const ambient=()=>{
   if(document.hidden||ambientPausedRef.current||motion.matches||!el.clientWidth||!el.clientHeight){resetSamples();return;}
   if(cameraFrame||frame)return;if(++sampling.count%sampling.stride!==0)return;
   const begin=performance.now(),t=(begin-ambientStart)/1000;
   for(const {mesh:batch,items} of batches.values()){items.forEach(({mesh,phase},i)=>{mesh.rotation.z=.055*Math.sin(t*1.6+phase);mesh.rotation.x=.025*Math.cos(t*1.2+phase);mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);});batch.instanceMatrix.needsUpdate=true;}
   boats.forEach((boat,i)=>{boat.position.y=.035*Math.sin(t*1.7+i);boat.rotation.z=.045*Math.sin(t*1.3+i);boat.updateMatrix();});
   for(const {mesh,parts} of boatBatches){
    parts.forEach(({boat,local},i)=>mesh.setMatrixAt(i,boatMatrix.multiplyMatrices(boat.matrix,local)));
    mesh.instanceMatrix.needsUpdate=true;
   }
   animateWater(t);
   // Ambient motion needs only occasional shadow refreshes; camera motion needs none.
   const shadowInterval=(tier==='high'?250:500)*sampling.stride;
   if(renderer.shadowMap.enabled&&begin-lastShadow>=shadowInterval){renderer.shadowMap.needsUpdate=true;lastShadow=begin;}
   render(true);recordActiveFrame(begin);
  };
  const recordActiveFrame=(begin:number)=>{
   sampling.totalMs+=performance.now()-begin;sampling.samples++;
   if(sampling.samples>=30){const now=performance.now(),mean=sampling.totalMs/sampling.samples,ambientFps=sampling.samples*1000/Math.max(1,now-sampling.sampleStart);
    if(perfHud.current)perfHud.current.textContent=`${ambientFps.toFixed(1)} / ${TARGET_FPS} FPS · DPR ${renderer.getPixelRatio().toFixed(2)} · CPU ${mean.toFixed(1)} ms · ${renderer.info.render.calls} draws · shadows ${renderer.shadowMap.enabled?'on':'off'}`;
    canvas.dataset.renderMetrics=JSON.stringify({ambientFps,cpuRenderMs:mean,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,ambientStride:sampling.stride,targetFps:TARGET_FPS,effectiveTargetFps:TARGET_FPS/sampling.stride,shadows:renderer.shadowMap.enabled,pixelRatio:renderer.getPixelRatio()});
    if(quality==='auto'){
     const target=TARGET_FPS/sampling.stride;
     const atFloor=resolution.ratio<=Math.min(.75,resolution.cap);
     const shadows=adaptShadows(autoShadows.current,atFloor,resolution.ratio>=resolution.cap,sampling.stride,mean,ambientFps);
     const shadowsChanged=shadows.enabled!==autoShadows.current.enabled;
     autoShadows.current=shadows;
     if(shadowsChanged){renderer.shadowMap.enabled=shadows.enabled;renderer.shadowMap.needsUpdate=shadows.enabled;canvas.dataset.shadows=String(shadows.enabled);resetAdaptation();draw();resetSamples();return;}
     // Reduce pixel cost before sacrificing cadence; recover cadence before raising resolution.
     if(canRecoverCadence(sampling.stride,mean,ambientFps)){
      sampling.stride--;sampling.slowWindows=0;resetAdaptation();resetSamples();return;
     }
     const next=adaptResolution(resolution,mean,ambientFps,target);
     const changed=next.ratio!==resolution.ratio;resolution=next;automaticResolution.current=next;
     if(changed){applyResolution();draw();}
     // A slow display/browser cadence alone must not cause us to halve an already limited refresh rate.
     sampling.slowWindows=!autoShadows.current.enabled&&atFloor&&mean>1000/target*.9&&ambientFps<target*.85?sampling.slowWindows+1:0;
     if(sampling.slowWindows>=2){sampling.stride=Math.min(4,sampling.stride+1);sampling.slowWindows=0;}
    }
    
    resetSamples();
   }
  };
  const ambientTick=(now:number)=>{ambientFrame=0;if(!sampling.running||document.hidden)return;const due=nextFrameDeadline(now,nextDue||now);if(due!==null){nextDue=due;if(now!==lastAnimationTime)ambient();}if(sampling.running&&!document.hidden)ambientFrame=requestAnimationFrame(ambientTick);};
  const syncAmbient=()=>{
   const reason=document.hidden?'hidden':ambientPausedRef.current?'paused':motion.matches?'reduced-motion':tier==='low'?'low-quality':'running';
   canvas.dataset.ambientState=reason;canvas.dataset.targetFps=String(tier==='low'?0:TARGET_FPS);canvas.dataset.shadows=String(renderer.shadowMap.enabled);
   if(perfHud.current)perfHud.current.textContent=reason==='running'?'Measuring FPS…':`On demand · ${reason}`;
   if(reason==='running'){if(!sampling.running){resetSamples();resetAdaptation();sampling.running=true;}if(!ambientFrame){nextDue=0;ambientFrame=requestAnimationFrame(ambientTick);}}
   else {if(ambientFrame){cancelAnimationFrame(ambientFrame);ambientFrame=0;}if(sampling.running){sampling.running=false;resetSamples();resetAdaptation();}}
  };
  ambientControl.current=syncAmbient;
  const visibilityChanged=()=>{syncAmbient();if(!document.hidden){renderer.shadowMap.needsUpdate=renderer.shadowMap.enabled;draw();}};
  document.addEventListener('visibilitychange',visibilityChanged);
  motion.addEventListener('change',syncAmbient);
  const observer=new ResizeObserver(draw);observer.observe(el);const started=performance.now();
  const robberTargets=robberMeshes.map(mesh=>mesh.position.clone());
  const movingRobber=!!origin&&!!robber&&robberMeshes.length>0;
  const tick=(now:number)=>{frame=0;lastAnimationTime=now;const begin=performance.now(),elapsed=document.hidden?Infinity:now-started,t=Math.min(1,elapsed/380);for(const group of animated){const pose=placementPose(t);group.position.y=.12+pose.lift;group.scale.set(1,pose.scaleY,1);}
   const u=Math.min(1,elapsed/520),smooth=u*u*(3-2*u);
   if(movingRobber&&origin&&robber){robberMeshes.forEach((mesh,i)=>{const dest=robberTargets[i];mesh.position.set(dest.x+(origin.p.x-robber.p.x)*(1-smooth),dest.y+Math.sin(Math.PI*u)*.48,dest.z+(origin.p.y-robber.p.y)*(1-smooth));});}
   const pulse=Math.min(1,elapsed/650);for(const ring of productionRings)ring.scale.setScalar(.85+.15*Math.sin(Math.PI*pulse));productionMaterial.opacity=.85*(1-pulse);
   const pending=(animated.length>0&&t<1)||(movingRobber&&u<1)||(productionRings.length>0&&pulse<1);
   // Keep the previous shadow map during the short construction animation; refresh at its end.
   if(!pending){renderCounts.current.completedAnimations++;if((animated.length>0||movingRobber)&&renderer.shadowMap.enabled)renderer.shadowMap.needsUpdate=true;}
   if(document.hidden)return;
   renderCounts.current.animationFrames++;if(renderer.shadowMap.enabled&&renderer.shadowMap.needsUpdate)renderCounts.current.animationShadowUpdates++;
   // Camera projection, DOM labels, and legal-site data do not change during piece scaling.
   if(cameraFrame){draw();}else{render(sampling.running);if(sampling.running)recordActiveFrame(begin);}
   if(pending)frame=requestAnimationFrame(tick);
  };
  // One initial layout draw, then lightweight animation-only renders.
  for(const group of animated){const pose=placementPose(0);group.position.y=.12+pose.lift;group.scale.y=pose.scaleY;}
  draw();if(animated.length||movingRobber||productionRings.length)frame=requestAnimationFrame(tick);
  let diceFrame=0,diceCompleteTimer=0,diceCancelled=false,diceSimulation:ReturnType<typeof createPhysicalDice>|undefined;
  if(diceRoll&&diceRoll.duration>0&&!motion.matches){
   const diceStarted=performance.now();
   void loadDicePhysics().then(R=>{
    if(diceCancelled)return;
    const obstacles:DiceObstacle[]=positions.map(({p})=>({x:p.x,y:.06,z:p.y,hx:.78,hy:.06,hz:.78}));
    for(const building of display.buildings){const p=vertices.get(building.vertexId);if(p){const h=building.kind==='city'?.8:.55;obstacles.push({x:p.x,y:.12+h/2,z:p.y,hx:.24,hy:h/2,hz:.23});}}
    diceSimulation=createPhysicalDice(R,scene,center,{x:size.x/2+1,z:size.z/2+1},diceRoll.values,obstacles,Math.max(200,diceRoll.duration-(performance.now()-diceStarted)),diceRoll.impulse,diceRoll.onImpact);
    let previous=performance.now();
    const rollTick=(now:number)=>{diceFrame=0;if(diceCancelled||!diceSimulation)return;const running=diceSimulation.step(document.hidden?0:Math.min((now-previous)/1000,.1));previous=now;lastAnimationTime=now;if(!document.hidden)render();if(running)diceFrame=requestAnimationFrame(rollTick);else diceCompleteTimer=window.setTimeout(()=>{if(!diceCancelled)diceRoll.onComplete?.();},450);};
    diceFrame=requestAnimationFrame(rollTick);
   }).catch(()=>{if(!diceCancelled)diceRoll.onComplete?.();});
  }

  syncAmbient();
  const lost=(e:Event)=>{e.preventDefault();fallback.current();};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{diceCancelled=true;window.clearTimeout(diceCompleteTimer);cancelAnimationFrame(diceFrame);diceSimulation?.dispose();clearPreview();document.removeEventListener('visibilitychange',visibilityChanged);motion.removeEventListener('change',syncAmbient);if(ambientControl.current===syncAmbient)ambientControl.current=null;if(cameraControls?.current===controls)cameraControls.current=null;observer.disconnect();cancelAnimationFrame(ambientFrame);cancelAnimationFrame(frame);cancelAnimationFrame(cameraFrame);productionGeometry.dispose();productionMaterial.dispose();markerGeometry.dispose();markerMaterial.dispose();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('lostpointercapture',up);canvas.removeEventListener('wheel',wheel);renderer.domElement.removeEventListener('webglcontextlost',lost);};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[board,piecesKey,legalVerticesKey,legalEdgesKey,robberTile,productionKey,quality,cameraControls,diceKey,canMoveRobber]);
 return <div style={{width:'100%',height:'100%',minHeight:240,position:'relative'}}><div ref={host} aria-label="Experimental 3D board preview" style={{width:'100%',height:'100%',minHeight:240}}/><div ref={harborLabels} role="group" aria-label="Harbor exchange rates" style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>{board.harbors.map(h=><span key={h.edgeId} data-harbor-edge={h.edgeId} aria-label={`${h.resource??'Generic'} harbor ${h.rate}:1`} style={{position:'absolute',visibility:'hidden',transform:'translate(-50%,-100%)',whiteSpace:'nowrap',background:'#26362de6',color:'#f4e4bd',border:'1px solid #a88b59',borderRadius:2,padding:'3px 5px',fontSize:10,fontWeight:700,lineHeight:1.15,letterSpacing:'.035em',textTransform:'uppercase',boxShadow:'0 2px 3px #132c3480'}}>{h.resource??'Any'} {h.rate}:1</span>)}</div>{(!cameraControls||diagnosticQuality)&&<div style={{position:'absolute',right:12,top:12,zIndex:2}}><GraphicsQualitySelect value={quality} onChange={changeQuality}/></div>}{!cameraControls&&<button type="button" aria-label="Reset 3D camera" onClick={()=>resetCamera.current()} style={{position:'absolute',right:12,bottom:12,zIndex:2}}>⌂</button>}{showPerf&&<output ref={perfHud} aria-label="3D performance" style={{position:'absolute',left:8,top:8,zIndex:3,background:'#142c35',color:'#fff',padding:'5px 8px',borderRadius:4,fontSize:11,pointerEvents:'none',fontVariantNumeric:'tabular-nums'}}>Measuring FPS…</output>}{selected&&<output aria-live="polite" style={{position:'absolute',left:12,bottom:12,background:'#19333c',color:'#fff',padding:'8px 12px',borderRadius:8,pointerEvents:'none'}}>Selected {selected.kind}: {selected.id}</output>}</div>;
}
