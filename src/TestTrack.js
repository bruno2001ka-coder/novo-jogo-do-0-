import*as THREE from'three';

const LIMIT=96;
const RAMP={x0:-3.2,x1:3.2,z0:-44,z1:-22,h:1.5};
const BUMP={x0:-3.2,x1:3.2,z0:-12,z1:-8,h:.22};
const SIDEWALK={x0:5,x1:9,z0:-14,z1:8,h:.16};
const STAIRS={x0:5,x1:9,z0:-24,z1:-14,step:.16};

// Áreas físicas reservadas para construção. Elas ficam fora da pista de testes e
// groundHeight() garante que permaneçam planas mesmo quando o terreno crescer.
const FLAT_AREAS=Object.freeze([
  Object.freeze({id:'casa',label:'ÁREA PLANA CASA',x0:-44,x1:-22,z0:24,z1:46,y:0}),
  Object.freeze({id:'fazenda',label:'ÁREA PLANA FAZENDA',x0:22,x1:48,z0:24,z1:52,y:0}),
  Object.freeze({id:'expansao',label:'ÁREA PLANA EXPANSÃO',x0:24,x1:50,z0:-52,z1:-26,y:0}),
]);

function inRect(x,z,r){return x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1}
function flatAreaAt(x,z){return FLAT_AREAS.find(a=>inRect(x,z,a))||null}
function mat(color,roughness=.95){return new THREE.MeshStandardMaterial({color,roughness,metalness:0})}

