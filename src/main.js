import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{separarRodas}from'./Rodas.js';
import{criarCampoDeProvas}from'./TestTrack.js';
import{criarProfiler}from'./Profiler.js';
import{FIXED_DT,MAX_PHYSICS_STEPS,approach,expAlpha,integrateVehicleSpeed,steeringAngle,bicycleYawRate,stabilizeYawRate,stabilizeAttitude,groundClampY,planarApproach}from'./GamePhysics.js';

const $=id=>document.getElementById(id);
const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<900;
const debug=new URLSearchParams(location.search).get('debug')==='1';
if(mobile)document.documentElement.classList.add('mobile');
if(debug)document.body.classList.add('debug');

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9fc2da);
scene.fog=new THREE.Fog(0x9fc2da,95,205);

const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,260);
const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'high-performance'});
renderer.setPixelRatio(mobile?1:Math.min(devicePixelRatio||1,1.25));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=false;
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xddeeff,0x506044,2));
const sun=new THREE.DirectionalLight(0xffffff,2);
sun.position.set(35,55,20);scene.add(sun);

const track=criarCampoDeProvas(scene,{debug});

const RAW='https://raw.githubusercontent.com/bruno2001ka-coder/cloude-jogo-/main/assets/';
const URLS={
  personagem:RAW+'personagem.glb',
  pilotando:RAW+'pilotando.glb',
  moto:RAW+'moto.glb',
  carro:RAW+'carro.glb'
};
const loader=new GLTFLoader();

function material(c){return new THREE.MeshStandardMaterial({color:c,roughness:.72,metalness:.12})}

function fallbackPerson(){
  const g=new THREE.Group(),skin=material(0xb97950),shirt=material(0x334f76),pants=material(0x202832);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.25,.72,4,8),shirt);body.position.y=1.05;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),skin);head.position.y=1.72;g.add(head);
  const legs=[],arms=[];
  for(const s of[-1,1]){
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.6,3,6),pants);
    leg.position.set(s*.12,.42,0);g.add(leg);legs.push(leg);
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.52,3,6),skin);
    arm.position.set(s*.34,1.12,0);g.add(arm);arms.push(arm);
  }
  g.userData.fallbackRig={legs,arms};
  return g;
}

function fallbackCar(){
  const g=new THREE.Group(),body=material(0x285c9b),dark=material(0x111315);
  const b=new THREE.Mesh(new THREE.BoxGeometry(3.8,.62,1.75),body);b.position.y=.62;g.add(b);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(1.9,.55,1.55),material(0x24333e));cab.position.set(.2,1.14,0);g.add(cab);
  const wheels=[];
  for(const x of[-1.25,1.25])for(const z of[-.82,.82]){
    const pivo=new THREE.Group();pivo.position.set(x,.34,z);g.add(pivo);
    const giro=new THREE.Group();pivo.add(giro);
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.22,12),dark);
    w.rotation.x=Math.PI/2;giro.add(w);
    wheels.push({pivo,malha:giro,eixoGiro:'z',raio:.34,dianteira:x<0});
  }
  g.userData.fallbackWheels=wheels;
  return g;
}

function fallbackMoto(){
  const g=new THREE.Group(),frame=material(0x22384f),dark=material(0x151515);
  const tank=new THREE.Mesh(new THREE.BoxGeometry(1.3,.5,.55),frame);tank.position.set(0,.82,0);g.add(tank);
  const wheels=[];
  for(const x of[-.82,.82]){
    const pivo=new THREE.Group();pivo.position.set(x,.4,0);g.add(pivo);
    const giro=new THREE.Group();pivo.add(giro);
    const w=new THREE.Mesh(new THREE.TorusGeometry(.38,.075,8,16),dark);
    w.rotation.y=Math.PI/2;giro.add(w);
    wheels.push({pivo,malha:giro,eixoGiro:'z',raio:.38,dianteira:x<0});
  }
  const fork=new THREE.Mesh(new THREE.BoxGeometry(.12,.72,.12),dark);
  fork.position.set(-.72,.78,0);fork.rotation.z=.18;g.add(fork);
  g.userData.fallbackWheels=wheels;
  return g;
}

function normalize(obj,{height=null,length=null,modelYaw=-Math.PI/2}={}){
  obj.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3());
  const scale=height?height/Math.max(.001,size.y):length/Math.max(.001,size.x,size.z);
  obj.scale.setScalar(scale);obj.rotation.y=modelYaw;obj.updateMatrixWorld(true);
  const b2=new THREE.Box3().setFromObject(obj),center=b2.getCenter(new THREE.Vector3());
  obj.position.x-=center.x;obj.position.z-=center.z;obj.position.y-=b2.min.y;
  obj.traverse(o=>{if(o.isMesh){o.frustumCulled=true;o.castShadow=false;o.receiveShadow=false}});
  return obj;
}

