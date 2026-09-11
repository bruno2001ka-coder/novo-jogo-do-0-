import assert from'node:assert/strict';
import{
  FIXED_DT,integrateVehicleSpeed,steeringAngle,bicycleYawRate,
  stabilizeYawRate,stabilizeAttitude,groundClampY,planarApproach,safeWheelRadius
}from'../src/GamePhysics.js';

const car={
  max:23,maxReverse:7.2,accelForward:8.8,accelReverse:5.4,brakeDecel:18,
  rollingDrag:1.15,aeroDrag:.012,slopeGravity:.78,
  steerLow:.56,steerHigh:.16,steerFadeStart:4.5,steerFadeEnd:20,wheelBase:2.55,
  maxYawRate:.95,yawResponse:8.5,angularDamping:16,maxPitch:.22,maxRoll:.045
};

let s=10;
for(let i=0;i<30;i++)s=integrateVehicleSpeed(s,0,1,car,FIXED_DT,0);
assert(s>=0,'ré deve frear o carro antes de inverter o sentido');

let coast=12;
for(let i=0;i<60;i++)coast=integrateVehicleSpeed(coast,0,0,car,FIXED_DT,0);
assert(coast<12&&coast>0,'arrasto deve reduzir velocidade progressivamente');

const low=Math.abs(steeringAngle(1,2,car));
const high=Math.abs(steeringAngle(1,22,car));
assert(low>high,'esterço deve diminuir em alta velocidade');

const rawRate=bicycleYawRate(23,.5,car.wheelBase);
let yawRate=0;
for(let i=0;i<120;i++)yawRate=stabilizeYawRate(yawRate,rawRate,1,car,FIXED_DT);
assert(Math.abs(yawRate)<=car.maxYawRate+1e-9,'taxa angular deve respeitar limite máximo');

const beforeRelease=Math.abs(yawRate);
for(let i=0;i<30;i++)yawRate=stabilizeYawRate(yawRate,0,0,car,FIXED_DT);
assert(Math.abs(yawRate)<beforeRelease*.05,'soltar direção deve amortecer giro rapidamente');

const attitude=stabilizeAttitude(.8,.7,car);
assert(Math.abs(attitude.pitch)<=car.maxPitch,'pitch deve ser limitado');
assert(Math.abs(attitude.roll)<=car.maxRoll,'roll deve ser limitado');

assert.equal(groundClampY(-1,0,.03),.03,'ground clamp deve impedir base abaixo do piso');
assert.equal(safeWheelRadius(NaN,{fallback:.32}),.32,'raio inválido deve usar fallback');

const p=planarApproach(0,0,10,0,5,1);
assert.equal(p.x,5);
assert.equal(p.z,0);

console.log(JSON.stringify({ok:true,checks:9},null,2));
