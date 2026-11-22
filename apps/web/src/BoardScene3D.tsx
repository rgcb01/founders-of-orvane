import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {tilePosition,type Board} from '@orvane/engine';
import {TERRAIN_COLORS} from './TerrainArt';

export function BoardScene3D({board,onUnavailable}:{board:Board;onUnavailable:()=>void}){
 const host=useRef<HTMLDivElement>(null);
 const fallback=useRef(onUnavailable);fallback.current=onUnavailable;
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{fallback.current();return;}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#183e49');
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,500);
  const positions=board.tiles.map(t=>({tile:t,p:tilePosition(t,1)}));
  const bounds=new THREE.Box3();
  const geometry=new THREE.CylinderGeometry(.98,.98,.24,6);
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  const details:THREE.BufferGeometry[]=[];const detailMaterials=new Map<string,THREE.MeshStandardMaterial>();
  const add=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>{details.push(g);let m=detailMaterials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,flatShading:true,roughness:1});detailMaterials.set(color,m);}const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);scene.add(mesh);return mesh;};
  for(const {tile,p} of positions){
   const color=TERRAIN_COLORS[tile.terrain];
   let mat=materials.get(color);if(!mat){mat=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});materials.set(color,mat);}
   const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(p.x,0,p.y);scene.add(mesh);bounds.expandByObject(mesh);
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
  const fit=projected.getSize(new THREE.Vector3()),mid=projected.getCenter(new THREE.Vector3());
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));el.appendChild(renderer.domElement);
  const draw=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;const aspect=w/h,half=Math.max(fit.y/2,fit.x/(2*aspect))*1.08;camera.left=mid.x-half*aspect;camera.right=mid.x+half*aspect;camera.top=mid.y+half;camera.bottom=mid.y-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false);renderer.render(scene,camera);};
  const observer=new ResizeObserver(draw);observer.observe(el);draw();
  const lost=(e:Event)=>{e.preventDefault();fallback.current();};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);geometry.dispose();details.forEach(g=>g.dispose());detailMaterials.forEach(m=>m.dispose());waterGeometry.dispose();waterMaterial.dispose();materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
 },[board]);
 return <div ref={host} aria-label="Experimental 3D board preview" style={{width:'100%',height:'100%',minHeight:240}}/>;
}