const player=new THREE.Group(),bike=new THREE.Group(),car=new THREE.Group();
player.rotation.order='YXZ';
bike.rotation.order='YXZ';
car.rotation.order='YXZ';
scene.add(player,bike,car);
const SPAWN={player:{x:0,z:22},moto:{x:3.2,z:22},car:{x:-3.2,z:22}};
player.position.set(SPAWN.player.x,track.groundHeight(SPAWN.player.x,SPAWN.player.z),SPAWN.player.z);
bike.position.set(SPAWN.moto.x,track.groundHeight(SPAWN.moto.x,SPAWN.moto.z),SPAWN.moto.z);
car.position.set(SPAWN.car.x,track.groundHeight(SPAWN.car.x,SPAWN.car.z),SPAWN.car.z);

const character={
  model:null,mixer:null,actions:{},current:null,pilot:null,basePos:new THREE.Vector3(),
  fallbackRig:null,ready:false
};

const vehicles={
  moto:{
    obj:bike,speed:0,max:18,maxReverse:5.8,
    accelForward:11.5,accelReverse:5.2,brakeDecel:17,
    rollingDrag:1.05,aeroDrag:.014,slopeGravity:.82,
    steerLow:.54,steerHigh:.15,steerFadeStart:3.5,steerFadeEnd:16,
    steerResponse:5.8,steerState:0,wheelBase:1.42,
    yawRate:0,maxYawRate:1.7,yawResponse:9,angularDamping:12,
    maxPitch:.32,maxRoll:.48,
    bodyPitch:0,longitudinalAccel:0,prevSpeed:0,
    lean:.34,label:'MOTO',wheels:null,radius:.44,
    halfLength:1.0,halfWidth:.27,maxStep:.22
  },
  car:{
    obj:car,speed:0,max:23,maxReverse:7.2,
    accelForward:8.8,accelReverse:5.4,brakeDecel:18,
    rollingDrag:1.15,aeroDrag:.012,slopeGravity:.78,
    steerLow:.56,steerHigh:.16,steerFadeStart:4.5,steerFadeEnd:20,
    steerResponse:4.8,steerState:0,wheelBase:2.55,
    yawRate:0,maxYawRate:.95,yawResponse:8.5,angularDamping:16,
    maxPitch:.22,maxRoll:.08,
    bodyPitch:0,bodyRoll:0,longitudinalAccel:0,prevSpeed:0,
    lean:0,label:'CARRO',wheels:null,radius:.92,
    halfLength:1.85,halfWidth:.78,maxStep:.18
  }
};

function makeRenderState(obj){
  return{
    obj,
    prevPos:obj.position.clone(),currPos:obj.position.clone(),
    prevQuat:obj.quaternion.clone(),currQuat:obj.quaternion.clone()
  };
}
const renderStates=[
  makeRenderState(player),makeRenderState(bike),makeRenderState(car)
];
function beginPhysicsStep(){
  for(const s of renderStates){
    s.prevPos.copy(s.currPos);
    s.prevQuat.copy(s.currQuat);
  }
}
function endPhysicsStep(){
  for(const s of renderStates){
    s.currPos.copy(s.obj.position);
    s.currQuat.copy(s.obj.quaternion);
  }
}
function snapRenderStates(){
  for(const s of renderStates){
    s.prevPos.copy(s.obj.position);s.currPos.copy(s.obj.position);
    s.prevQuat.copy(s.obj.quaternion);s.currQuat.copy(s.obj.quaternion);
  }
}
function applyRenderInterpolation(alpha){
  alpha=THREE.MathUtils.clamp(alpha,0,1);
  for(const s of renderStates){
    s.obj.position.lerpVectors(s.prevPos,s.currPos,alpha);
    s.obj.quaternion.copy(s.prevQuat).slerp(s.currQuat,alpha);
  }
}
function restorePhysicsTransforms(){
  for(const s of renderStates){
    s.obj.position.copy(s.currPos);
    s.obj.quaternion.copy(s.currQuat);
  }
}

function setCharacterAction(action,fade=.16){
  if(!action||character.current===action)return;
  action.enabled=true;action.paused=false;action.reset();action.setEffectiveWeight(1);action.play();
  if(character.current)character.current.crossFadeTo(action,fade,false);
  character.current=action;
}