export function criarCampoDeProvas(scene,{debug=false}={}){
  const group=new THREE.Group();
  group.name='campoDeProvas';
  scene.add(group);

  const groundMat=mat(0x667d50);
  const roadMat=mat(0x30343a,.92);
  const concreteMat=mat(0x9a9b93,.9);
  const rampMat=mat(0x5b5e62,.88);
  const wallMat=mat(0x8b7767,.9);
  const houseMat=mat(0xf2f0e8,.9);
  const trimMat=mat(0xd8d3c7,.92);
  const roofMat=mat(0x7a4d35,.88);
  const woodMat=mat(0x68472e,.9);
  const pathMat=mat(0x817a70,.96);
  const interiorFloorMat=mat(0xa9825d,.88);
  const bathroomFloorMat=mat(0xc8c5bc,.84);
  const fabricMat=mat(0x4d514f,.96);
  const mattressMat=mat(0xe7e0d4,.95);
  const counterMat=mat(0x756b61,.88);
  const metalMat=mat(0x9ba0a2,.72);
  const yardConcreteMat=mat(0xa6a49d,.93);
  const soilMat=mat(0x6b4b32,.98);
  const glassMat=new THREE.MeshStandardMaterial({
    color:0x263238,roughness:.28,metalness:.05,
    transparent:true,opacity:.72
  });

  // Registro único de colisores físicos. O visual pode mudar sem alterar a física.
  const colliders=[];
  let nextColliderId=1;
  const colliderDebug=new Map();
  const debugColliderGroup=new THREE.Group();
  debugColliderGroup.name='debugColliders';
  if(debug)group.add(debugColliderGroup);

  function addBoxCollider({cx,cz,w,d,h=2.6,y0=0,label='colisor',owner='world'}){
    const collider={
      id:`col-${nextColliderId++}`,
      x0:cx-w/2,x1:cx+w/2,
      y0,y1:y0+h,
      z0:cz-d/2,z1:cz+d/2,
      label,owner
    };
    colliders.push(collider);

    if(debug){
      const box=new THREE.Box3(
        new THREE.Vector3(collider.x0,collider.y0,collider.z0),
        new THREE.Vector3(collider.x1,collider.y1,collider.z1)
      );
      const helper=new THREE.Box3Helper(box,0xff5533);
      helper.name=`debug-${collider.id}-${label}`;
      debugColliderGroup.add(helper);
      colliderDebug.set(collider.id,helper);
    }
    return collider;
  }

  function removeCollider(idOrCollider){
    const id=typeof idOrCollider==='string'?idOrCollider:idOrCollider?.id;
    const index=colliders.findIndex(c=>c.id===id);
    if(index<0)return false;
    colliders.splice(index,1);
    const helper=colliderDebug.get(id);
    if(helper){
      helper.removeFromParent();
      helper.geometry?.dispose?.();
      helper.material?.dispose?.();
      colliderDebug.delete(id);
    }
    return true;
  }

  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200,1,1),groundMat);
  ground.rotation.x=-Math.PI/2;
  ground.position.y=0;
  group.add(ground);

  // Piso quadriculado original da base limpa: sempre visível, não apenas em ?debug=1.
  const baseGrid=new THREE.GridHelper(200,100,0x506246,0x596d4c);
  baseGrid.position.y=.012;
  group.add(baseGrid);

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
  function wall(cx,cz,w,d,h=2.6,label='parede'){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wallMat);
    mesh.position.set(cx,h/2,cz);group.add(mesh);
    const collider=addBoxCollider({cx,cz,w,d,h,label,owner:'test-track'});
    mesh.userData.colliderId=collider.id;
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

  // ---------------------------------------------------------------------------
  // PRIMEIRA ÁREA REAL DO MUNDO: CASA RESIDENCIAL + ACESSO + MUROS
  // Casa finalizada como residência; física estrutural continua simples e separada.
  // ---------------------------------------------------------------------------
  const houseGroup=new THREE.Group();
  houseGroup.name='areaCasa';
  group.add(houseGroup);

  function houseSolid(cx,cz,w,d,h,label){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),houseMat);
    mesh.position.set(cx,h/2,cz);
    houseGroup.add(mesh);
    const collider=addBoxCollider({cx,cz,w,d,h,label,owner:'casa'});
    mesh.userData.colliderId=collider.id;
    return mesh;
  }

  function houseDetailBox(w,h,d,x,y,z,material=trimMat,name='detalheCasa'){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);
    mesh.name=name;
    houseGroup.add(mesh);
    return mesh;
  }

  // Acesso residencial: liga a pista diretamente à entrada lateral aberta do lote.
  const driveway=new THREE.Mesh(
    new THREE.BoxGeometry(13.4,.045,4.8),
    pathMat
  );
  driveway.position.set(-15.55,.0225,26.35);
  driveway.name='acessoCasa';
  houseGroup.add(driveway);

  const HOUSE={
    cx:-35,cz:36,w:13,d:9.5,h:2.8,t:.28,
    doorW:1.6,doorH:2.25
  };
  const hx0=HOUSE.cx-HOUSE.w/2,hx1=HOUSE.cx+HOUSE.w/2;
  const hz0=HOUSE.cz-HOUSE.d/2,hz1=HOUSE.cz+HOUSE.d/2;

  // Alvenaria branca em reboco/gesso, preservando a planta e os colisores.
  houseSolid(hx0,HOUSE.cz,HOUSE.t,HOUSE.d,HOUSE.h,'casa-oeste');
  houseSolid(hx1,HOUSE.cz,HOUSE.t,HOUSE.d,HOUSE.h,'casa-leste');
  houseSolid(HOUSE.cx,hz1,HOUSE.w,HOUSE.t,HOUSE.h,'casa-fundo');

  const frontLeftW=(HOUSE.w-HOUSE.doorW)/2;
  const frontRightW=frontLeftW;
  houseSolid(
    hx0+frontLeftW/2,hz0,frontLeftW,HOUSE.t,HOUSE.h,
    'casa-frente-esquerda'
  );
  houseSolid(
    hx1-frontRightW/2,hz0,frontRightW,HOUSE.t,HOUSE.h,
    'casa-frente-direita'
  );

  // Fecha visualmente a parede acima da porta sem bloquear o vão no colisor 2D.
  houseDetailBox(
    HOUSE.doorW+.18,
    HOUSE.h-HOUSE.doorH,
    HOUSE.t,
    HOUSE.cx,
    HOUSE.doorH+(HOUSE.h-HOUSE.doorH)/2,
    hz0,
    houseMat,
    'vergaPorta'
  );

  const floorMesh=new THREE.Mesh(
    new THREE.PlaneGeometry(HOUSE.w-.35,HOUSE.d-.35),
    concreteMat
  );
  floorMesh.rotation.x=-Math.PI/2;
  floorMesh.position.set(HOUSE.cx,.018,HOUSE.cz);
  floorMesh.name='pisoCasa';
  houseGroup.add(floorMesh);

  // Forro interno contínuo: fecha completamente a casa na altura das paredes.
  const ceilingMat=houseMat.clone();
  ceilingMat.side=THREE.DoubleSide;
  const ceiling=new THREE.Mesh(
    new THREE.BoxGeometry(HOUSE.w-.34,.12,HOUSE.d-.34),
    ceilingMat
  );
  ceiling.position.set(HOUSE.cx,HOUSE.h-.06,HOUSE.cz);
  ceiling.name='forroInterno';
  houseGroup.add(ceiling);

  // Luminárias físicas visíveis, uma por zona principal, sem sombras dinâmicas.
  const lampBaseMat=mat(0x5a5148,.72);
  const lampGlowMat=new THREE.MeshStandardMaterial({
    color:0xffe1aa,
    emissive:0xffb15a,
    emissiveIntensity:2.4,
    roughness:.34,
    metalness:.02
  });

  function addCeilingLamp(x,z,name,intensity=9,distance=6.5){
    const base=new THREE.Mesh(
      new THREE.CylinderGeometry(.20,.20,.07,14),
      lampBaseMat
    );
    base.position.set(x,HOUSE.h-.15,z);
    base.name=`baseLuminaria-${name}`;
    houseGroup.add(base);

    const stem=new THREE.Mesh(
      new THREE.CylinderGeometry(.03,.03,.16,8),
      woodMat
    );
    stem.position.set(x,HOUSE.h-.26,z);
    stem.name=`hasteLuminaria-${name}`;
    houseGroup.add(stem);

    const bulb=new THREE.Mesh(
      new THREE.SphereGeometry(.12,14,9),
      lampGlowMat
    );
    bulb.position.set(x,HOUSE.h-.39,z);
    bulb.name=`lampadaVisivel-${name}`;
    houseGroup.add(bulb);

    const light=new THREE.PointLight(0xffd7a3,intensity,distance,2);
    light.position.copy(bulb.position);
    light.name=`luzInterna-${name}`;
    houseGroup.add(light);
  }

  addCeilingLamp(HOUSE.cx-.4,34.1,'sala-cozinha',12,8.5);
  addCeilingLamp(-38.7,38.7,'quarto',8.5,5.5);
  addCeilingLamp(-30.2,39.1,'banheiro',7.5,4.8);

  // Rodapé externo levemente saliente para quebrar o aspecto de caixa lisa.
  houseDetailBox(HOUSE.w+.12,.18,.10,HOUSE.cx,.09,hz0-.18,trimMat,'rodapeFrontal');
  houseDetailBox(.10,.18,HOUSE.d+.12,hx0-.18,.09,HOUSE.cz,trimMat,'rodapeOeste');
  houseDetailBox(.10,.18,HOUSE.d+.12,hx1+.18,.09,HOUSE.cz,trimMat,'rodapeLeste');

  // TELHADO COLONIAL DE DUAS ÁGUAS.
  // Cumeeira no sentido frente-fundo (eixo Z); águas descem para as laterais X.
  // Essa orientação corresponde à implantação visual mostrada na fachada.
  const roofAngle=THREE.MathUtils.degToRad(22);
  const roofOverhang=.50;
  const roofSpanX=HOUSE.w+roofOverhang*2;
  const roofHalfRun=roofSpanX/2;
  const roofRise=Math.tan(roofAngle)*roofHalfRun;
  const roofSlopeLength=roofHalfRun/Math.cos(roofAngle);
  const roofThickness=.22;
  const roofDepth=HOUSE.d+roofOverhang*2;
  const roofCenterY=HOUSE.h+roofRise/2;

  // Água esquerda.
  const leftRoof=new THREE.Mesh(
    new THREE.BoxGeometry(
      roofSlopeLength,
      roofThickness,
      roofDepth
    ),
    roofMat
  );
  leftRoof.position.set(
    HOUSE.cx-roofHalfRun/2,
    roofCenterY,
    HOUSE.cz
  );
  leftRoof.rotation.z=roofAngle;
  leftRoof.name='telhadoAguaEsquerda';
  houseGroup.add(leftRoof);

  // Água direita.
  const rightRoof=new THREE.Mesh(
    new THREE.BoxGeometry(
      roofSlopeLength,
      roofThickness,
      roofDepth
    ),
    roofMat
  );
  rightRoof.position.set(
    HOUSE.cx+roofHalfRun/2,
    roofCenterY,
    HOUSE.cz
  );
  rightRoof.rotation.z=-roofAngle;
  rightRoof.name='telhadoAguaDireita';
  houseGroup.add(rightRoof);

  // Fileiras discretas acompanham o novo sentido das águas.
  for(let i=1;i<=9;i++){
    const t=i/10;
    const y=HOUSE.h+roofRise*(1-t)+.13;

    const leftRow=houseDetailBox(
      .11,.045,roofDepth+.04,
      HOUSE.cx-roofHalfRun*t,y,HOUSE.cz,
      roofMat,`telhaEsquerda-${i}`
    );
    leftRow.rotation.z=roofAngle;

    const rightRow=houseDetailBox(
      .11,.045,roofDepth+.04,
      HOUSE.cx+roofHalfRun*t,y,HOUSE.cz,
      roofMat,`telhaDireita-${i}`
    );
    rightRow.rotation.z=-roofAngle;
  }

  // Cumeeira agora corre no eixo Z (frente-fundo).
  houseDetailBox(
    .26,.20,roofDepth+.16,
    HOUSE.cx,HOUSE.h+roofRise+.04,HOUSE.cz,
    roofMat,'cumeeiraTelhado'
  );

  // Oitões pertencem às extremidades da cumeeira: frente e fundo.
  // Como a cumeeira corre no eixo Z, NÃO podem ficar nas laterais X.
  const gableMat=houseMat.clone();
  gableMat.side=THREE.DoubleSide;

  function addFrontBackGable(z,name){
    const shape=new THREE.Shape();
    shape.moveTo(-HOUSE.w/2,0);
    shape.lineTo(HOUSE.w/2,0);
    shape.lineTo(0,roofRise+.02);
    shape.closePath();

    const geometry=new THREE.ExtrudeGeometry(shape,{
      depth:.24,
      bevelEnabled:false,
      steps:1,
      curveSegments:1
    });
    geometry.computeVertexNormals();

    const mesh=new THREE.Mesh(geometry,gableMat);
    mesh.position.set(
      HOUSE.cx,
      HOUSE.h,
      z-.12
    );
    mesh.name=name;
    houseGroup.add(mesh);
  }

  addFrontBackGable(hz0,'oitaoFrontal');
  addFrontBackGable(hz1,'oitaoTraseiro');

  // VARANDA FRONTAL RÚSTICA.
  const verandaDepth=2.45;

  const verandaFloor=new THREE.Mesh(
    new THREE.BoxGeometry(HOUSE.w+.35,.10,verandaDepth+.10),
    concreteMat
  );
  verandaFloor.position.set(
    HOUSE.cx,
    .05,
    hz0-verandaDepth/2+.02
  );
  verandaFloor.name='pisoVaranda';
  houseGroup.add(verandaFloor);

  const verandaRoof=new THREE.Mesh(
    new THREE.BoxGeometry(HOUSE.w+.45,.16,verandaDepth+.28),
    roofMat
  );
  verandaRoof.position.set(HOUSE.cx,2.60,hz0-verandaDepth/2+.05);
  verandaRoof.rotation.x=THREE.MathUtils.degToRad(-8);
  verandaRoof.name='coberturaVaranda';
  houseGroup.add(verandaRoof);

  // Viga frontal de madeira sob o beiral da varanda.
  houseDetailBox(
    HOUSE.w+.1,.18,.18,
    HOUSE.cx,2.34,hz0-verandaDepth+.02,
    woodMat,'vigaVaranda'
  );

  const verandaPostZ=hz0-verandaDepth+.02;
  for(const x of[HOUSE.cx-5.7,HOUSE.cx-2.25,HOUSE.cx+2.25,HOUSE.cx+5.7]){
    const post=houseDetailBox(.20,2.35,.20,x,1.175,verandaPostZ,woodMat,'mouraoVaranda');
    const collider=addBoxCollider({
      cx:x,cz:verandaPostZ,w:.22,d:.22,h:2.35,
      label:'mourao-varanda',owner:'casa'
    });
    post.userData.colliderId=collider.id;
  }

  // Pequena soleira e caminho de pedestre até a porta.
  houseDetailBox(2.0,.10,.52,HOUSE.cx,.05,hz0-.38,concreteMat,'soleiraPorta');
  const footPath=new THREE.Mesh(new THREE.BoxGeometry(2.2,.035,4.1),pathMat);
  footPath.position.set(HOUSE.cx,.0175,29.2);
  footPath.name='caminhoPortaCasa';
  houseGroup.add(footPath);

  // PORTA PRINCIPAL FUNCIONAL COM BATENTE.
  const doorLeft=HOUSE.cx-HOUSE.doorW/2;
  const doorPivot=new THREE.Group();
  doorPivot.name='portaPrincipalPivot';
  doorPivot.position.set(doorLeft,0,hz0-.16);
  houseGroup.add(doorPivot);

  const doorLeaf=new THREE.Mesh(
    new THREE.BoxGeometry(HOUSE.doorW-.08,HOUSE.doorH-.08,.10),
    woodMat
  );
  doorLeaf.position.set((HOUSE.doorW-.08)/2,HOUSE.doorH/2,0);
  doorLeaf.name='portaPrincipalFolha';
  doorPivot.add(doorLeaf);

  // Travessas decorativas da folha.
  for(const y of[.42,1.12,1.82]){
    const rail=new THREE.Mesh(
      new THREE.BoxGeometry(HOUSE.doorW-.20,.09,.035),
      trimMat
    );
    rail.position.set((HOUSE.doorW-.08)/2,y,-.068);
    doorPivot.add(rail);
  }

  // Batente completo, mantendo livre a faixa central da passagem.
  houseDetailBox(.12,HOUSE.doorH+.16,.16,doorLeft-.06,(HOUSE.doorH+.16)/2,hz0-.17,woodMat,'batentePortaE');
  houseDetailBox(.12,HOUSE.doorH+.16,.16,doorLeft+HOUSE.doorW+.06,(HOUSE.doorH+.16)/2,hz0-.17,woodMat,'batentePortaD');
  houseDetailBox(HOUSE.doorW+.24,.12,.16,HOUSE.cx,HOUSE.doorH+.08,hz0-.17,woodMat,'batentePortaTopo');

  let doorCollider=addBoxCollider({
    cx:HOUSE.cx,cz:hz0,
    w:HOUSE.doorW,d:.18,h:HOUSE.doorH,
    label:'porta-principal-fechada',owner:'casa'
  });
  const doorState={angle:0,target:0};

  function updateDoor(dt,targetPosition){
    if(!targetPosition)return;
    const distance=Math.hypot(
      targetPosition.x-HOUSE.cx,
      targetPosition.z-hz0
    );

    if(distance<2.5)doorState.target=-Math.PI/2;
    else if(distance>3.6)doorState.target=0;

    if(doorState.target!==0&&doorCollider){
      removeCollider(doorCollider);
      doorCollider=null;
    }

    doorState.angle=THREE.MathUtils.lerp(
      doorState.angle,
      doorState.target,
      1-Math.exp(-6.5*dt)
    );
    if(Math.abs(doorState.angle-doorState.target)<.002){
      doorState.angle=doorState.target;
    }
    doorPivot.rotation.y=doorState.angle;

    if(doorState.target===0&&Math.abs(doorState.angle)<.025&&!doorCollider){
      doorCollider=addBoxCollider({
        cx:HOUSE.cx,cz:hz0,
        w:HOUSE.doorW,d:.18,h:HOUSE.doorH,
        label:'porta-principal-fechada',owner:'casa'
      });
    }
  }

  // JANELAS RÚSTICAS: vidro escuro recuado + moldura e cruzeta de madeira.
  function addFrontWindow(x,name){
    const z=hz0-.165,y=1.55,w=2.05,h=1.25;
    houseDetailBox(w,h,.045,x,y,z,glassMat,name+'Vidro');
    houseDetailBox(.11,h+.18,.11,x-w/2-.02,y,z-.035,woodMat,name+'MolduraE');
    houseDetailBox(.11,h+.18,.11,x+w/2+.02,y,z-.035,woodMat,name+'MolduraD');
    houseDetailBox(w+.20,.11,.11,x,y+h/2+.04,z-.035,woodMat,name+'MolduraTopo');
    houseDetailBox(w+.20,.11,.11,x,y-h/2-.04,z-.035,woodMat,name+'MolduraBase');
    houseDetailBox(.08,h,.10,x,y,z-.055,woodMat,name+'TravessaV');
    houseDetailBox(w,.08,.10,x,y,z-.055,woodMat,name+'TravessaH');
  }

  function addSideWindow(x,z,side,name){
    const y=1.55,w=1.85,h=1.20;
    const px=x+side*.165;
    houseDetailBox(.045,h,w,px,y,z,glassMat,name+'Vidro');
    houseDetailBox(.11,h+.18,.11,px+side*.035,y,z-w/2-.02,woodMat,name+'MolduraA');
    houseDetailBox(.11,h+.18,.11,px+side*.035,y,z+w/2+.02,woodMat,name+'MolduraB');
    houseDetailBox(.11,.11,w+.20,px+side*.035,y+h/2+.04,z,woodMat,name+'MolduraTopo');
    houseDetailBox(.11,.11,w+.20,px+side*.035,y-h/2-.04,z,woodMat,name+'MolduraBase');
    houseDetailBox(.10,h,.08,px+side*.055,y,z,woodMat,name+'TravessaV');
    houseDetailBox(.10,.08,w,px+side*.055,y,z,woodMat,name+'TravessaH');
  }

  addFrontWindow(HOUSE.cx-3.7,'janelaFrontalE');
  addFrontWindow(HOUSE.cx+3.7,'janelaFrontalD');
  addSideWindow(hx0,HOUSE.cz,-1,'janelaOeste');
  addSideWindow(hx1,HOUSE.cz,1,'janelaLeste');

  // Detalhes verticais nos cantos deixam a fachada menos chapada.
  for(const x of[hx0-.17,hx1+.17]){
    houseDetailBox(.13,HOUSE.h,.13,x,HOUSE.h/2,hz0-.17,trimMat,'cunhalFrontal');
  }

  // ---------------------------------------------------------------------------
  // INTERIOR FUNCIONAL: SALA/COZINHA + QUARTO + BANHEIRO + CORREDOR
  // ---------------------------------------------------------------------------
  const interiorDoors=[];

  function interiorWall(cx,cz,w,d,label){
    const mesh=new THREE.Mesh(
      new THREE.BoxGeometry(w,HOUSE.h-.10,d),
      houseMat
    );
    mesh.position.set(cx,(HOUSE.h-.10)/2,cz);
    mesh.name=label;
    houseGroup.add(mesh);

    const collider=addBoxCollider({
      cx,cz,w,d,h:HOUSE.h-.10,
      label,owner:'casa-interna'
    });
    mesh.userData.colliderId=collider.id;
    return mesh;
  }

  function furnitureBox({
    w,h,d,x,z,material=woodMat,name='movel',collider=true,y=null
  }){
    const mesh=new THREE.Mesh(
      new THREE.BoxGeometry(w,h,d),
      material
    );
    mesh.position.set(x,y??h/2,z);
    mesh.name=name;
    houseGroup.add(mesh);

    if(collider){
      const col=addBoxCollider({
        cx:x,cz:z,w,d,h,
        label:name,owner:'casa-movel'
      });
      mesh.userData.colliderId=col.id;
    }
    return mesh;
  }

  function addInteriorDoor({
    x,z,width=1.05,height=2.12,name,openAngle=-Math.PI/2,trigger=1.65
  }){
    const pivot=new THREE.Group();
    pivot.name=`${name}Pivot`;
    pivot.position.set(x-width/2,0,z);
    houseGroup.add(pivot);

    const leaf=new THREE.Mesh(
      new THREE.BoxGeometry(width-.06,height,.075),
      woodMat
    );
    leaf.position.set((width-.06)/2,height/2,0);
    leaf.name=`${name}Folha`;
    pivot.add(leaf);

    for(const y of[.42,1.05,1.68]){
      const rail=new THREE.Mesh(
        new THREE.BoxGeometry(width-.18,.065,.028),
        trimMat
      );
      rail.position.set((width-.06)/2,y,-.05);
      pivot.add(rail);
    }

    houseDetailBox(.09,height+.10,.12,x-width/2-.045,(height+.10)/2,z,woodMat,`${name}BatenteE`);
    houseDetailBox(.09,height+.10,.12,x+width/2+.045,(height+.10)/2,z,woodMat,`${name}BatenteD`);
    houseDetailBox(width+.18,.09,.12,x,height+.045,z,woodMat,`${name}BatenteTopo`);

    let collider=addBoxCollider({
      cx:x,cz:z,w:width,d:.16,h:height,
      label:`${name}-fechada`,owner:'casa-interna'
    });

    const state={angle:0,target:0};

    const door={
      update(dt,targetPosition){
        if(!targetPosition)return;
        const distance=Math.hypot(targetPosition.x-x,targetPosition.z-z);

        if(distance<trigger)state.target=openAngle;
        else if(distance>trigger+1.0)state.target=0;

        if(state.target!==0&&collider){
          removeCollider(collider);
          collider=null;
        }

        state.angle=THREE.MathUtils.lerp(
          state.angle,
          state.target,
          1-Math.exp(-7*dt)
        );

        if(Math.abs(state.angle-state.target)<.002)state.angle=state.target;
        pivot.rotation.y=state.angle;

        if(state.target===0&&Math.abs(state.angle)<.025&&!collider){
          collider=addBoxCollider({
            cx:x,cz:z,w:width,d:.16,h:height,
            label:`${name}-fechada`,owner:'casa-interna'
          });
        }
      }
    };
    interiorDoors.push(door);
    return door;
  }

  // Piso interno de madeira; banheiro recebe sobreposição cerâmica.
  const interiorFloor=new THREE.Mesh(
    new THREE.PlaneGeometry(HOUSE.w-.55,HOUSE.d-.55),
    interiorFloorMat
  );
  interiorFloor.rotation.x=-Math.PI/2;
  interiorFloor.position.set(HOUSE.cx,.026,HOUSE.cz);
  interiorFloor.name='pisoInternoMadeira';
  houseGroup.add(interiorFloor);

  const bathFloor=new THREE.Mesh(
    new THREE.PlaneGeometry(3.0,3.15),
    bathroomFloorMat
  );
  bathFloor.rotation.x=-Math.PI/2;
  bathFloor.position.set(-30.15,.032,39.0);
  bathFloor.name='pisoBanheiro';
  houseGroup.add(bathFloor);

  // QUARTO: canto traseiro esquerdo, porta frontal e circulação livre.
  const bedroomFrontZ=36.55;
  const bedroomRightX=-35.65;
  const bedroomDoorX=-38.15;
  const bedroomDoorW=1.08;

  const bedFrontLeft=(bedroomDoorX-bedroomDoorW/2)-(hx0+.18);
  if(bedFrontLeft>.1){
    interiorWall(
      (hx0+.18+bedroomDoorX-bedroomDoorW/2)/2,
      bedroomFrontZ,
      bedFrontLeft,
      .18,
      'paredeQuartoFrenteE'
    );
  }

  const bedFrontRight=(bedroomRightX-.02)-(bedroomDoorX+bedroomDoorW/2);
  if(bedFrontRight>.1){
    interiorWall(
      (bedroomDoorX+bedroomDoorW/2+bedroomRightX-.02)/2,
      bedroomFrontZ,
      bedFrontRight,
      .18,
      'paredeQuartoFrenteD'
    );
  }

  interiorWall(
    bedroomRightX,
    (bedroomFrontZ+hz1-.18)/2,
    .18,
    (hz1-.18)-bedroomFrontZ,
    'paredeQuartoDireita'
  );

  addInteriorDoor({
    x:bedroomDoorX,z:bedroomFrontZ,
    width:bedroomDoorW,
    name:'portaQuarto',
    openAngle:-Math.PI/2,
    trigger:1.7
  });

  // BANHEIRO: canto traseiro direito, acessível pelo corredor central.
  const bathFrontZ=37.15;
  const bathLeftX=-32.15;
  const bathDoorX=-30.15;
  const bathDoorW=.96;

  interiorWall(
    bathLeftX,
    (bathFrontZ+hz1-.18)/2,
    .18,
    (hz1-.18)-bathFrontZ,
    'paredeBanheiroEsquerda'
  );

  const bathFrontLeft=(bathDoorX-bathDoorW/2)-(bathLeftX+.09);
  if(bathFrontLeft>.1){
    interiorWall(
      (bathLeftX+.09+bathDoorX-bathDoorW/2)/2,
      bathFrontZ,
      bathFrontLeft,
      .18,
      'paredeBanheiroFrenteE'
    );
  }

  const bathFrontRight=(hx1-.18)-(bathDoorX+bathDoorW/2);
  if(bathFrontRight>.1){
    interiorWall(
      (bathDoorX+bathDoorW/2+hx1-.18)/2,
      bathFrontZ,
      bathFrontRight,
      .18,
      'paredeBanheiroFrenteD'
    );
  }

  addInteriorDoor({
    x:bathDoorX,z:bathFrontZ,
    width:bathDoorW,
    name:'portaBanheiro',
    openAngle:-Math.PI/2,
    trigger:1.55
  });

  // Rodapés internos principais.
  houseDetailBox(
    bedroomRightX+.10,.10,(hz1-bedroomFrontZ)-.25,
    bedroomRightX+.10,.05,(bedroomFrontZ+hz1)/2,
    trimMat,'rodapeCorredorQuarto'
  );
  houseDetailBox(
    bathLeftX-.10,.10,(hz1-bathFrontZ)-.25,
    bathLeftX-.10,.05,(bathFrontZ+hz1)/2,
    trimMat,'rodapeCorredorBanheiro'
  );

  // SALA: sofá, mesa de centro e painel baixo. Colisão só no sofá/painel.
  furnitureBox({
    w:3.0,h:.48,d:1.0,x:-39.1,z:33.65,
    material:fabricMat,name:'sofaSala',collider:true
  });
  furnitureBox({
    w:3.0,h:.78,d:.16,x:-39.1,z:34.07,
    material:fabricMat,name:'encostoSofa',collider:false,y:.69
  });
  furnitureBox({
    w:1.35,h:.38,d:.72,x:-36.4,z:33.75,
    material:woodMat,name:'mesaCentro',collider:false
  });
  furnitureBox({
    w:2.0,h:.56,d:.42,x:-35.0,z:35.45,
    material:woodMat,name:'rackSala',collider:true
  });

  // COZINHA: bancada lateral, pia e mesa compacta.
  furnitureBox({
    w:.70,h:.90,d:3.10,x:-29.15,z:34.15,
    material:counterMat,name:'bancadaCozinha',collider:true
  });
  const sink=new THREE.Mesh(
    new THREE.BoxGeometry(.48,.06,.70),
    metalMat
  );
  sink.position.set(-29.15,.94,33.70);
  sink.name='piaCozinha';
  houseGroup.add(sink);

  furnitureBox({
    w:1.55,h:.72,d:1.0,x:-32.05,z:35.05,
    material:woodMat,name:'mesaCozinha',collider:true
  });

  // QUARTO: cama e guarda-roupa com colisores grandes.
  furnitureBox({
    w:2.05,h:.36,d:2.85,x:-39.15,z:39.05,
    material:woodMat,name:'baseCama',collider:true
  });
  furnitureBox({
    w:1.95,h:.24,d:2.72,x:-39.15,z:39.05,
    material:mattressMat,name:'colchaoCama',collider:false,y:.48
  });
  furnitureBox({
    w:.72,h:2.05,d:1.72,x:-36.35,z:39.15,
    material:woodMat,name:'guardaRoupa',collider:true
  });

  // BANHEIRO: bancada/pia e vaso simples; só a bancada recebe colisor.
  furnitureBox({
    w:.72,h:.84,d:1.25,x:-29.15,z:39.25,
    material:counterMat,name:'bancadaBanheiro',collider:true
  });
  const basin=new THREE.Mesh(
    new THREE.CylinderGeometry(.28,.32,.12,16),
    metalMat
  );
  basin.position.set(-29.15,.92,39.25);
  basin.name='cubaBanheiro';
  houseGroup.add(basin);

  const toiletBase=new THREE.Mesh(
    new THREE.CylinderGeometry(.30,.34,.38,14),
    trimMat
  );
  toiletBase.position.set(-31.05,.19,39.45);
  toiletBase.name='vasoSanitario';
  houseGroup.add(toiletBase);

  // O corredor central entre quarto e banheiro fica deliberadamente sem móveis.
  function updateInteriorDoors(dt,targetPosition){
    for(const door of interiorDoors)door.update(dt,targetPosition);
  }

  // ---------------------------------------------------------------------------
  // FECHAMENTO RESIDENCIAL DO LOTE
  // Sem porteira: entrada lateral aberta, própria para carro e moto.
  // ---------------------------------------------------------------------------
  const LOT={x0:-44,x1:-22,z0:24,z1:46};
  const wallH=1.48;
  const wallT=.24;

  function residentialWall(cx,cz,w,d,label){
    const body=new THREE.Mesh(
      new THREE.BoxGeometry(w,wallH,d),
      houseMat
    );
    body.position.set(cx,wallH/2,cz);
    body.name=label;
    houseGroup.add(body);

    const cap=new THREE.Mesh(
      new THREE.BoxGeometry(w+.08,.08,d+.08),
      trimMat
    );
    cap.position.set(cx,wallH+.04,cz);
    cap.name=`${label}Capa`;
    houseGroup.add(cap);

    const collider=addBoxCollider({
      cx,cz,w,d,h:wallH,
      label,owner:'casa-muro'
    });
    body.userData.colliderId=collider.id;
    return body;
  }

  // Muro oeste, fundo e frente.
  residentialWall(
    LOT.x0+.16,
    (LOT.z0+LOT.z1)/2,
    wallT,
    LOT.z1-LOT.z0-.32,
    'muroCasaOeste'
  );

  residentialWall(
    (LOT.x0+LOT.x1)/2,
    LOT.z1-.16,
    LOT.x1-LOT.x0-.32,
    wallT,
    'muroCasaFundo'
  );

  residentialWall(
    (LOT.x0+LOT.x1)/2,
    LOT.z0+.16,
    LOT.x1-LOT.x0-.32,
    wallT,
    'muroCasaFrente'
  );

  // Muro leste começa depois da entrada para deixar uma passagem veicular ampla.
  const entryZ1=29.35;
  const eastWallStart=entryZ1;
  const eastWallEnd=LOT.z1-.16;
  residentialWall(
    LOT.x1-.16,
    (eastWallStart+eastWallEnd)/2,
    wallT,
    eastWallEnd-eastWallStart,
    'muroCasaLeste'
  );

  // Dois pilares marcam a entrada residencial, mas o vão fica totalmente aberto.
  function entryPillar(z,name){
    const pillar=new THREE.Mesh(
      new THREE.BoxGeometry(.42,1.78,.42),
      houseMat
    );
    pillar.position.set(LOT.x1-.18,.89,z);
    pillar.name=name;
    houseGroup.add(pillar);

    const cap=new THREE.Mesh(
      new THREE.BoxGeometry(.54,.10,.54),
      trimMat
    );
    cap.position.set(LOT.x1-.18,1.83,z);
    cap.name=`${name}Capa`;
    houseGroup.add(cap);

    const collider=addBoxCollider({
      cx:LOT.x1-.18,cz:z,w:.42,d:.42,h:1.78,
      label:name,owner:'casa-muro'
    });
    pillar.userData.colliderId=collider.id;
  }

  entryPillar(LOT.z0+.42,'pilarEntradaCasaFrente');
  entryPillar(entryZ1,'pilarEntradaCasaFundo');

  // ---------------------------------------------------------------------------
  // PORTÃO DE CORRER INTELIGENTE
  // Detecta personagem/veículo dos dois lados, mantém aberto durante a travessia
  // e só volta a fechar quando a zona de segurança estiver livre.
  // ---------------------------------------------------------------------------
  const SLIDING_GATE={
    x:LOT.x1-.22,
    z0:LOT.z0+.62,
    z1:entryZ1-.20,
    h:1.42
  };
  SLIDING_GATE.length=SLIDING_GATE.z1-SLIDING_GATE.z0;
  SLIDING_GATE.closedZ=(SLIDING_GATE.z0+SLIDING_GATE.z1)/2;
  SLIDING_GATE.openZ=SLIDING_GATE.closedZ+SLIDING_GATE.length+.38;

  const gateMetalMat=mat(0x3f4546,.72);
  const gateFrameMat=mat(0x2b2f30,.68);
  const gateGroup=new THREE.Group();
  gateGroup.name='portaoCorrerInteligente';
  gateGroup.position.set(SLIDING_GATE.x,0,SLIDING_GATE.closedZ);
  houseGroup.add(gateGroup);

  // Quadro externo.
  const gateTop=new THREE.Mesh(
    new THREE.BoxGeometry(.14,.12,SLIDING_GATE.length),
    gateFrameMat
  );
  gateTop.position.set(0,SLIDING_GATE.h-.08,0);
  gateGroup.add(gateTop);

  const gateBottom=new THREE.Mesh(
    new THREE.BoxGeometry(.14,.12,SLIDING_GATE.length),
    gateFrameMat
  );
  gateBottom.position.set(0,.12,0);
  gateGroup.add(gateBottom);

  for(const z of[-SLIDING_GATE.length/2+.08,SLIDING_GATE.length/2-.08]){
    const side=new THREE.Mesh(
      new THREE.BoxGeometry(.14,SLIDING_GATE.h,.12),
      gateFrameMat
    );
    side.position.set(0,SLIDING_GATE.h/2,z);
    gateGroup.add(side);
  }

  // Réguas verticais metálicas: visual residencial sem fechar totalmente a visão.
  const slatCount=13;
  for(let i=0;i<slatCount;i++){
    const t=i/(slatCount-1);
    const z=THREE.MathUtils.lerp(
      -SLIDING_GATE.length/2+.22,
      SLIDING_GATE.length/2-.22,
      t
    );
    const slat=new THREE.Mesh(
      new THREE.BoxGeometry(.10,SLIDING_GATE.h-.22,.08),
      gateMetalMat
    );
    slat.position.set(0,SLIDING_GATE.h/2,z);
    gateGroup.add(slat);
  }

  // Trilho visível no piso.
  const gateRail=new THREE.Mesh(
    new THREE.BoxGeometry(.11,.035,SLIDING_GATE.length*2+.85),
    metalMat
  );
  gateRail.position.set(
    SLIDING_GATE.x,
    .055,
    SLIDING_GATE.closedZ+SLIDING_GATE.length/2+.20
  );
  gateRail.name='trilhoPortaoCorrer';
  houseGroup.add(gateRail);

  // Motor lateral e luz indicadora.
  const gateMotor=new THREE.Mesh(
    new THREE.BoxGeometry(.62,.62,.48),
    gateFrameMat
  );
  gateMotor.position.set(
    SLIDING_GATE.x-.18,
    .31,
    entryZ1+.46
  );
  gateMotor.name='motorPortaoCorrer';
  houseGroup.add(gateMotor);

  const gateLampMat=new THREE.MeshStandardMaterial({
    color:0xffa42b,
    emissive:0xff6a00,
    emissiveIntensity:2.2,
    roughness:.45
  });
  const gateLamp=new THREE.Mesh(
    new THREE.SphereGeometry(.09,12,8),
    gateLampMat
  );
  gateLamp.position.set(
    SLIDING_GATE.x-.18,
    .76,
    entryZ1+.46
  );
  gateLamp.name='luzPortaoAutomatico';
  houseGroup.add(gateLamp);

  let slidingGateCollider=addBoxCollider({
    cx:SLIDING_GATE.x,
    cz:SLIDING_GATE.closedZ,
    w:.22,
    d:SLIDING_GATE.length,
    h:SLIDING_GATE.h,
    label:'portao-correr-fechado',
    owner:'casa-portao'
  });

  const slidingGateState={
    progress:0,
    target:0,
    hold:0
  };

  function updateSlidingGate(dt,targetPosition){
    if(!targetPosition)return;

    const gateCenterX=SLIDING_GATE.x;
    const gateCenterZ=SLIDING_GATE.closedZ;
    const dx=targetPosition.x-gateCenterX;
    const dz=targetPosition.z-gateCenterZ;
    const distance=Math.hypot(dx,dz);

    // Zona de aproximação dos dois lados da entrada.
    const approaching=
      Math.abs(dz)<5.2&&
      Math.abs(dx)<8.2;

    // Zona de segurança impede fechamento sobre personagem, carro ou moto.
    const crossing=
      Math.abs(dx)<3.0&&
      targetPosition.z>SLIDING_GATE.z0-1.05&&
      targetPosition.z<SLIDING_GATE.z1+1.05;

    if(approaching||crossing||distance<7.2){
      slidingGateState.target=1;
      slidingGateState.hold=1.15;
    }else{
      slidingGateState.hold=Math.max(0,slidingGateState.hold-dt);
      if(slidingGateState.hold===0)slidingGateState.target=0;
    }

    // Remove o bloqueio assim que o motor começa a abrir.
    if(slidingGateState.target===1&&slidingGateCollider){
      removeCollider(slidingGateCollider);
      slidingGateCollider=null;
    }

    const speed=1-Math.exp(-4.2*dt);
    slidingGateState.progress=THREE.MathUtils.lerp(
      slidingGateState.progress,
      slidingGateState.target,
      speed
    );

    if(Math.abs(slidingGateState.progress-slidingGateState.target)<.002){
      slidingGateState.progress=slidingGateState.target;
    }

    gateGroup.position.z=THREE.MathUtils.lerp(
      SLIDING_GATE.closedZ,
      SLIDING_GATE.openZ,
      slidingGateState.progress
    );

    // Luz pulsa durante movimento e fica fraca quando parado.
    const moving=Math.abs(slidingGateState.progress-slidingGateState.target)>.01;
    gateLamp.material.emissiveIntensity=moving?3.2:.65;
    gateLamp.scale.setScalar(moving?1.08:1);

    // Colisor só volta depois que o portão terminou de fechar.
    if(
      slidingGateState.target===0&&
      slidingGateState.progress<.015&&
      !slidingGateCollider
    ){
      slidingGateCollider=addBoxCollider({
        cx:SLIDING_GATE.x,
        cz:SLIDING_GATE.closedZ,
        w:.22,
        d:SLIDING_GATE.length,
        h:SLIDING_GATE.h,
        label:'portao-correr-fechado',
        owner:'casa-portao'
      });
    }
  }

  // ---------------------------------------------------------------------------
  // QUINTAL RESIDENCIAL: quase todo concretado, com um pequeno canteiro de terra.
  // ---------------------------------------------------------------------------
  const yardSlab=new THREE.Mesh(
    new THREE.BoxGeometry(
      LOT.x1-LOT.x0-.56,
      .035,
      LOT.z1-LOT.z0-.56
    ),
    yardConcreteMat
  );
  yardSlab.position.set(
    (LOT.x0+LOT.x1)/2,
    .0175,
    (LOT.z0+LOT.z1)/2
  );
  yardSlab.name='quintalConcretado';
  houseGroup.add(yardSlab);

  // Juntas de dilatação discretas para o concreto não parecer uma placa lisa infinita.
  const jointMat=mat(0x77756f,.98);
  for(const z of[29.6,35.0,40.4]){
    const joint=new THREE.Mesh(
      new THREE.BoxGeometry(LOT.x1-LOT.x0-.9,.008,.035),
      jointMat
    );
    joint.position.set((LOT.x0+LOT.x1)/2,.039,z);
    joint.name='juntaConcretoQuintal';
    houseGroup.add(joint);
  }
  for(const x of[-38.5,-33.0,-27.5]){
    const joint=new THREE.Mesh(
      new THREE.BoxGeometry(.035,.008,LOT.z1-LOT.z0-.9),
      jointMat
    );
    joint.position.set(x,.039,(LOT.z0+LOT.z1)/2);
    joint.name='juntaConcretoQuintal';
    houseGroup.add(joint);
  }

  // Pequeno espaço de terra no fundo direito do lote, fora da circulação dos veículos.
  const DIRT_PATCH={
    cx:-25.2,
    cz:44.0,
    w:4.1,
    d:2.45
  };

  const soilBed=new THREE.Mesh(
    new THREE.BoxGeometry(DIRT_PATCH.w,.09,DIRT_PATCH.d),
    soilMat
  );
  soilBed.position.set(DIRT_PATCH.cx,.065,DIRT_PATCH.cz);
  soilBed.name='canteiroTerraQuintal';
  houseGroup.add(soilBed);

  // Meio-fio baixo contornando o canteiro de terra.
  const curbH=.12;
  const curbT=.10;
  const curbY=.06;

  houseDetailBox(
    DIRT_PATCH.w+.20,curbH,curbT,
    DIRT_PATCH.cx,curbY,DIRT_PATCH.cz-DIRT_PATCH.d/2-.05,
    trimMat,'bordaCanteiroFrente'
  );
  houseDetailBox(
    DIRT_PATCH.w+.20,curbH,curbT,
    DIRT_PATCH.cx,curbY,DIRT_PATCH.cz+DIRT_PATCH.d/2+.05,
    trimMat,'bordaCanteiroFundo'
  );
  houseDetailBox(
    curbT,curbH,DIRT_PATCH.d,
    DIRT_PATCH.cx-DIRT_PATCH.w/2-.05,curbY,DIRT_PATCH.cz,
    trimMat,'bordaCanteiroEsquerda'
  );
  houseDetailBox(
    curbT,curbH,DIRT_PATCH.d,
    DIRT_PATCH.cx+DIRT_PATCH.w/2+.05,curbY,DIRT_PATCH.cz,
    trimMat,'bordaCanteiroDireita'
  );

  // ---------------------------------------------------------------------------
  // ÁREA LATERAL / GARAGEM: cabe carro e moto sem bloquear a circulação.
  // ---------------------------------------------------------------------------
  const PARKING={
    cx:-25.30,
    cz:34.05,
    w:5.35,
    d:16.10
  };

  const parkingPad=new THREE.Mesh(
    new THREE.BoxGeometry(PARKING.w,.055,PARKING.d),
    pathMat
  );
  parkingPad.position.set(PARKING.cx,.0275,PARKING.cz);
  parkingPad.name='pisoGaragemLateral';
  houseGroup.add(parkingPad);

  // Faixa central de acesso: mantém o carro alinhado da entrada até a cobertura.
  const parkingGuideMat=mat(0xb9b1a4,.90);
  for(const x of[PARKING.cx-PARKING.w/2+.18,PARKING.cx+PARKING.w/2-.18]){
    const guide=new THREE.Mesh(
      new THREE.BoxGeometry(.07,.012,PARKING.d-.40),
      parkingGuideMat
    );
    guide.position.set(x,.062,PARKING.cz);
    guide.name='guiaGaragemLateral';
    houseGroup.add(guide);
  }

  // Cobertura lateral: largura suficiente para carro e espaço de moto ao lado.
  const CARPORT={
    cx:PARKING.cx,
    cz:36.60,
    w:5.05,
    d:8.10,
    h:2.55
  };

  const carportRoof=new THREE.Mesh(
    new THREE.BoxGeometry(CARPORT.w,.16,CARPORT.d),
    roofMat
  );
  carportRoof.position.set(
    CARPORT.cx,
    CARPORT.h,
    CARPORT.cz
  );
  carportRoof.rotation.z=THREE.MathUtils.degToRad(-4);
  carportRoof.name='coberturaGaragemLateral';
  houseGroup.add(carportRoof);

  // Viga de acabamento frontal da garagem.
  houseDetailBox(
    CARPORT.w+.08,.16,.16,
    CARPORT.cx,CARPORT.h-.16,CARPORT.cz-CARPORT.d/2+.10,
    woodMat,'vigaGaragemLateral'
  );

  // Quatro pilares nas bordas: vão central permanece livre para o carro.
  const carportPostXs=[
    CARPORT.cx-CARPORT.w/2+.18,
    CARPORT.cx+CARPORT.w/2-.18
  ];
  const carportPostZs=[
    CARPORT.cz-CARPORT.d/2+.18,
    CARPORT.cz+CARPORT.d/2-.18
  ];

  for(const x of carportPostXs){
    for(const z of carportPostZs){
      const post=houseDetailBox(
        .18,CARPORT.h-.18,.18,
        x,(CARPORT.h-.18)/2,z,
        woodMat,'pilarGaragemLateral'
      );
      const collider=addBoxCollider({
        cx:x,cz:z,w:.20,d:.20,h:CARPORT.h-.18,
        label:'pilar-garagem-lateral',owner:'casa-garagem'
      });
      post.userData.colliderId=collider.id;
    }
  }

  // Marcações visuais discretas: vaga do carro e faixa reservada para a moto.
  const lineMat=mat(0xd5d0c5,.82);
  function parkingLine(w,d,x,z,name){
    const line=new THREE.Mesh(
      new THREE.BoxGeometry(w,.018,d),
      lineMat
    );
    line.position.set(x,.072,z);
    line.name=name;
    houseGroup.add(line);
  }

  parkingLine(.055,5.15,PARKING.cx-1.65,36.65,'vagaCarroLinhaE');
  parkingLine(.055,5.15,PARKING.cx+.55,36.65,'vagaCarroLinhaD');
  parkingLine(1.20,.055,PARKING.cx+1.62,34.15,'vagaMotoLinhaFrente');
  parkingLine(1.20,.055,PARKING.cx+1.62,38.45,'vagaMotoLinhaFundo');

  if(debug){
    const axes=new THREE.AxesHelper(3);
    axes.position.set(0,.03,22);group.add(axes);

    const padMaterial=new THREE.LineBasicMaterial({color:0x55dd88});
    for(const area of FLAT_AREAS){
      const pts=[
        new THREE.Vector3(area.x0,area.y+.025,area.z0),
        new THREE.Vector3(area.x1,area.y+.025,area.z0),
        new THREE.Vector3(area.x1,area.y+.025,area.z1),
        new THREE.Vector3(area.x0,area.y+.025,area.z1),
      ];
      const geometry=new THREE.BufferGeometry().setFromPoints(pts);
      const line=new THREE.LineLoop(geometry,padMaterial);
      line.name=`debug-flat-${area.id}`;
      group.add(line);
    }
  }

  function groundHeight(x,z){
    const flat=flatAreaAt(x,z);
    if(flat)return flat.y;

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

  function terrainInfoAt(x,z){
    const flat=flatAreaAt(x,z);
    return{
      height:groundHeight(x,z),
      zone:zoneAt(x,z),
      buildable:!!flat,
      flatArea:flat?.id||null,
      surface:flat?'construction-pad':'terrain',
    };
  }

  function canPlaceRect(cx,cz,w,d,padding=.25){
    const area=flatAreaAt(cx,cz);
    if(!area)return{ok:false,reason:'fora-de-area-plana'};

    const x0=cx-w/2-padding,x1=cx+w/2+padding;
    const z0=cz-d/2-padding,z1=cz+d/2+padding;
    if(x0<area.x0||x1>area.x1||z0<area.z0||z1>area.z1){
      return{ok:false,reason:'fora-dos-limites',area:area.id};
    }

    for(const c of colliders){
      if(x1>c.x0&&x0<c.x1&&z1>c.z0&&z0<c.z1){
        return{ok:false,reason:'colisor',collider:c.id,label:c.label,area:area.id};
      }
    }

    const heights=[
      groundHeight(x0,z0),groundHeight(x1,z0),
      groundHeight(x0,z1),groundHeight(x1,z1)
    ];
    const delta=Math.max(...heights)-Math.min(...heights);
    if(delta>.02)return{ok:false,reason:'terreno-nao-plano',delta,area:area.id};

    return{ok:true,y:groundHeight(cx,cz),area:area.id};
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

  // Girar também varre volume e apoios. Evita que a quina da carroceria corte
  // parede/limite ou que uma roda "caia" de repente para outro nível só por esterçar.
  function vehicleTurnAllowed(x,z,fromYaw,toYaw,halfLength,halfWidth,maxStep,twoWheel=false){
    const delta=Math.atan2(Math.sin(toYaw-fromYaw),Math.cos(toYaw-fromYaw));
    const steps=Math.max(1,Math.ceil(Math.abs(delta)/THREE.MathUtils.degToRad(2)));
    let yaw=fromYaw;
    let contacts=vehicleContacts(x,z,yaw,halfLength,halfWidth,twoWheel);

    for(let i=1;i<=steps;i++){
      const nextYaw=fromYaw+delta*(i/steps);
      if(blockedOBB(x,z,nextYaw,halfLength,halfWidth))return false;
      const next=vehicleContacts(x,z,nextYaw,halfLength,halfWidth,twoWheel);
      for(let k=0;k<contacts.length;k++){
        if(Math.abs(next[k]-contacts[k])>maxStep+.001)return false;
      }
      contacts=next;yaw=nextYaw;
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
    const flat=flatAreaAt(x,z);
    if(flat)return flat.label;
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
    const contacts=vehicleContacts(x,z,yaw,halfLength,halfWidth,false);
    const[hFR,hFL,hBR,hBL]=contacts;
    const hF=(hFR+hFL)/2,hB=(hBR+hBL)/2;
    const hR=(hFR+hBR)/2,hL=(hFL+hBL)/2;

    // Plano rígido aproximado pelos eixos longitudinal/lateral.
    const slopeF=(hF-hB)/Math.max(.01,halfLength*2);
    const slopeR=(hR-hL)/Math.max(.01,halfWidth*2);
    const pitch=Math.atan(slopeF);
    const roll=Math.atan(slopeR);

    // Em terreno descontínuo (borda/degrau), média simples enterra parte do carro.
    // Escolhe a menor altura do centro que mantém todos os quatro cantos acima do chão.
    const supports=[
      {h:hFR,s: halfLength,t: halfWidth},
      {h:hFL,s: halfLength,t:-halfWidth},
      {h:hBR,s:-halfLength,t: halfWidth},
      {h:hBL,s:-halfLength,t:-halfWidth},
    ];
    let y=-Infinity;
    for(const p of supports){
      y=Math.max(y,p.h-slopeF*p.s-slopeR*p.t);
    }
    if(!Number.isFinite(y))y=0;

    return{y,pitch,roll};
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

  function updateWorld(dt,targetPosition){
    updateDoor(dt,targetPosition);
    updateInteriorDoors(dt,targetPosition);
    updateSlidingGate(dt,targetPosition);
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
    terrainPose,twoWheelPose,cameraSafePosition,vehicleBlocked:blockedOBB,vehicleTurnAllowed,limit:LIMIT,
    flatAreas:FLAT_AREAS,terrainInfoAt,canPlaceRect,addBoxCollider,removeCollider,updateWorld
  };
}
