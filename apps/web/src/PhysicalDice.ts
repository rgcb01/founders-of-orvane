import * as THREE from 'three';
import type Rapier from '@dimforge/rapier3d-compat';
type Physics=typeof Rapier;
let loading:Promise<Physics>|undefined;
export function loadDicePhysics(){return loading??=import('@dimforge/rapier3d-compat').then(async m=>{await m.default.init();return m.default;}).catch(e=>{loading=undefined;throw e;});}
export type DiceObstacle={x:number;y:number;z:number;hx:number;hy:number;hz:number};
const normals=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];
const values=[3,4,1,6,2,5];
export function diceFaceOrder(rotation:THREE.Quaternion,value:number):number[]{
 let top=0,best=-Infinity;
 normals.forEach((n,i)=>{const score=n.clone().applyQuaternion(rotation).y;if(score>best){best=score;top=i;}});
 const inverse=new THREE.Quaternion().setFromUnitVectors(normals[values.indexOf(value)],normals[top]).invert();
 return normals.map(n=>{const old=n.clone().applyQuaternion(inverse);let index=0;normals.forEach((v,i)=>{if(v.dot(old)>normals[index].dot(old))index=i;});return index;});
}

const dots:Record<number,number[][]>={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
function faceMaterial(n:number){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle='#efe2c6';c.fillRect(0,0,128,128);c.strokeStyle='#b9a480';c.lineWidth=5;c.strokeRect(3,3,122,122);for(const [x,y] of dots[n]){c.beginPath();c.arc(64+x*32,64+y*32,10,0,Math.PI*2);c.fillStyle='#39362d';c.fill();}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshStandardMaterial({map:texture,roughness:.65});}
export function createPhysicalDice(R:Physics,scene:THREE.Scene,center:{x:number;z:number},extent:{x:number;z:number},result:readonly [number,number],obstacles:DiceObstacle[],duration:number){
 const world=new R.World({x:0,y:-22,z:0});world.timestep=1/120;
 const half=.34;
 const staticBox=(x:number,y:number,z:number,hx:number,hy:number,hz:number)=>{world.createCollider(R.ColliderDesc.cuboid(hx,hy,hz).setTranslation(x,y,z).setFriction(.72).setRestitution(.28));};
 staticBox(center.x,-.25,center.z,extent.x,.25,extent.z);
 for(const o of obstacles)staticBox(o.x,o.y,o.z,o.hx,o.hy,o.hz);
 const bodies=result.map((value,i)=>{
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(center.x+(i? .45:-.45),2.4+i*.35,center.z+extent.z*.48).setLinvel((i?-.65:.65),-1,-3.5).setAngvel({x:10+i*3,y:8-i*4,z:12-i*2}).setLinearDamping(.65).setAngularDamping(.8).setCcdEnabled(true));
  world.createCollider(R.ColliderDesc.cuboid(half,half,half).setDensity(1.2).setFriction(.74).setRestitution(.42),body);
  const mats=values.map(faceMaterial);const mesh=new THREE.Mesh(new THREE.BoxGeometry(half*2,half*2,half*2),mats);scene.add(mesh);
  return {body,mesh,value,mats};
 });
 let elapsed=0,accumulator=0,finished=false;
 const limit=Math.max(.25,duration/1000*.78);
 const alignFaces=(d:typeof bodies[number])=>{d.mesh.material=diceFaceOrder(d.mesh.quaternion,d.value).map(i=>d.mats[i]);};
 const step=(dt:number)=>{if(finished)return false;accumulator+=Math.min(Math.max(dt,0),.1);while(accumulator>=1/120){world.step();accumulator-=1/120;elapsed+=1/120;}
  for(const d of bodies){const p=d.body.translation(),r=d.body.rotation();d.mesh.position.set(p.x,p.y,p.z);d.mesh.quaternion.set(r.x,r.y,r.z,r.w);}
  if(elapsed>=limit&&bodies.every(d=>{const v=d.body.linvel(),w=d.body.angvel();return Math.hypot(v.x,v.y,v.z)<.35&&Math.hypot(w.x,w.y,w.z)<.65;})){for(const d of bodies){alignFaces(d);d.body.setLinvel({x:0,y:0,z:0},false);d.body.setAngvel({x:0,y:0,z:0},false);}finished=true;}
  return !finished;
 };
 return {step,dispose(){for(const d of bodies){scene.remove(d.mesh);d.mesh.geometry.dispose();d.mats.forEach(m=>{m.map?.dispose();m.dispose();});}world.free();}};
}