function loadCharacter(){
  return new Promise(resolve=>{
    let finished=false;
    const done=(model,gltf=null)=>{
      if(finished)return;finished=true;
      normalize(model,{height:1.75,modelYaw:0});
      player.add(model);character.model=model;character.basePos.copy(model.position);
      character.fallbackRig=model.userData.fallbackRig||null;
      if(gltf?.animations?.length){
        character.mixer=new THREE.AnimationMixer(model);
        for(const clip of gltf.animations){
          const a=character.mixer.clipAction(clip);
          a.enabled=true;a.setLoop(THREE.LoopRepeat,Infinity);
          character.actions[clip.name]=a;
        }
        const idle=character.actions.Walking||Object.values(character.actions)[0];
        if(idle){setCharacterAction(idle,0);idle.time=0;idle.paused=true}
        loader.load(URLS.pilotando,p=>{
          const clip=p.animations?.find(c=>c.name==='rigify_clip')||p.animations?.[0];
          if(clip&&character.mixer){
            character.pilot=character.mixer.clipAction(clip);
            character.pilot.enabled=true;character.pilot.setLoop(THREE.LoopRepeat,Infinity);
          }
        },undefined,()=>{});
      }
      character.ready=true;resolve();
    };
    const timer=setTimeout(()=>done(fallbackPerson()),10000);
    loader.load(URLS.personagem,g=>{
      clearTimeout(timer);done(g.scene,g);
    },undefined,()=>{
      clearTimeout(timer);done(fallbackPerson());
    });
  });
}

function loadVehicle(name,url,fallback,opts,wheelCount){
  const v=vehicles[name];
  return new Promise(resolve=>{
    let finished=false;
    const done=(model,isFallback=false)=>{
      if(finished)return;finished=true;
      normalize(model,opts);
      v.obj.add(model);
      if(isFallback)v.wheels=model.userData.fallbackWheels||null;
      else{
        try{v.wheels=separarRodas(model,wheelCount)}
        catch(err){console.warn('Rodas não puderam ser separadas:',name,err);v.wheels=null}
      }
      resolve();
    };
    const timer=setTimeout(()=>done(fallback(),true),10000);
    loader.load(url,g=>{clearTimeout(timer);done(g.scene,false)},undefined,()=>{
      clearTimeout(timer);done(fallback(),true);
    });
  });
}

Promise.all([
  loadCharacter(),
  loadVehicle('moto',URLS.moto,fallbackMoto,{length:2.25,modelYaw:-Math.PI/2},2),
  loadVehicle('car',URLS.carro,fallbackCar,{length:4.2,modelYaw:-Math.PI/2},4)
]).then(()=>{
  const cw=vehicles.car.wheels?.length||0,mw=vehicles.moto.wheels?.length||0;
  $('modelStatus').textContent=`3/3 modelos · rodas carro ${cw}/4 · moto ${mw}/2`;
});

const keys=Object.create(null);
let jumpRequest=false,velY=0,mode='foot',camYaw=0,camPitch=.25;
const locomotion={vx:0,vz:0,grounded:true,coyote:.1,jumpBuffer:0};
let characterMotion={moving:false,running:false,speed:0};
const joy={x:0,y:0},look={active:false,id:null,x:0,y:0};

addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='Space'){jumpRequest=true;e.preventDefault()}
  if(e.code==='KeyM')toggleVehicle('moto');
  if(e.code==='KeyV')toggleVehicle('car');
  if(e.code==='KeyE')toggleNearest();
  if(e.code==='KeyR')reset();
});
addEventListener('keyup',e=>{keys[e.code]=false});

renderer.domElement.addEventListener('click',()=>{
  if(!mobile&&document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.();
});
addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==renderer.domElement)return;
  camYaw-=e.movementX*.0026;
  camPitch=THREE.MathUtils.clamp(camPitch-e.movementY*.0022,-.18,.75);
});

function activeTarget(){return mode==='foot'?player:vehicles[mode].obj}
function vehicleDistance(v){return player.position.distanceTo(v.obj.position)}

function restoreCharacterTransform(){
  if(!character.model)return;
  character.model.position.copy(character.basePos);
  character.model.rotation.y=0;
}

function exitVehicle(){
  if(mode==='foot')return;
  const v=vehicles[mode];
  const side=new THREE.Vector3(1.7,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),v.obj.rotation.y);
  player.position.copy(v.obj.position).add(side);
  player.position.y=track.groundHeight(player.position.x,player.position.z);
  player.rotation.x=0;player.rotation.z=0;
  player.visible=true;restoreCharacterTransform();
  locomotion.vx=0;locomotion.vz=0;velY=0;locomotion.grounded=true;locomotion.coyote=.1;
  mode='foot';document.body.classList.remove('driving');snapRenderStates();
}

