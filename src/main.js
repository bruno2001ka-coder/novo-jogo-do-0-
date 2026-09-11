import*as THREE from'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<900;
if(mobile)document.documentElement.classList.add('mobile');

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9fc2da);
scene.fog=new THREE.Fog(0x9fc2da,90,190);

const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,260);
const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'high-performance'});
renderer.setPixelRatio(mobile?1:Math.min(devicePixelRatio||1,1.25));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=false;
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xddeeff,0x506044,2.0));
const sun=new THREE.DirectionalLight(0xffffff,2.0);sun.position.set(35,55,20);scene.add(sun);

const ground=new THREE.Mesh(
  new THREE.PlaneGeometry(200,200,1,1),
  new THREE.MeshStandardMaterial({color:0x667d50,roughness:1,metalness:0})
);
ground.rotation.x=-Math.PI/2;ground.position.y=0;scene.add(ground);
const grid=new THREE.GridHelper(200,100,0x506246,0x596d4c);grid.position.y=.012;scene.add(grid);

const WORLD=96;
const clampWorld=p=>{p.x=THREE.MathUtils.clamp(p.x,-WORLD,WORLD);p.z=THREE.MathUtils.clamp(p.z,-WORLD,WORLD);p.y=Math.max(0,p.y)};

const RAW='https://raw.githubusercontent.com/bruno2001ka-coder/cloude-jogo-/main/assets/';
const URLS={personagem:RAW+'personagem.glb',moto:RAW+'moto.glb',carro:RAW+'carro.glb'};
const loader=new GLTFLoader();

function material(c){return new THREE.MeshStandardMaterial({color:c,roughness:.72,metalness:.12})}
function fallbackPerson(){
  const g=new THREE.Group(),skin=material(0xb97950),shirt=material(0x334f76),pants=material(0x202832);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.25,.72,4,8),shirt);body.position.y=1.05;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),skin);head.position.y=1.72;g.add(head);
  for(const s of[-1,1]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.6,3,6),pants);leg.position.set(s*.12,.42,0);g.add(leg)}
  return g;
}
function fallbackCar(){
  const g=new THREE.Group(),body=material(0x285c9b),dark=material(0x111315);
  const b=new THREE.Mesh(new THREE.BoxGeometry(1.75,.62,3.8),body);b.position.y=.62;g.add(b);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(1.55,.55,1.9),material(0x24333e));cab.position.set(0,1.14,.2);g.add(cab);
  for(const x of[-.82,.82])for(const z of[-1.25,1.25]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.22,12),dark);w.rotation.z=Math.PI/2;w.position.set(x,.34,z);g.add(w)}
  return g;
}
function fallbackMoto(){
  const g=new THREE.Group(),frame=material(0x22384f),dark=material(0x151515);
  const tank=new THREE.Mesh(new THREE.BoxGeometry(.55,.5,1.3),frame);tank.position.set(0,.82,0);g.add(tank);
  for(const z of[-.82,.82]){const w=new THREE.Mesh(new THREE.TorusGeometry(.38,.075,8,16),dark);w.rotation.y=Math.PI/2;w.position.set(0,.4,z);g.add(w)}
  const fork=new THREE.Mesh(new THREE.BoxGeometry(.12,.72,.12),dark);fork.position.set(0,.78,-.72);fork.rotation.x=-.18;g.add(fork);
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
function loadModel(url,fallback,opts){
  return new Promise(resolve=>{
    let done=false;
    const finish=o=>{if(done)return;done=true;resolve(normalize(o,opts))};
    const timer=setTimeout(()=>finish(fallback()),10000);
    loader.load(url,g=>{clearTimeout(timer);finish(g.scene)},undefined,()=>{clearTimeout(timer);finish(fallback())});
  });
}

const player=new THREE.Group(),bike=new THREE.Group(),car=new THREE.Group();
scene.add(player,bike,car);
player.position.set(0,0,3);bike.position.set(5,0,0);car.position.set(-7,0,0);

let modelCount=0;
Promise.all([
  loadModel(URLS.personagem,fallbackPerson,{height:1.75,modelYaw:0}).then(o=>{player.add(o);modelCount++;}),
  loadModel(URLS.moto,fallbackMoto,{length:2.25}).then(o=>{bike.add(o);modelCount++;}),
  loadModel(URLS.carro,fallbackCar,{length:4.2}).then(o=>{car.add(o);modelCount++;})
]).then(()=>{$('modelStatus').textContent='3/3 modelos prontos'});

const keys=Object.create(null);
let jumpRequest=false,velY=0,mode='foot',camYaw=0,camPitch=.25;
const joy={x:0,y:0},look={active:false,id:null,x:0,y:0};
const vehicles={
  moto:{obj:bike,speed:0,max:18,acc:15,brake:22,drag:4.2,steer:1.5,label:'MOTO'},
  car:{obj:car,speed:0,max:23,acc:11,brake:25,drag:3.2,steer:.82,label:'CARRO'}
};

addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='Space'){jumpRequest=true;e.preventDefault()}
  if(e.code==='KeyM')toggleVehicle('moto');
  if(e.code==='KeyV')toggleVehicle('car');
  if(e.code==='KeyE')toggleNearest();
  if(e.code==='KeyR')reset();
});
addEventListener('keyup',e=>{keys[e.code]=false});

