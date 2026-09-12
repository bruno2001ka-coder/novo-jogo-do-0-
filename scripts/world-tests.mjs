import assert from 'node:assert/strict';
import * as THREE from 'three';
import {criarCampoDeProvas} from '../src/TestTrack.js';
import {SPAWN} from '../src/WorldLayout.js';

const scene=new THREE.Scene();
const world=criarCampoDeProvas(scene,{mobile:true});
assert.equal(world.vehicleBlocked(-21.8,26.35,Math.PI/2,2.25,1),true,'portao fechado');
for(let i=0;i<180;i++)world.updateWorld(1/60,new THREE.Vector3(-19,0,26.35));
let samples=0;
for(const road of world.roadNetwork){
  for(let i=1;i<road.samples.length;i++){
    const a=road.samples[i-1],b=road.samples[i];
    const yaw=Math.atan2(a[0]-b[0],a[1]-b[1]);
    for(const [halfLength,halfWidth,twoWheel] of [[2.25,1,false],[1.1,.4,true]]){
      const p=new THREE.Vector3(a[0],world.groundHeight(...a),a[1]);
      assert.equal(world.vehicleBlocked(p.x,p.z,yaw,halfLength,halfWidth),false,`${road.id}: bloqueio no ponto ${i}`);
      const result=world.moveVehicle(p,yaw,b[0]-a[0],b[1]-a[1],halfLength,halfWidth,.25,twoWheel);
      assert.equal(result.blocked,false,`${road.id}: passagem bloqueada ${i}`);
      assert.ok(Math.hypot(p.x-b[0],p.z-b[1])<.001);
      const pose=twoWheel?world.twoWheelPose(p.x,p.z,yaw,halfLength):world.terrainPose(p.x,p.z,yaw,halfLength,halfWidth);
      assert.ok(Object.values(pose).filter(v=>typeof v==='number').every(Number.isFinite));
      samples++;
    }
  }
}
for(const key of ['car','moto']){
  const p=SPAWN[key];assert.equal(world.vehicleBlocked(p.x,p.z,0,key==='car'?2.25:1.1,key==='car'?1:.4),false);
}
assert.equal(world.vehicleBlocked(-35,31.25,0,2.25,1),true,'parede da casa deve bloquear');
const walker=new THREE.Vector3(-20,0,40);
world.moveXZ(walker,-.3,0,.35,.3);
assert.ok(Number.isFinite(walker.x));
let meshes=0;
scene.traverse(obj=>{if(!obj.isMesh)return;meshes++;const p=obj.geometry.getAttribute('position');assert.ok(p?.count>0,`geometria vazia: ${obj.name}`);for(const v of p.array)assert.ok(Number.isFinite(v),`geometria invalida: ${obj.name}`)});
console.log(JSON.stringify({ok:true,vehicleSegments:samples,meshes,stats:world.environment.stats},null,2));