function toggleVehicle(name){
  if(mode===name){exitVehicle();return}
  if(mode!=='foot')return;
  const v=vehicles[name];if(vehicleDistance(v)>4.5)return;
  mode=name;document.body.classList.add('driving');
  player.visible=name==='moto';
  if(name==='moto'){
    player.position.copy(v.obj.position);
    player.rotation.copy(v.obj.rotation);
  }
  snapRenderStates();
}

function toggleNearest(){
  if(mode!=='foot'){exitVehicle();return}
  const dm=vehicleDistance(vehicles.moto),dc=vehicleDistance(vehicles.car);
  if(Math.min(dm,dc)>4.5)return;
  toggleVehicle(dm<dc?'moto':'car');
}

function resetWheels(v){
  if(!v.wheels)return;
  for(const r of v.wheels){
    r.angulo=0;r.malha.rotation[r.eixoGiro]=0;
    if(r.dianteira)r.pivo.rotation.y=0;
    if(Number.isFinite(r.neutralY)){
      r.pivo.position.y=r.neutralY;
      r.suspensionY=r.neutralY;
    }
  }
}

function reset(){
  if(mode==='foot'){
    player.position.set(SPAWN.player.x,track.groundHeight(SPAWN.player.x,SPAWN.player.z),SPAWN.player.z);player.rotation.set(0,0,0);velY=0;
    locomotion.vx=0;locomotion.vz=0;locomotion.grounded=true;locomotion.coyote=.1;locomotion.jumpBuffer=0;
  }else{
    const v=vehicles[mode],s=SPAWN[mode];
    v.obj.position.set(s.x,track.groundHeight(s.x,s.z),s.z);
    v.obj.rotation.set(0,0,0);v.speed=0;v.steerState=0;v.yawRate=0;
    v.prevSpeed=0;v.longitudinalAccel=0;v.bodyPitch=0;v.bodyRoll=0;resetWheels(v);
  }
  snapRenderStates();
}

function animateFallbackCharacter(moving,running,pilot,dt){
  const rig=character.fallbackRig;if(!rig)return;
  if(pilot){
    for(const leg of rig.legs)leg.rotation.x=THREE.MathUtils.lerp(leg.rotation.x,-1.05,1-Math.exp(-12*dt));
    rig.arms[0].rotation.x=THREE.MathUtils.lerp(rig.arms[0].rotation.x,-1.15,1-Math.exp(-12*dt));
    rig.arms[1].rotation.x=THREE.MathUtils.lerp(rig.arms[1].rotation.x,-1.15,1-Math.exp(-12*dt));
    return;
  }
  const amp=running?1.05:.72,phase=moving?performance.now()*.012*(running?1.45:1):0;
  const swing=moving?Math.sin(phase)*amp:0;
  rig.legs[0].rotation.x=THREE.MathUtils.lerp(rig.legs[0].rotation.x,swing,1-Math.exp(-14*dt));
  rig.legs[1].rotation.x=THREE.MathUtils.lerp(rig.legs[1].rotation.x,-swing,1-Math.exp(-14*dt));
  rig.arms[0].rotation.x=THREE.MathUtils.lerp(rig.arms[0].rotation.x,-swing*.55,1-Math.exp(-14*dt));
  rig.arms[1].rotation.x=THREE.MathUtils.lerp(rig.arms[1].rotation.x,swing*.55,1-Math.exp(-14*dt));
}

function updateCharacterAnimation(dt,{moving=false,running=false,speed=0,pilot=false}={}){
  animateFallbackCharacter(moving,running,pilot,dt);
  if(!character.mixer||!character.model)return;

  if(pilot&&character.pilot){
    setCharacterAction(character.pilot);
    character.pilot.paused=false;character.pilot.timeScale=1;
    character.model.rotation.y=Math.PI;
    character.model.position.copy(character.basePos);
    character.model.position.y+=.28;
    character.model.position.z+=.27;
    character.mixer.update(dt);
    return;
  }

  character.model.rotation.y=0;
  character.model.position.copy(character.basePos);
  const walk=character.actions.Walking||Object.values(character.actions)[0];
  const run=character.actions.Running||walk;
  const action=running?run:walk;
  if(action)setCharacterAction(action);

  if(!moving){
    if(character.current){character.current.paused=true;character.current.time=0}
  }else if(character.current){
    character.current.paused=false;
    const natural=running?4.53:1.21;
    character.current.timeScale=THREE.MathUtils.clamp(speed/natural,.55,4.2);
  }
  character.mixer.update(dt);
}

