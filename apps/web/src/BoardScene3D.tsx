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
  for(const {tile,p} of positions){
   const color=TERRAIN_COLORS[tile.terrain];
   let mat=materials.get(color);if(!mat){mat=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});materials.set(color,mat);}
   const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(p.x,0,p.y);scene.add(mesh);bounds.expandByObject(mesh);
  }
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const span=Math.max(size.x,size.z)+3;
  const waterGeometry=new THREE.PlaneGeometry(span*8,span*8);
  const waterMaterial=new THREE.MeshStandardMaterial({color:'#285963',roughness:.85});
  const water=new THREE.Mesh(waterGeometry,waterMaterial);water.rotation.x=-Math.PI/2;water.position.set(center.x,-.15,center.z);scene.add(water);
  scene.add(new THREE.HemisphereLight('#fff1d8','#526b72',2));
  const sun=new THREE.DirectionalLight('#fff0d0',2);sun.position.set(-5,12,6);scene.add(sun);
  camera.position.set(center.x,span*1.3,center.z+span);camera.lookAt(center);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));el.appendChild(renderer.domElement);
  const draw=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;const aspect=w/h,half=span*.65*Math.max(1,1/aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false);renderer.render(scene,camera);};
  const observer=new ResizeObserver(draw);observer.observe(el);draw();
  const lost=(e:Event)=>{e.preventDefault();fallback.current();};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);geometry.dispose();waterGeometry.dispose();waterMaterial.dispose();materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
 },[board]);
 return <div ref={host} aria-label="Experimental 3D board preview" style={{width:'100%',height:'100%',minHeight:240}}/>;
}
