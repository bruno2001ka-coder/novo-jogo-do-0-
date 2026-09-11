export const FIXED_DT=1/60;
export const MAX_PHYSICS_STEPS=5;

export function clamp(v,min,max){
  return Math.max(min,Math.min(max,v));
}

export function approach(v,target,maxDelta){
  if(v<target)return Math.min(v+maxDelta,target);
  if(v>target)return Math.max(v-maxDelta,target);
  return target;
}

export function expAlpha(rate,dt){
  return 1-Math.exp(-Math.max(0,rate)*dt);
}

export function integrateVehicleSpeed(speed,throttle,reverse,cfg,dt){
  throttle=clamp(throttle,0,1);
  reverse=clamp(reverse,0,1);

  if(throttle>.001){
    if(speed<-.05){
      speed=approach(speed,0,cfg.brakeDecel*throttle*dt);
    }else{
      speed+=cfg.accelForward*throttle*dt;
    }
  }else if(reverse>.001){
    if(speed>.05){
      speed=approach(speed,0,cfg.brakeDecel*reverse*dt);
    }else{
      speed-=cfg.accelReverse*reverse*dt;
    }
  }else{
    speed=approach(speed,0,cfg.coastDecel*dt);
  }

  speed=clamp(speed,-cfg.maxReverse,cfg.max);
  if(Math.abs(speed)<.02)speed=0;
  return speed;
}

export function steeringAngle(input,speed,cfg){
  input=clamp(input,-1,1);
  const speedRatio=clamp(Math.abs(speed)/Math.max(1,cfg.max),0,1);
  const maxAngle=cfg.steerLow+(cfg.steerHigh-cfg.steerLow)*speedRatio;
  return input*maxAngle;
}

/**
 * Direção arcade: não existe velocidade angular acumulada.
 * Soltou o direcional => delta de yaw vira zero no mesmo passo.
 */
export function arcadeTurnDelta(speed,steerInput,cfg,dt){
  steerInput=clamp(steerInput,-1,1);
  if(Math.abs(steerInput)<.01||Math.abs(speed)<.08)return 0;

  const speedRatio=clamp(Math.abs(speed)/Math.max(1,cfg.max),0,1);
  const rate=cfg.turnRateLow+(cfg.turnRateHigh-cfg.turnRateLow)*speedRatio;
  const grip=clamp(Math.abs(speed)/Math.max(.01,cfg.turnGripSpeed??2.2),0,1);
  const direction=speed>=0?1:-1;
  return steerInput*rate*grip*direction*dt;
}

export function clampPitch(pitch,maxDegrees=20){
  const max=maxDegrees*Math.PI/180;
  return clamp(Number.isFinite(pitch)?pitch:0,-max,max);
}

export function clampLean(roll,maxDegrees=15){
  const max=maxDegrees*Math.PI/180;
  return clamp(Number.isFinite(roll)?roll:0,-max,max);
}

export function groundClampY(currentY,groundY,clearance=0){
  if(!Number.isFinite(currentY))currentY=0;
  if(!Number.isFinite(groundY))groundY=0;
  return Math.max(currentY,groundY+Math.max(0,clearance));
}

export function planarApproach(vx,vz,targetX,targetZ,maxAccel,dt){
  const dx=targetX-vx,dz=targetZ-vz;
  const d=Math.hypot(dx,dz);
  const maxDelta=Math.max(0,maxAccel*dt);
  if(d<=maxDelta||d===0)return{x:targetX,z:targetZ};
  const s=maxDelta/d;
  return{x:vx+dx*s,z:vz+dz*s};
}