function walk(dt){
  const ix=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joy.x;
  const iz=(keys.KeyW?1:0)-(keys.KeyS?1:0)-joy.y;
  const inputLen=Math.hypot(ix,iz);
  const hasInput=inputLen>.08;
  const running=hasInput&&!!(keys.ShiftLeft||keys.ShiftRight||Math.hypot(joy.x,joy.y)>.86);
  const maxSpeed=running?6.6:4.25;

  let targetX=0,targetZ=0;
  if(hasInput){
    const nx=ix/Math.max(1,inputLen),nz=iz/Math.max(1,inputLen);
    const fX=-Math.sin(camYaw),fZ=-Math.cos(camYaw);
    const rX=Math.cos(camYaw),rZ=-Math.sin(camYaw);
    let mx=fX*nz+rX*nx,mz=fZ*nz+rZ*nx;
    const ml=Math.hypot(mx,mz)||1;mx/=ml;mz/=ml;
    targetX=mx*maxSpeed;targetZ=mz*maxSpeed;
  }

  const floorBefore=track.groundHeight(player.position.x,player.position.z);
  const nearGround=player.position.y<=floorBefore+.08&&velY<=.6;
  if(nearGround){
    locomotion.grounded=true;
    locomotion.coyote=.10;
  }else{
    locomotion.coyote=Math.max(0,locomotion.coyote-dt);
  }

  if(jumpRequest)locomotion.jumpBuffer=.12;
  jumpRequest=false;
  locomotion.jumpBuffer=Math.max(0,locomotion.jumpBuffer-dt);

  const accel=hasInput?(locomotion.grounded?22:7):(locomotion.grounded?30:3.5);
  const next=planarApproach(locomotion.vx,locomotion.vz,targetX,targetZ,accel,dt);
  locomotion.vx=next.x;locomotion.vz=next.z;

  const wantedX=locomotion.vx*dt,wantedZ=locomotion.vz*dt;
  const step=track.moveXZ(player.position,wantedX,wantedZ,.33,.31);
  if(Math.abs(step.x-wantedX)>.02)locomotion.vx=0;
  if(Math.abs(step.z-wantedZ)>.02)locomotion.vz=0;

  const horizontalSpeed=Math.hypot(step.x,step.z)/Math.max(dt,1e-5);
  if(horizontalSpeed>.04)player.rotation.y=Math.atan2(step.x,step.z);

  if(locomotion.jumpBuffer>0&&locomotion.coyote>0){
    velY=5.55;
    locomotion.grounded=false;
    locomotion.coyote=0;
    locomotion.jumpBuffer=0;
  }

  if(!locomotion.grounded||velY>0)velY-=18.5*dt;
  player.position.y+=velY*dt;

  const floor=track.groundHeight(player.position.x,player.position.z);
  const drop=player.position.y-floor;
  if(player.position.y<=floor||(velY<=0&&drop<=.16)){
    player.position.y=floor;
    velY=0;
    locomotion.grounded=true;
    locomotion.coyote=.10;
  }else{
    locomotion.grounded=false;
  }

  return{moving:horizontalSpeed>.08,running,speed:horizontalSpeed};
}

const wheelNeutralWorld=new THREE.Vector3();
const wheelTargetWorld=new THREE.Vector3();
const wheelTargetLocal=new THREE.Vector3();

