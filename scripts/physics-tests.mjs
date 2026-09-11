import assert from'node:assert/strict';
import{
  FIXED_DT,integrateVehicleSpeed,steeringAngle,arcadeTurnDelta,
  clampPitch,clampLean,groundClampY,planarApproach
}from'../src/GamePhysics.js';

const car={
  max:23,maxReverse:7.2,
  accelForward:8.8,accelReverse:5.4,brakeDecel:18,coastDecel:3.2,
  steerLow:.50,steerHigh:.20,
  turnRateLow:1.25,turnRateHigh:.58,turnGripSpeed:2.4
};

let s=0;
for(let i=0;i<60;i++)s=integrateVehicleSpeed(s,1,0,car,FIXED_DT);
assert(s>0&&s<=car.max,'aceleração arcade deve permanecer limitada');

let coast=s;
for(let i=0;i<60;i++)coast=integrateVehicleSpeed(coast,0,0,car,FIXED_DT);
assert(coast<s,'soltar acelerador deve reduzir velocidade');

const low=Math.abs(steeringAngle(1,2,car));
const high=Math.abs(steeringAngle(1,22,car));
assert(low>high,'esterço deve ficar mais suave em alta velocidade');

assert.equal(arcadeTurnDelta(12,0,car,FIXED_DT),0,'sem direção não pode existir giro residual');
const turn=arcadeTurnDelta(12,1,car,FIXED_DT);
assert(turn>0&&Math.abs(turn)<.05,'curva arcade deve ser limitada por passo');
assert(arcadeTurnDelta(-5,1,car,FIXED_DT)<0,'ré deve inverter o sentido da curva');

assert(Math.abs(clampPitch(Math.PI,20))<=20*Math.PI/180+1e-12,'pitch máximo deve ser 20 graus');
assert(Math.abs(clampLean(Math.PI,15))<=15*Math.PI/180+1e-12,'lean máximo deve ser 15 graus');
assert.equal(groundClampY(-2,0,0),0,'ground clamp deve impedir afundamento');

const p=planarApproach(0,0,10,0,5,1);
assert.equal(p.x,5);
assert.equal(p.z,0);

console.log(JSON.stringify({ok:true,checks:9},null,2));