renderer.domElement.addEventListener('click',()=>{if(!mobile&&document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.()});
addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==renderer.domElement)return;
  camYaw-=e.movementX*.0026;camPitch=THREE.MathUtils.clamp(camPitch-e.movementY*.0022,-.18,.75);
});

function vehicleDistance(v){return player.position.distanceTo(v.obj.position)}
function exitVehicle(){
  if(mode==='foot')return;
  const v=vehicles[mode],side=new THREE.Vector3(1.6,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),v.obj.rotation.y);
  player.position.copy(v.obj.position).add(side);player.position.y=0;player.visible=true;mode='foot';document.body.classList.remove('driving');
}
function toggleVehicle(name){
  if(mode===name){exitVehicle();return}
  if(mode!=='foot')return;
  const v=vehicles[name];if(vehicleDistance(v)>4.5)return;
  mode=name;document.body.classList.add('driving');
  player.visible=name==='moto';
}
function toggleNearest(){
  if(mode!=='foot'){exitVehicle();return}
  const dm=vehicleDistance(vehicles.moto),dc=vehicleDistance(vehicles.car);
  if(Math.min(dm,dc)>4.5)return;
  toggleVehicle(dm<dc?'moto':'car');
}
function reset(){
  if(mode==='foot'){player.position.set(0,0,3);velY=0}
  else{const v=vehicles[mode];v.obj.position.set(mode==='moto'?5:-7,0,0);v.obj.rotation.set(0,0,0);v.speed=0}
}

function walk(dt){
  const ix=(keys.KeyD?1:0)-(keys.KeyA?1:0)+joy.x;
  const iz=(keys.KeyW?1:0)-(keys.KeyS?1:0)-joy.y;
  const len=Math.hypot(ix,iz);
  if(len>.08){
    const nx=ix/Math.max(1,len),nz=iz/Math.max(1,len),run=keys.ShiftLeft||keys.ShiftRight||Math.hypot(joy.x,joy.y)>.86;
    const speed=run?7.2:4.4;
    const f=new THREE.Vector3(-Math.sin(camYaw),0,-Math.cos(camYaw));
    const r=new THREE.Vector3(Math.cos(camYaw),0,-Math.sin(camYaw));
    const move=f.multiplyScalar(nz).add(r.multiplyScalar(nx)).normalize();
    player.position.addScaledVector(move,speed*dt);
    player.rotation.y=Math.atan2(-move.x,-move.z);
  }
  if(jumpRequest&&player.position.y<=.001){velY=5.7}
  jumpRequest=false;velY-=15.5*dt;player.position.y+=velY*dt;
  if(player.position.y<0){player.position.y=0;velY=0}
  clampWorld(player.position);
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
  v.obj.rotation.y+=steer*v.steer*turnScale*dt*Math.sign(v.speed||1);
  const f=new THREE.Vector3(-Math.sin(v.obj.rotation.y),0,-Math.cos(v.obj.rotation.y));
  v.obj.position.addScaledVector(f,v.speed*dt);v.obj.position.y=0;clampWorld(v.obj.position);
  if(name==='moto'){
    player.visible=true;
    player.position.copy(v.obj.position);player.position.y=.62;player.rotation.y=v.obj.rotation.y;
  }
}
function updateCamera(dt){
  const target=mode==='foot'?player.position:vehicles[mode].obj.position;
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
  z.addEventListener('pointermove',e=>{if(!look.active||e.pointerId!==look.id)return;const dx=e.clientX-look.x,dy=e.clientY-look.y;look.x=e.clientX;look.y=e.clientY;camYaw-=dx*.006;camPitch=THREE.MathUtils.clamp(camPitch-dy*.005,-.18,.75)});
  const end=e=>{if(e.pointerId===look.id)look.active=false};
  z.addEventListener('pointerup',end);z.addEventListener('pointercancel',end);
}
bindJoystick();bindLook();
$('motoBtn').addEventListener('pointerdown',e=>{e.preventDefault();toggleVehicle('moto')});
$('carBtn').addEventListener('pointerdown',e=>{e.preventDefault();toggleVehicle('car')});
$('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();jumpRequest=true});

$('playBtn').addEventListener('click',()=>{$('start').classList.add('hide');renderer.domElement.focus();if(!mobile)renderer.domElement.requestPointerLock?.()});

let last=performance.now(),fpsFrames=0,fpsTime=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,.033);last=now;
  if(!$('start').classList.contains('hide')){renderer.render(scene,camera);return}
  if(mode==='foot')walk(dt);else drive(dt,vehicles[mode],mode);
  updateCamera(dt);
  renderer.render(scene,camera);
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