function animateWheels(v,distance,steerVisual){
  if(!v.wheels)return;

  const isCar=v===vehicles.car;
  const isMoto=v===vehicles.moto;
  if(isCar||isMoto)v.obj.updateMatrixWorld(true);

  for(const r of v.wheels){
    r.angulo=(r.angulo||0)+distance/Math.max(.05,r.raio||.3);
    r.malha.rotation[r.eixoGiro]=r.angulo;
    if(r.dianteira)r.pivo.rotation.y=steerVisual;

    // Curso visual independente: carro ±8 cm, moto ±6 cm.
    // A dianteira encontra o obstáculo antes porque cada roda mede o solo sob sua própria posição global.
    if((isCar||isMoto)&&r.pivo.parent){
      if(!Number.isFinite(r.neutralY)){
        r.neutralY=r.pivo.position.y;
        r.suspensionY=r.neutralY;
      }

      wheelNeutralWorld
        .set(r.pivo.position.x,r.neutralY,r.pivo.position.z);
      r.pivo.parent.localToWorld(wheelNeutralWorld);

      const wx=wheelNeutralWorld.x,wz=wheelNeutralWorld.z;
      const groundY=track.groundHeight(wx,wz);
      const wheelBottomY=wheelNeutralWorld.y-Math.max(.05,r.raio||.3);
      const travelLimit=isMoto?.06:.08;
      const travelWorld=THREE.MathUtils.clamp(
        groundY-wheelBottomY,
        -travelLimit,
        travelLimit
      );

      wheelTargetWorld.copy(wheelNeutralWorld);
      wheelTargetWorld.y+=travelWorld;
      wheelTargetLocal.copy(wheelTargetWorld);
      r.pivo.parent.worldToLocal(wheelTargetLocal);

      const targetLocalY=wheelTargetLocal.y;
      const suspensionResponse=isMoto?(r.dianteira?18:15):16;
      r.suspensionY=THREE.MathUtils.lerp(
        r.suspensionY,
        targetLocalY,
        expAlpha(suspensionResponse,FIXED_DT)
      );
      r.pivo.position.y=r.suspensionY;
    }
  }
}

function getVehiclePose(v,name){
  return name==='moto'
    ?track.twoWheelPose(v.obj.position.x,v.obj.position.z,v.obj.rotation.y,v.halfLength)
    :track.terrainPose(v.obj.position.x,v.obj.position.z,v.obj.rotation.y,v.halfLength,v.halfWidth);
}

function vehicleGroundClearance(v){
  if(!v.wheels?.length)return .025;
  const avg=v.wheels.reduce((sum,w)=>sum+Math.max(.05,w.raio||.3),0)/v.wheels.length;
  return THREE.MathUtils.clamp(avg*.08,.02,.045);
}

function applyVehicleGroundPose(v,steerAngleValue,dt,name){
  const pose=getVehiclePose(v,name);
  const a=expAlpha(14,dt);

  const speedRatio=THREE.MathUtils.clamp(Math.abs(v.speed)/Math.max(1,v.max),0,1);
  const turnLean=name==='moto'?THREE.MathUtils.clamp(-steerAngleValue*speedRatio*1.15,-.46,.46):0;

  let secondaryPitch=0,secondaryRoll=0;
  if(name==='car'){
    // Dive/squat: desaceleração mergulha a frente (~3°), aceleração afunda a traseira (~2°).
    const brakeLoad=THREE.MathUtils.clamp(-v.longitudinalAccel/12,0,1);
    const accelLoad=THREE.MathUtils.clamp(v.longitudinalAccel/10,0,1);
    const pitchTarget=
      accelLoad*THREE.MathUtils.degToRad(2)-
      brakeLoad*THREE.MathUtils.degToRad(3);

    v.bodyPitch=THREE.MathUtils.lerp(
      v.bodyPitch,
      pitchTarget,
      expAlpha(7.5,dt)
    );

    // Transferência lateral: inclina levemente para o lado externo da curva.
    const lateralLoad=v.speed*steerAngleValue;
    const rollTarget=THREE.MathUtils.clamp(-lateralLoad*.006,-.065,.065);
    v.bodyRoll=THREE.MathUtils.lerp(
      v.bodyRoll,
      rollTarget,
      expAlpha(8.5,dt)
    );

    secondaryPitch=v.bodyPitch;
    secondaryRoll=v.bodyRoll;
  }else if(name==='moto'){
    // Mergulho arcade do garfo e assentada traseira sem alterar o controle da moto.
    const brakeLoad=THREE.MathUtils.clamp(-v.longitudinalAccel/11,0,1);
    const accelLoad=THREE.MathUtils.clamp(v.longitudinalAccel/9,0,1);
    const pitchTarget=
      accelLoad*THREE.MathUtils.degToRad(1.75)-
      brakeLoad*THREE.MathUtils.degToRad(2.75);

    v.bodyPitch=THREE.MathUtils.lerp(
      v.bodyPitch,
      pitchTarget,
      expAlpha(9,dt)
    );
    secondaryPitch=v.bodyPitch;
  }

  const stable=stabilizeAttitude(
    pose.pitch+secondaryPitch,
    name==='moto'?pose.roll+turnLean:pose.roll+secondaryRoll,
    v
  );

  v.obj.rotation.x=THREE.MathUtils.lerp(v.obj.rotation.x,stable.pitch,a);
  v.obj.rotation.z=THREE.MathUtils.lerp(v.obj.rotation.z,stable.roll,expAlpha(14,dt));

  // Como o root do GLB foi normalizado para a base do modelo, inclinar o root pode fazer
  // uma quina descer abaixo de Y. Esta folga compensa a geometria inclinada.
  const pitchClearance=Math.abs(Math.sin(v.obj.rotation.x))*v.halfLength;
  const rollClearance=Math.abs(Math.sin(v.obj.rotation.z))*v.halfWidth;
  const suspensionClearance=vehicleGroundClearance(v);
  const centerFloor=track.groundHeight(v.obj.position.x,v.obj.position.z);

  const supportedY=Math.max(
    pose.y+pitchClearance+rollClearance+suspensionClearance,
    centerFloor+suspensionClearance
  );

  // Última barreira: a base nunca pode ficar abaixo do terreno.
  v.obj.position.y=groundClampY(supportedY,centerFloor,suspensionClearance);
  return pose;
}

