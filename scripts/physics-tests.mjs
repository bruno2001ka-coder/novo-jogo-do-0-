import assert from'node:assert/strict';
import{
  FIXED_DT,integrateVehicleSpeed,steeringAngle,bicycleYawDelta,planarApproach
}from'../src/GamePhysics.js';

const car={
  max:23,maxReverse:7.2,accelForward:8.8,accelReverse:5.4,brakeDecel:18,
  rollingDrag:1.15,aeroDrag:.012,slopeGravity:.78,
  steerLow:.56,steerHigh:.16,steerFadeStart:4.5,steerFadeEnd:20,wheelBase:2.55
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

const forwardYaw=bicycleYawDelta(10,.3,car.wheelBase,FIXED_DT);
const reverseYaw=bicycleYawDelta(-5,.3,car.wheelBase,FIXED_DT);
assert(forwardYaw>0&&reverseYaw<0,'ré deve inverter o sentido da guinada');

const p=planarApproach(0,0,10,0,5,1);
assert.equal(p.x,5);
assert.equal(p.z,0);

console.log(JSON.stringify({ok:true,checks:5},null,2));
