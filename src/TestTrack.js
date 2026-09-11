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
  // PRIMEIRA ÁREA REAL DO MUNDO: CASA + ACESSO + PORTEIRA
  // Visual rural detalhado; colisão estrutural continua simples e separada.
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

  // Acesso largo o suficiente para carro e moto, ligado ao final da pista.
  const driveway=new THREE.Mesh(new THREE.BoxGeometry(32.4,.045,5),pathMat);
  driveway.position.set(-26,.0225,25.5);
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

  // Luminária física presa ao forro + luz quente real.
  const lampBaseMat=mat(0x5a5148,.72);
  const lampGlowMat=new THREE.MeshStandardMaterial({
    color:0xffe1aa,
    emissive:0xffb15a,
    emissiveIntensity:2.4,
    roughness:.34,
    metalness:.02
  });

  const lampBase=new THREE.Mesh(
    new THREE.CylinderGeometry(.22,.22,.08,16),
    lampBaseMat
  );
  lampBase.position.set(HOUSE.cx,HOUSE.h-.16,HOUSE.cz);
  lampBase.name='baseLuminariaTeto';
  houseGroup.add(lampBase);

  const lampStem=new THREE.Mesh(
    new THREE.CylinderGeometry(.035,.035,.18,10),
    woodMat
  );
  lampStem.position.set(HOUSE.cx,HOUSE.h-.28,HOUSE.cz);
  lampStem.name='hasteLuminariaTeto';
  houseGroup.add(lampStem);

  const lampBulb=new THREE.Mesh(
    new THREE.SphereGeometry(.13,16,10),
    lampGlowMat
  );
  lampBulb.position.set(HOUSE.cx,HOUSE.h-.42,HOUSE.cz);
  lampBulb.name='lampadaVisivelCasa';
  houseGroup.add(lampBulb);

  // PointLight fica dentro da lâmpada visível; sem sombras dinâmicas no mobile.
  const interiorLight=new THREE.PointLight(0xffd7a3,18,13,2);
  interiorLight.position.copy(lampBulb.position);
  interiorLight.name='luzInternaCasa';
  houseGroup.add(interiorLight);

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

  // PORTEIRA ORIGINAL PRESERVADA.
  const GATE={x:-23.4,z0:23.0,width:5.0,height:1.45};
  function gatePost(z){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.3,1.9,.3),woodMat);
    post.position.set(GATE.x,.95,z);
    houseGroup.add(post);
    const collider=addBoxCollider({
      cx:GATE.x,cz:z,w:.3,d:.3,h:1.9,
      label:'poste-porteira',owner:'casa'
    });
    post.userData.colliderId=collider.id;
  }
  gatePost(GATE.z0-.2);
  gatePost(GATE.z0+GATE.width+.2);

  const gatePivot=new THREE.Group();
  gatePivot.name='porteiraPivot';
  gatePivot.position.set(GATE.x,0,GATE.z0);
  houseGroup.add(gatePivot);

  const gateLeaf=new THREE.Group();
  gateLeaf.name='porteiraFolha';
  gatePivot.add(gateLeaf);
  for(const y of[.38,.78,1.18]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.12,.14,GATE.width),woodMat);
    rail.position.set(0,y,GATE.width/2);
    gateLeaf.add(rail);
  }
  for(const z of[.12,GATE.width-.12]){
    const stile=new THREE.Mesh(new THREE.BoxGeometry(.14,1.35,.14),woodMat);
    stile.position.set(0,.72,z);
    gateLeaf.add(stile);
  }

  let gateCollider=addBoxCollider({
    cx:GATE.x,cz:GATE.z0+GATE.width/2,
    w:.22,d:GATE.width,h:GATE.height,
    label:'porteira-fechada',owner:'casa'
  });
  const gateState={angle:0,target:0};

  function updateGate(dt,targetPosition){
    if(!targetPosition)return;
    const gateCenterZ=GATE.z0+GATE.width/2;
    const distance=Math.hypot(targetPosition.x-GATE.x,targetPosition.z-gateCenterZ);

    if(distance<6.5)gateState.target=-Math.PI/2;
    else if(distance>8.5)gateState.target=0;

    if(gateState.target!==0&&gateCollider){
      removeCollider(gateCollider);
      gateCollider=null;
    }

    gateState.angle=THREE.MathUtils.lerp(
      gateState.angle,
      gateState.target,
      1-Math.exp(-5.5*dt)
    );

    if(Math.abs(gateState.angle-gateState.target)<.002){
      gateState.angle=gateState.target;
    }
    gatePivot.rotation.y=gateState.angle;

    if(gateState.target===0&&Math.abs(gateState.angle)<.025&&!gateCollider){
      gateCollider=addBoxCollider({
        cx:GATE.x,cz:GATE.z0+GATE.width/2,
        w:.22,d:GATE.width,h:GATE.height,
        label:'porteira-fechada',owner:'casa'
      });
    }
  }

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
    updateGate(dt,targetPosition);
    updateDoor(dt,targetPosition);
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