function drive(dt,v,name){
  const keyThrottle=keys.KeyW?1:0,keyReverse=keys.KeyS?1:0;
  const joyThrottle=joy.y<-.12?THREE.MathUtils.clamp((-joy.y-.12)/.88,0,1):0;
  const joyReverse=joy.y>.12?THREE.MathUtils.clamp((joy.y-.12)/.88,0,1):0;
  const throttle=Math.max(keyThrottle,joyThrottle);
  const reverse=Math.max(keyReverse,joyReverse);
  const steerTarget=THREE.MathUtils.clamp(((keys.KeyA?1:0)-(keys.KeyD?1:0))-joy.x,-1,1);

  const poseBefore=getVehiclePose(v,name);
  const speedBefore=v.speed;
  v.speed=integrateVehicleSpeed(v.speed,throttle,reverse,v,dt,poseBefore.pitch);
  v.longitudinalAccel=(v.speed-speedBefore)/Math.max(dt,1e-4);
  v.prevSpeed=v.speed;

  v.steerState=approach(v.steerState,steerTarget,v.steerResponse*dt);
  if(Math.abs(steerTarget)<.01)v.steerState=approach(v.steerState,0,v.steerResponse*1.25*dt);

  const wheelAngle=steeringAngle(v.steerState,v.speed,v);
  const targetYawRate=bicycleYawRate(v.speed,wheelAngle,v.wheelBase);
  v.yawRate=stabilizeYawRate(v.yawRate,targetYawRate,steerTarget,v,dt);

  const dyaw=v.yawRate*dt;
  if(Math.abs(dyaw)>1e-6){
    const candidateYaw=v.obj.rotation.y+dyaw;
    if(track.vehicleTurnAllowed(
      v.obj.position.x,v.obj.position.z,v.obj.rotation.y,candidateYaw,
      v.halfLength,v.halfWidth,v.maxStep,name==='moto'
    )){
      v.obj.rotation.y=candidateYaw;
    }else{
      // Colisão durante a curva mata a rotação acumulada em vez de deixar o carro "pião".
      v.yawRate=0;
      v.speed*=.72;
      v.steerState=approach(v.steerState,0,v.steerResponse*1.5*dt);
    }
  }

  const requested=v.speed*dt;
  const fX=-Math.sin(v.obj.rotation.y),fZ=-Math.cos(v.obj.rotation.y);
  const ox=v.obj.position.x,oz=v.obj.position.z;
  const moved=track.moveVehicle(
    v.obj.position,v.obj.rotation.y,fX*requested,fZ*requested,
    v.halfLength,v.halfWidth,v.maxStep,name==='moto'
  );
  const actual=(v.obj.position.x-ox)*fX+(v.obj.position.z-oz)*fZ;

  if(moved.blocked&&Math.abs(requested)>.002){
    const ratio=Math.abs(actual)/Math.abs(requested);
    if(ratio<.72)v.speed*=Math.max(.04,ratio*.28);
  }

  animateWheels(v,actual,wheelAngle);
  applyVehicleGroundPose(v,wheelAngle,dt,name);

  if(name==='moto'){
    player.visible=true;
    player.position.copy(v.obj.position);
    player.rotation.copy(v.obj.rotation);
  }
}

function updateCamera(dt){
  const target=activeTarget().position;
  const h=mode==='foot'?1.25:1.05,dist=mode==='foot'?5.2:7.5;
  const cp=Math.cos(camPitch),sp=Math.sin(camPitch);
  const pivot=new THREE.Vector3(target.x,target.y+h,target.z);
  const desired=new THREE.Vector3(
    target.x+Math.sin(camYaw)*cp*dist,
    target.y+h+sp*dist,
    target.z+Math.cos(camYaw)*cp*dist
  );
  const safe=track.cameraSafePosition(pivot,desired,.28);
  camera.position.lerp(safe,1-Math.exp(-12*dt));
  camera.lookAt(pivot);
}

