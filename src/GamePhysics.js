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

export function expAlpha(rate,dt){
  return 1-Math.exp(-Math.max(0,rate)*dt);
}

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

  speed-=GRAVITY*Math.sin(slopePitch)*(cfg.slopeGravity??.75)*dt;
  speed=clamp(speed,-cfg.maxReverse,cfg.max);

  if(Math.abs(speed)<.012)speed=0;
  return speed;
}

export function steeringAngle(input,speed,cfg){
  input=clamp(input,-1,1);
  const a=Math.abs(speed);
  const t=smoothstep01(
    (a-cfg.steerFadeStart)/
    Math.max(.001,cfg.steerFadeEnd-cfg.steerFadeStart)
  );
  const maxAngle=cfg.steerLow+(cfg.steerHigh-cfg.steerLow)*t;
  return input*maxAngle;
}

export function bicycleYawRate(speed,steerAngle,wheelBase){
  if(Math.abs(speed)<.001||Math.abs(steerAngle)<1e-5)return 0;
  return(speed/Math.max(.25,wheelBase))*Math.tan(steerAngle);
}

export function bicycleYawDelta(speed,steerAngle,wheelBase,dt){
  return bicycleYawRate(speed,steerAngle,wheelBase)*dt;
}

/**
 * Controlador de guinada estável.
 * - segue a taxa pedida pela geometria de bicicleta;
 * - limita giro máximo;
 * - quando o volante volta ao centro, aplica amortecimento angular forte.
 */
export function stabilizeYawRate(currentYawRate,targetYawRate,steerInput,cfg,dt){
  const maxYaw=Math.max(.05,cfg.maxYawRate??1.25);
  targetYawRate=clamp(targetYawRate,-maxYaw,maxYaw);

  if(Math.abs(steerInput)<.015){
    const damping=Math.max(1,cfg.angularDamping??12);
    currentYawRate*=Math.exp(-damping*dt);
    if(Math.abs(currentYawRate)<.002)currentYawRate=0;
    return clamp(currentYawRate,-maxYaw,maxYaw);
  }

  const response=Math.max(1,cfg.yawResponse??7);
  const alpha=expAlpha(response,dt);
  const next=currentYawRate+(targetYawRate-currentYawRate)*alpha;
  return clamp(next,-maxYaw,maxYaw);
}

/**
 * Mantém a atitude do carro dentro de ângulos seguros.
 * O yaw continua livre; só pitch/roll são limitados.
 */
export function stabilizeAttitude(pitch,roll,cfg={}){
  const maxPitch=Math.max(.01,cfg.maxPitch??.22);
  const maxRoll=Math.max(.01,cfg.maxRoll??.06);
  return{
    pitch:clamp(pitch,-maxPitch,maxPitch),
    roll:clamp(roll,-maxRoll,maxRoll),
  };
}

/**
 * Clamp de segurança do chassi contra o solo.
 * Nunca deixa a base do veículo ficar abaixo da altura calculada do terreno.
 */
export function groundClampY(currentY,groundY,clearance=.025){
  if(!Number.isFinite(currentY))currentY=groundY;
  if(!Number.isFinite(groundY))groundY=0;
  return Math.max(currentY,groundY+Math.max(0,clearance));
}

/**
 * Raio físico sanitizado para rodas detectadas de modelos GLB.
 * Evita raio zero/NaN/exagerado quebrando rotação e cálculos auxiliares.
 */
export function safeWheelRadius(radius,{min=.16,max=.65,fallback=.32}={}){
  if(!Number.isFinite(radius)||radius<=0)return fallback;
  return clamp(radius,min,max);
}

export function planarApproach(vx,vz,targetX,targetZ,maxAccel,dt){
  const dx=targetX-vx,dz=targetZ-vz;
  const d=Math.hypot(dx,dz);
  const maxDelta=Math.max(0,maxAccel*dt);
  if(d<=maxDelta||d===0)return{x:targetX,z:targetZ};
  const s=maxDelta/d;
  return{x:vx+dx*s,z:vz+dz*s};
}
