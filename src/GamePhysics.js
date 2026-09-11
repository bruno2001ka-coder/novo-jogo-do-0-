export const FIXED_DT=1/60;
export const MAX_PHYSICS_STEPS=5;
export const GRAVITY=9.81;

export function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
export function approach(v,target,maxDelta){
  if(v<target)return Math.min(v+maxDelta,target);
  if(v>target)return Math.max(v-maxDelta,target);
  return target;
}
export function smoothstep01(t){
  t=clamp(t,0,1);
  return t*t*(3-2*t);
}
export function expAlpha(rate,dt){return 1-Math.exp(-Math.max(0,rate)*dt)}

export function integrateVehicleSpeed(speed,throttle,reverse,cfg,dt,slopePitch=0){
  throttle=clamp(throttle,0,1);
  reverse=clamp(reverse,0,1);

  if(throttle>0.001){
    if(speed<-.05){
      speed=approach(speed,0,cfg.brakeDecel*throttle*dt);
    }else{
      const fade=1-clamp(Math.abs(speed)/Math.max(.01,cfg.max),0,1)*.28;
      speed+=cfg.accelForward*throttle*fade*dt;
    }
  }else if(reverse>0.001){
    if(speed>.05){
      speed=approach(speed,0,cfg.brakeDecel*reverse*dt);
    }else{
      const fade=1-clamp(Math.abs(speed)/Math.max(.01,cfg.maxReverse),0,1)*.22;
      speed-=cfg.accelReverse*reverse*fade*dt;
    }
  }else{
    const drag=cfg.rollingDrag+cfg.aeroDrag*speed*speed;
    speed=approach(speed,0,drag*dt);
  }

  // Componente da gravidade no eixo longitudinal: subida tira velocidade, descida acrescenta.
  speed-=GRAVITY*Math.sin(slopePitch)*(cfg.slopeGravity??.75)*dt;

  speed=clamp(speed,-cfg.maxReverse,cfg.max);
  if(Math.abs(speed)<.012)speed=0;
  return speed;
}

export function steeringAngle(input,speed,cfg){
  input=clamp(input,-1,1);
  const a=Math.abs(speed);
  const t=smoothstep01((a-cfg.steerFadeStart)/Math.max(.001,cfg.steerFadeEnd-cfg.steerFadeStart));
  const maxAngle=cfg.steerLow+(cfg.steerHigh-cfg.steerLow)*t;
  return input*maxAngle;
}

export function bicycleYawDelta(speed,steerAngle,wheelBase,dt){
  if(Math.abs(speed)<.001||Math.abs(steerAngle)<1e-5)return 0;
  return(speed/Math.max(.25,wheelBase))*Math.tan(steerAngle)*dt;
}

export function planarApproach(vx,vz,targetX,targetZ,maxAccel,dt){
  const dx=targetX-vx,dz=targetZ-vz;
  const d=Math.hypot(dx,dz);
  const maxDelta=Math.max(0,maxAccel*dt);
  if(d<=maxDelta||d===0)return{x:targetX,z:targetZ};
  const s=maxDelta/d;
  return{x:vx+dx*s,z:vz+dz*s};
}