function bindJoystick(){
  const base=$('joyBase'),knob=$('joyKnob');let id=null;
  const update=e=>{
    const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,rad=r.width*.36;
    let dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy)||1;
    if(d>rad){dx*=rad/d;dy*=rad/d}
    joy.x=dx/rad;joy.y=dy/rad;knob.style.transform=`translate(${dx}px,${dy}px)`;
  };
  base.addEventListener('pointerdown',e=>{id=e.pointerId;base.setPointerCapture(id);update(e)});
  base.addEventListener('pointermove',e=>{if(e.pointerId===id)update(e)});
  const end=e=>{if(e.pointerId!==id)return;id=null;joy.x=joy.y=0;knob.style.transform=''};
  base.addEventListener('pointerup',end);base.addEventListener('pointercancel',end);
}

function bindLook(){
  const z=$('lookZone');
  z.addEventListener('pointerdown',e=>{look.active=true;look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY;z.setPointerCapture(e.pointerId)});
  z.addEventListener('pointermove',e=>{
    if(!look.active||e.pointerId!==look.id)return;
    const dx=e.clientX-look.x,dy=e.clientY-look.y;look.x=e.clientX;look.y=e.clientY;
    camYaw-=dx*.006;camPitch=THREE.MathUtils.clamp(camPitch-dy*.005,-.18,.75);
  });
  const end=e=>{if(e.pointerId===look.id)look.active=false};
  z.addEventListener('pointerup',end);z.addEventListener('pointercancel',end);
}

bindJoystick();bindLook();
$('motoBtn').addEventListener('pointerdown',e=>{e.preventDefault();toggleVehicle('moto')});
$('carBtn').addEventListener('pointerdown',e=>{e.preventDefault();toggleVehicle('car')});
$('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();jumpRequest=true});
$('playBtn').addEventListener('click',()=>{
  $('start').classList.add('hide');renderer.domElement.focus();
  if(!mobile)renderer.domElement.requestPointerLock?.();
});

const profiler=criarProfiler(renderer,{
  enabled:debug,
  getContext:()=>{
    const t=activeTarget().position;
    return{
      mode:mode==='foot'?'A PÉ':vehicles[mode].label,
      zone:track.zoneAt(t.x,t.z),x:t.x,z:t.z
    };
  }
});

let last=performance.now(),fpsFrames=0,fpsTime=0,accumulator=0;
function simulate(dt){
  if(mode==='foot'){
    characterMotion=walk(dt);
  }else{
    drive(dt,vehicles[mode],mode);
  }
}

function frame(now){
  requestAnimationFrame(frame);
  const rawDt=Math.min((now-last)/1000,.10);last=now;

  if(!$('start').classList.contains('hide')){
    accumulator=0;
    renderer.render(scene,camera);profiler.frame(rawDt);return;
  }

  accumulator=Math.min(accumulator+rawDt,FIXED_DT*MAX_PHYSICS_STEPS);
  let steps=0;
  while(accumulator>=FIXED_DT&&steps<MAX_PHYSICS_STEPS){
    beginPhysicsStep();
    simulate(FIXED_DT);
    endPhysicsStep();
    accumulator-=FIXED_DT;
    steps++;
  }

  const renderAlpha=accumulator/FIXED_DT;
  applyRenderInterpolation(renderAlpha);

  if(mode==='foot')updateCharacterAnimation(rawDt,characterMotion);
  else if(mode==='moto')updateCharacterAnimation(rawDt,{pilot:true});

  updateCamera(rawDt);
  renderer.render(scene,camera);
  restorePhysicsTransforms();
  profiler.frame(rawDt);

  fpsFrames++;fpsTime+=rawDt;
  if(fpsTime>=.5){
    $('fps').textContent=Math.round(fpsFrames/fpsTime);
    $('mode').textContent=mode==='foot'?'A PÉ':vehicles[mode].label;
    $('speed').textContent=mode==='foot'?Math.round(characterMotion.speed*3.6):Math.round(Math.abs(vehicles[mode].speed)*3.6);
    fpsFrames=0;fpsTime=0;
  }
}

camera.position.set(0,4,8);requestAnimationFrame(frame);

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setPixelRatio(mobile?1:Math.min(devicePixelRatio||1,1.25));
  renderer.setSize(innerWidth,innerHeight);
});
