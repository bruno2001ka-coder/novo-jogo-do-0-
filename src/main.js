import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{separarRodas}from'./Rodas.js';
import{criarCampoDeProvas}from'./TestTrack.js';
import{criarProfiler}from'./Profiler.js';

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
scene.add(player,bike,car);
player.position.set(0,track.groundHeight(0,3),3);
bike.position.set(5,track.groundHeight(5,0),0);
car.position.set(-7,track.groundHeight(-7,0),0);

const character={
  model:null,mixer:null,actions:{},current:null,pilot:null,basePos:new THREE.Vector3(),
  fallbackRig:null,ready:false
};

const vehicles={
  moto:{
    obj:bike,speed:0,max:18,acc:15,brake:22,drag:4.2,steer:1.5,lean:.22,label:'MOTO',
    wheels:null,radius:.44,halfLength:1.0,halfWidth:.27,maxStep:.30
  },
  car:{
    obj:car,speed:0,max:23,acc:11,brake:25,drag:3.2,steer:.82,lean:.06,label:'CARRO',
    wheels:null,radius:.92,halfLength:1.85,halfWidth:.78,maxStep:.24
  }
};

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
  mode='foot';document.body.classList.remove('driving');
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
  }
}

function reset(){
  if(mode==='foot'){
    player.position.set(0,track.groundHeight(0,3),3);player.rotation.set(0,0,0);velY=0;
  }else{
    const v=vehicles[mode],x=mode==='moto'?5:-7;
    v.obj.position.set(x,track.groundHeight(x,0),0);
    v.obj.rotation.set(0,0,0);v.speed=0;resetWheels(v);
  }
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
  const len=Math.hypot(ix,iz);
  let moving=false,running=false,speed=0;
  const floorBefore=track.groundHeight(player.position.x,player.position.z);
  const grounded=player.position.y<=floorBefore+.03&&velY<=.05;

  if(len>.08){
    moving=true;
    const nx=ix/Math.max(1,len),nz=iz/Math.max(1,len);
    running=!!(keys.ShiftLeft||keys.ShiftRight||Math.hypot(joy.x,joy.y)>.86);
    speed=running?7.2:4.4;
    const f=new THREE.Vector3(-Math.sin(camYaw),0,-Math.cos(camYaw));
    const r=new THREE.Vector3(Math.cos(camYaw),0,-Math.sin(camYaw));
    const move=f.multiplyScalar(nz).add(r.multiplyScalar(nx)).normalize();
    const step=track.moveXZ(player.position,move.x*speed*dt,move.z*speed*dt,.33,.31);
    if(Math.hypot(step.x,step.z)>.0001)player.rotation.y=Math.atan2(move.x,move.z);
  }

  if(jumpRequest&&grounded){velY=5.7}
  jumpRequest=false;velY-=15.5*dt;player.position.y+=velY*dt;

  const floor=track.groundHeight(player.position.x,player.position.z);
  if(player.position.y<floor){player.position.y=floor;velY=0}

  return{moving,running,speed};
}

function animateWheels(v,distance,steerVisual){
  if(!v.wheels)return;
  for(const r of v.wheels){
    r.angulo=(r.angulo||0)+distance/Math.max(.05,r.raio||.3);
    r.malha.rotation[r.eixoGiro]=r.angulo;
    if(r.dianteira)r.pivo.rotation.y=steerVisual;
  }
}

function applyVehicleGroundPose(v,steer,dt){
  const pose=track.terrainPose(
    v.obj.position.x,v.obj.position.z,v.obj.rotation.y,v.halfLength,v.halfWidth
  );
  v.obj.position.y=pose.y;
  v.obj.rotation.x=THREE.MathUtils.lerp(v.obj.rotation.x,pose.pitch,1-Math.exp(-12*dt));
  const turnScale=THREE.MathUtils.clamp(Math.abs(v.speed)/Math.max(1,v.max),0,1);
  const lean=-steer*turnScale*v.lean;
  v.obj.rotation.z=THREE.MathUtils.lerp(v.obj.rotation.z,pose.roll+lean,1-Math.exp(-10*dt));
}

function drive(dt,v,name){
  const throttle=(keys.KeyW?1:0)+(joy.y<-.25?Math.min(1,-joy.y):0);
  const reverse=(keys.KeyS?1:0)+(joy.y>.25?Math.min(1,joy.y):0);
  const steer=((keys.KeyA?1:0)-(keys.KeyD?1:0))-joy.x;

  if(throttle>0)v.speed+=v.acc*throttle*dt;
  else if(reverse>0)v.speed-=v.acc*.62*reverse*dt;
  else v.speed-=Math.sign(v.speed)*Math.min(Math.abs(v.speed),v.drag*dt);
  v.speed=THREE.MathUtils.clamp(v.speed,-v.max*.32,v.max);

  const turnScale=THREE.MathUtils.clamp(Math.abs(v.speed)/3,.18,1);
  if(Math.abs(v.speed)>.04)v.obj.rotation.y+=steer*v.steer*turnScale*dt*Math.sign(v.speed);

  const requested=v.speed*dt;
  const f=new THREE.Vector3(-Math.sin(v.obj.rotation.y),0,-Math.cos(v.obj.rotation.y));
  const ox=v.obj.position.x,oz=v.obj.position.z;
  const move=track.moveXZ(v.obj.position,f.x*requested,f.z*requested,v.radius,v.maxStep);
  const actual=(v.obj.position.x-ox)*f.x+(v.obj.position.z-oz)*f.z;

  if(Math.abs(requested)>.001&&Math.abs(actual)<Math.abs(requested)*.35)v.speed*=.15;

  animateWheels(v,actual,steer*.56);
  applyVehicleGroundPose(v,steer,dt);

  if(name==='moto'){
    player.visible=true;
    player.position.copy(v.obj.position);
    player.rotation.copy(v.obj.rotation);
    updateCharacterAnimation(dt,{pilot:true});
  }
}

function updateCamera(dt){
  const target=activeTarget().position;
  const h=mode==='foot'?1.25:1.05,dist=mode==='foot'?5.2:7.5;
  const cp=Math.cos(camPitch),sp=Math.sin(camPitch);
  const desired=new THREE.Vector3(
    target.x+Math.sin(camYaw)*cp*dist,
    target.y+h+sp*dist,
    target.z+Math.cos(camYaw)*cp*dist
  );
  camera.position.lerp(desired,1-Math.exp(-8*dt));
  camera.lookAt(target.x,target.y+h,target.z);
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

let last=performance.now(),fpsFrames=0,fpsTime=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,.033);last=now;

  if(!$('start').classList.contains('hide')){
    renderer.render(scene,camera);profiler.frame(dt);return;
  }

  if(mode==='foot'){
    const state=walk(dt);
    updateCharacterAnimation(dt,state);
  }else{
    drive(dt,vehicles[mode],mode);
  }

  updateCamera(dt);
  renderer.render(scene,camera);
  profiler.frame(dt);

  fpsFrames++;fpsTime+=dt;
  if(fpsTime>=.5){
    $('fps').textContent=Math.round(fpsFrames/fpsTime);
    $('mode').textContent=mode==='foot'?'A PÉ':vehicles[mode].label;
    $('speed').textContent=mode==='foot'?'0':Math.round(Math.abs(vehicles[mode].speed)*3.6);
    fpsFrames=0;fpsTime=0;
  }
}

camera.position.set(0,4,8);requestAnimationFrame(frame);

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setPixelRatio(mobile?1:Math.min(devicePixelRatio||1,1.25));
  renderer.setSize(innerWidth,innerHeight);
});
