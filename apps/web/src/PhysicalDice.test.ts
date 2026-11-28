import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {diceFaceOrder,loadDicePhysics} from './PhysicalDice';
const normals=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];
const values=[3,4,1,6,2,5];
const orientations=normals.flatMap(n=>[0,1,2,3].map(k=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),k*Math.PI/2).multiply(new THREE.Quaternion().setFromUnitVectors(n,new THREE.Vector3(0,1,0)))));
describe('physical dice',()=>{
 it('preserves all 36 outcomes in every pair of 24 resting orientations',()=>{
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(const q of orientations)for(const p of orientations){
   for(const [rotation,value] of [[q,a],[p,b]] as const){
    const order=diceFaceOrder(rotation,value),mapped=order.map(i=>values[i]);
    const top=normals.map(n=>n.clone().applyQuaternion(rotation).y).reduce((best,y,i,ys)=>y>ys[best]?i:best,0);
    if(mapped[top]!==value||new Set(mapped).size!==6||mapped[0]+mapped[1]!==7||mapped[2]+mapped[3]!==7||mapped[4]+mapped[5]!==7)throw new Error('Incorrect cube mapping: '+mapped+' expected '+value);
   }
  }
 });
 it('initializes Rapier and resolves a falling cube against a static floor',async()=>{
  const R=await loadDicePhysics();const world=new R.World({x:0,y:-22,z:0});world.timestep=1/120;
  try{
   world.createCollider(R.ColliderDesc.cuboid(5,.25,5).setTranslation(0,-.25,0));
   const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,2,0));
   world.createCollider(R.ColliderDesc.cuboid(.34,.34,.34),body);
   for(let i=0;i<480;i++)world.step();
   expect(body.translation().y).toBeCloseTo(.34,1);
   expect(Math.abs(body.linvel().y)).toBeLessThan(.1);
  }finally{world.free();}
 },15000);
});
