import*as THREE from'three';

const LIMIT=96;
const RAMP={x0:-3.2,x1:3.2,z0:-44,z1:-22,h:1.5};
const BUMP={x0:-3.2,x1:3.2,z0:-12,z1:-8,h:.22};
const SIDEWALK={x0:5,x1:9,z0:-14,z1:8,h:.16};
const STAIRS={x0:5,x1:9,z0:-24,z1:-14,step:.16};

function inRect(x,z,r){return x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1}
function mat(color,roughness=.95){return new THREE.MeshStandardMaterial({color,roughness,metalness:0})}

export function criarCampoDeProvas(scene,{debug=false}={}){
  const group=new THREE.Group();
  group.name='campoDeProvas';
  scene.add(group);

  const groundMat=mat(0x6f8656);
  const roadMat=mat(0x30343a,.92);
  const concreteMat=mat(0x9a9b93,.9);
  const rampMat=mat(0x5b5e62,.88);
  const wallMat=mat(0x8b7767,.9);

  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200,1,1),groundMat);
  ground.rotation.x=-Math.PI/2;
  ground.position.y=0;
  group.add(ground);

  const road=new THREE.Mesh(new THREE.BoxGeometry(20,.06,112),roadMat);
  road.position.set(0,.03,-30);
  group.add(road);

  // Faixas de pista: poucas malhas e geometria simples.
  for(const x of[-9.7,9.7]){
    const curb=new THREE.Mesh(new THREE.BoxGeometry(.35,.18,112),concreteMat);
    curb.position.set(x,.09,-30);group.add(curb);
  }

  // Lombada suave no centro da pista.
  {
    const segX=8,segZ=14;
    const pos=[],idx=[];
    for(let iz=0;iz<=segZ;iz++){
      const tz=iz/segZ,z=THREE.MathUtils.lerp(BUMP.z0,BUMP.z1,tz);
      const y=Math.sin(Math.PI*tz)*BUMP.h;
      for(let ix=0;ix<=segX;ix++){
        const tx=ix/segX,x=THREE.MathUtils.lerp(BUMP.x0,BUMP.x1,tx);
        pos.push(x,y+.01,z);
      }
    }
    const row=segX+1;
    for(let iz=0;iz<segZ;iz++)for(let ix=0;ix<segX;ix++){
      const a=iz*row+ix,b=a+1,c=a+row,d=c+1;
      idx.push(a,c,b,b,c,d);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setIndex(idx);g.computeVertexNormals();
    group.add(new THREE.Mesh(g,rampMat));
  }

  function slope(zA,zB,yA,yB){
    const x0=RAMP.x0,x1=RAMP.x1;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([
      x0,yA,zA,x1,yA,zA,x0,yB,zB,x1,yB,zB
    ],3));
    g.setIndex([0,1,2,1,3,2]);g.computeVertexNormals();
    const m=new THREE.Mesh(g,rampMat);group.add(m);return m;
  }
  slope(-22,-30,0,1.5);
  const platform=new THREE.Mesh(new THREE.BoxGeometry(6.4,.12,6),rampMat);
  platform.position.set(0,1.44,-33);group.add(platform);
  slope(-36,-44,1.5,0);

  // Calçada e três degraus de teste.
  const sidewalk=new THREE.Mesh(new THREE.BoxGeometry(4,.16,22),concreteMat);
  sidewalk.position.set(7,.08,-3);group.add(sidewalk);
  const stairSpecs=[
    {z:-15.5,h:.16,d:3},
    {z:-18.5,h:.32,d:3},
    {z:-21.5,h:.48,d:3},
  ];
  for(const s of stairSpecs){
    const step=new THREE.Mesh(new THREE.BoxGeometry(4,s.h,s.d),concreteMat);
    step.position.set(7,s.h/2,s.z);group.add(step);
  }

  // Garagem de colisão real: frente aberta.
  const colliders=[];
  function wall(cx,cz,w,d,h=2.6,label='parede'){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wallMat);
    mesh.position.set(cx,h/2,cz);group.add(mesh);
    colliders.push({x0:cx-w/2,x1:cx+w/2,y0:0,y1:h,z0:cz-d/2,z1:cz+d/2,label});
    return mesh;
  }
  wall(-10,-58,.35,15,2.7,'garagem-esquerda');
  wall(-4,-58,.35,15,2.7,'garagem-direita');
  wall(-7,-65.3,6.35,.35,2.7,'garagem-fundo');

  // Parede isolada para teste de impacto/slide.
  wall(7,-48,8,.4,2.3,'parede-impacto');

  // Cones em InstancedMesh: uma geometria/material para todo o slalom.
  const coneGeo=new THREE.ConeGeometry(.22,.7,10);
  const coneMat=mat(0xe67e22,.8);
  const cones=new THREE.InstancedMesh(coneGeo,coneMat,10);
  const dummy=new THREE.Object3D();
  for(let i=0;i<10;i++){
    dummy.position.set(i%2===0?-2.4:2.4,.35,16-i*3.1);
    dummy.rotation.y=(i%2)*.25;dummy.updateMatrix();
    cones.setMatrixAt(i,dummy.matrix);
  }
  cones.instanceMatrix.needsUpdate=true;group.add(cones);

  if(debug){
    const grid=new THREE.GridHelper(200,100,0x4b5a43,0x56634d);
    grid.position.y=.015;group.add(grid);
  }

  function groundHeight(x,z){
    let h=0;

    if(inRect(x,z,BUMP)){
      const t=THREE.MathUtils.clamp((z-BUMP.z0)/(BUMP.z1-BUMP.z0),0,1);
      h=Math.max(h,Math.sin(Math.PI*t)*BUMP.h);
    }

    if(x>=RAMP.x0&&x<=RAMP.x1){
      if(z<=-22&&z>=-30)h=Math.max(h,(-22-z)/8*RAMP.h);
      else if(z<-30&&z>=-36)h=Math.max(h,RAMP.h);
      else if(z<-36&&z>=-44)h=Math.max(h,(z+44)/8*RAMP.h);
    }

    if(inRect(x,z,SIDEWALK))h=Math.max(h,SIDEWALK.h);

    if(x>=STAIRS.x0&&x<=STAIRS.x1&&z<=STAIRS.z1&&z>=STAIRS.z0){
      if(z>=-17)h=Math.max(h,.16);
      else if(z>=-20)h=Math.max(h,.32);
      else if(z>=-23)h=Math.max(h,.48);
    }
    return h;
  }

  function blocked(x,z,radius){
    if(x-radius<-LIMIT||x+radius>LIMIT||z-radius<-LIMIT||z+radius>LIMIT)return true;
    for(const c of colliders){
      if(x+radius>c.x0&&x-radius<c.x1&&z+radius>c.z0&&z-radius<c.z1)return true;
    }
    return false;
  }

  // SAT 2D: caixa orientada do veículo contra as paredes AABB do campo.
  // O carro deixa de ser tratado como um círculo no centro; comprimento, largura e yaw entram na conta.
  function obbIntersectsAABB(x,z,yaw,halfLength,halfWidth,a){
    const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
    const rx=Math.cos(yaw),rz=-Math.sin(yaw);
    const acx=(a.x0+a.x1)/2,acz=(a.z0+a.z1)/2;
    const ahx=(a.x1-a.x0)/2,ahz=(a.z1-a.z0)/2;
    const tx=acx-x,tz=acz-z;

    if(Math.abs(tx*fx+tz*fz)>halfLength+ahx*Math.abs(fx)+ahz*Math.abs(fz))return false;
    if(Math.abs(tx*rx+tz*rz)>halfWidth +ahx*Math.abs(rx)+ahz*Math.abs(rz))return false;
    if(Math.abs(tx)>ahx+halfLength*Math.abs(fx)+halfWidth*Math.abs(rx))return false;
    if(Math.abs(tz)>ahz+halfLength*Math.abs(fz)+halfWidth*Math.abs(rz))return false;
    return true;
  }

  function blockedOBB(x,z,yaw,halfLength,halfWidth){
    const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
    const rx=Math.cos(yaw),rz=-Math.sin(yaw);
    const extentX=Math.abs(fx)*halfLength+Math.abs(rx)*halfWidth;
    const extentZ=Math.abs(fz)*halfLength+Math.abs(rz)*halfWidth;
    if(x-extentX<-LIMIT||x+extentX>LIMIT||z-extentZ<-LIMIT||z+extentZ>LIMIT)return true;
    for(const a of colliders)if(obbIntersectsAABB(x,z,yaw,halfLength,halfWidth,a))return true;
    return false;
  }

  function vehicleContacts(x,z,yaw,halfLength,halfWidth,twoWheel=false){
    const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
    if(twoWheel){
      return[
        groundHeight(x+fx*halfLength,z+fz*halfLength),
        groundHeight(x-fx*halfLength,z-fz*halfLength)
      ];
    }
    const rx=Math.cos(yaw),rz=-Math.sin(yaw);
    return[
      groundHeight(x+fx*halfLength+rx*halfWidth,z+fz*halfLength+rz*halfWidth),
      groundHeight(x+fx*halfLength-rx*halfWidth,z+fz*halfLength-rz*halfWidth),
      groundHeight(x-fx*halfLength+rx*halfWidth,z-fz*halfLength+rz*halfWidth),
      groundHeight(x-fx*halfLength-rx*halfWidth,z-fz*halfLength-rz*halfWidth)
    ];
  }

  function vehicleHeight(x,z,yaw,halfLength,halfWidth,twoWheel=false){
    const contacts=vehicleContacts(x,z,yaw,halfLength,halfWidth,twoWheel);
    return contacts.reduce((a,b)=>a+b,0)/contacts.length;
  }

  function canVehicleStep(fromX,fromZ,toX,toZ,yaw,halfLength,halfWidth,maxStep,twoWheel){
    const before=vehicleContacts(fromX,fromZ,yaw,halfLength,halfWidth,twoWheel);
    const after=vehicleContacts(toX,toZ,yaw,halfLength,halfWidth,twoWheel);
    for(let i=0;i<before.length;i++){
      if(Math.abs(after[i]-before[i])>maxStep+.001)return false;
    }
    return true;
  }

  function canStep(fromX,fromZ,toX,toZ,maxStep){
    return Math.abs(groundHeight(toX,toZ)-groundHeight(fromX,fromZ))<=maxStep+.001;
  }

  // Movimento com slide simples: tenta XY completo, depois cada eixo separadamente.
  function moveXZ(position,dx,dz,radius=.35,maxStep=.3){
    const ox=position.x,oz=position.z;
    const nx=ox+dx,nz=oz+dz;
    if(!blocked(nx,nz,radius)&&canStep(ox,oz,nx,nz,maxStep)){
      position.x=nx;position.z=nz;
      return{x:dx,z:dz,blocked:false};
    }
    let movedX=0,movedZ=0;
    const xOnly=ox+dx;
    if(!blocked(xOnly,oz,radius)&&canStep(ox,oz,xOnly,oz,maxStep)){
      position.x=xOnly;movedX=dx;
    }
    const baseX=position.x;
    const zOnly=oz+dz;
    if(!blocked(baseX,zOnly,radius)&&canStep(baseX,oz,baseX,zOnly,maxStep)){
      position.z=zOnly;movedZ=dz;
    }
    return{x:movedX,z:movedZ,blocked:Math.abs(movedX-dx)>.001||Math.abs(movedZ-dz)>.001};
  }

  // Varredura curta por subpassos para o veículo não atravessar uma parede em um frame rápido.
  function moveVehicle(position,yaw,dx,dz,halfLength,halfWidth,maxStep=.25,twoWheel=false){
    const total=Math.hypot(dx,dz);
    const steps=Math.max(1,Math.ceil(total/.16));
    const sx=dx/steps,sz=dz/steps;
    let movedX=0,movedZ=0,hit=false;

    for(let i=0;i<steps;i++){
      const ox=position.x,oz=position.z;
      const nx=ox+sx,nz=oz+sz;

      if(!blockedOBB(nx,nz,yaw,halfLength,halfWidth)&&
         canVehicleStep(ox,oz,nx,nz,yaw,halfLength,halfWidth,maxStep,twoWheel)){
        position.x=nx;position.z=nz;movedX+=sx;movedZ+=sz;continue;
      }

      let localX=0,localZ=0;
      if(!blockedOBB(nx,oz,yaw,halfLength,halfWidth)&&
         canVehicleStep(ox,oz,nx,oz,yaw,halfLength,halfWidth,maxStep,twoWheel)){
        position.x=nx;localX=sx;
      }
      const baseX=position.x;
      if(!blockedOBB(baseX,nz,yaw,halfLength,halfWidth)&&
         canVehicleStep(baseX,oz,baseX,nz,yaw,halfLength,halfWidth,maxStep,twoWheel)){
        position.z=nz;localZ=sz;
      }

      movedX+=localX;movedZ+=localZ;
      if(Math.abs(localX-sx)>.0001||Math.abs(localZ-sz)>.0001)hit=true;
      if(localX===0&&localZ===0)break;
    }

    return{x:movedX,z:movedZ,blocked:hit};
  }

  function zoneAt(x,z){
    if(x>=-11&&x<=-3&&z<=-49&&z>=-67)return'GARAGEM';
    if(x>=3&&x<=11&&z<=-45&&z>=-51)return'IMPACTO / PAREDE';
    if(x>=RAMP.x0&&x<=RAMP.x1&&z<=-22&&z>=-44)return'RAMPA / PLATAFORMA';
    if(inRect(x,z,BUMP))return'LOMBADA';
    if(x>=STAIRS.x0&&x<=STAIRS.x1&&z<=-14&&z>=-24)return'DEGRAUS';
    if(inRect(x,z,SIDEWALK))return'CALÇADA';
    if(z<=18&&z>=-14&&Math.abs(x)<=4)return'SLALOM';
    return'RETA / BASE';
  }

  function terrainPose(x,z,yaw,halfLength,halfWidth){
    const fX=-Math.sin(yaw),fZ=-Math.cos(yaw);
    const rX=Math.cos(yaw),rZ=-Math.sin(yaw);
    const hF=groundHeight(x+fX*halfLength,z+fZ*halfLength);
    const hB=groundHeight(x-fX*halfLength,z-fZ*halfLength);
    const hR=groundHeight(x+rX*halfWidth,z+rZ*halfWidth);
    const hL=groundHeight(x-rX*halfWidth,z-rZ*halfWidth);
    return{
      y:(hF+hB+hR+hL)/4,
      pitch:Math.atan2(hF-hB,Math.max(.01,halfLength*2)),
      roll:Math.atan2(hR-hL,Math.max(.01,halfWidth*2)),
    };
  }

  // Moto: dois contatos reais, um em cada roda. Não usa quatro cantos como um carro.
  function twoWheelPose(x,z,yaw,halfLength){
    const fX=-Math.sin(yaw),fZ=-Math.cos(yaw);
    const hF=groundHeight(x+fX*halfLength,z+fZ*halfLength);
    const hB=groundHeight(x-fX*halfLength,z-fZ*halfLength);
    return{
      y:(hF+hB)/2,
      pitch:Math.atan2(hF-hB,Math.max(.01,halfLength*2)),
      roll:0,
    };
  }

  // Evita que uma parede fique entre a câmera e o alvo.
  function cameraSafePosition(start,end,padding=.25){
    const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
    let best=1;

    for(const a of colliders){
      const min={x:a.x0-padding,y:(a.y0??0)-padding,z:a.z0-padding};
      const max={x:a.x1+padding,y:(a.y1??3)+padding,z:a.z1+padding};
      let t0=0,t1=1,valid=true;

      for(const axis of['x','y','z']){
        const s=start[axis],d=axis==='x'?dx:axis==='y'?dy:dz;
        if(Math.abs(d)<1e-7){
          if(s<min[axis]||s>max[axis]){valid=false;break}
          continue;
        }
        let ta=(min[axis]-s)/d,tb=(max[axis]-s)/d;
        if(ta>tb){const q=ta;ta=tb;tb=q}
        t0=Math.max(t0,ta);t1=Math.min(t1,tb);
        if(t0>t1){valid=false;break}
      }
      if(valid&&t0>=0&&t0<best)best=t0;
    }

    if(best>=1)return end.clone();
    const len=Math.hypot(dx,dy,dz)||1;
    const t=Math.max(.08,best-padding/len);
    return new THREE.Vector3(start.x+dx*t,start.y+dy*t,start.z+dz*t);
  }

  return{
    group,colliders,groundHeight,moveXZ,moveVehicle,zoneAt,
    terrainPose,twoWheelPose,cameraSafePosition,vehicleBlocked:blockedOBB,limit:LIMIT
  };
}
