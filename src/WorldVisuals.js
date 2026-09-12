import * as THREE from 'three';
import {mergeGeometries} from '../vendor/addons/utils/BufferGeometryUtils.js';

const colorMat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.85,...extra});
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
export function createMaterials(manager,anisotropy=4){
  const loader=new THREE.TextureLoader(manager);
  function pbr(id,color,meters,normal=.3){
    const maps={};
    for(const [key,suffix] of [['map','Color'],['normalMap','NormalGL'],['roughnessMap','Roughness']]){
      const t=loader.load(new URL(`../assets/${id}_${suffix}.webp`,import.meta.url).href);
      t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/meters,1/meters);t.anisotropy=anisotropy;
      if(key==='map')t.colorSpace=THREE.SRGBColorSpace;maps[key]=t;
    }
    return new THREE.MeshStandardMaterial({...maps,color,roughness:1,normalScale:new THREE.Vector2(normal,normal)});
  }
  return {asphalt:pbr('Asphalt012',0xb6b9b9,2,.23),concrete:pbr('Concrete034',0xdedbd3,1.1,.3),soil:pbr('Ground037',0xd3bca0,2.5,.65),grass:pbr('Grass004',0xc3d2a4,2.8,.45),bark:pbr('Bark012',0xc7b199,1,.7)};
}
function surfaceMesh(triangles,material,y,name){
  const vertices=[],uvs=[];
  for(const triangle of triangles){
    const [a,b,c]=triangle;const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for(const [x,z] of cross>0?[a,c,b]:[a,b,c]){vertices.push(x,y,z);uvs.push(x,z)}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.name=name;return mesh;
}
function mergedBoxes(boxes,material,parent,name,geometry=new THREE.BoxGeometry(1,1,1)){
  if(!boxes.length)return;
  const mesh=new THREE.InstancedMesh(geometry,material,boxes.length),dummy=new THREE.Object3D();
  for(let i=0;i<boxes.length;i++){const b=boxes[i];dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(0,b.yaw||0,0);dummy.scale.set(b.w,b.h,b.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}
  mesh.name=name;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinderBetween(a,b,r1,r2){
  const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r2,r1,delta.length(),7,1);
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()),new THREE.Vector3(1,1,1)));
  return g;
}
function treePrototype(seed,leafCount,leafScale=1){
  const random=rng(seed),wood=[],leafPositions=[],leafColors=[],leafUvs=[];
  const base=new THREE.Vector3(),top=new THREE.Vector3(.22,5.2,-.12);
  wood.push(cylinderBetween(base,top,.22,.035));
  const leafColor=new THREE.Color();
  for(let i=0;i<12;i++){
    const angle=i*2.4+random()*.6,h=2.2+i*.22,start=new THREE.Vector3(.08,h,0),end=new THREE.Vector3(Math.cos(angle)*(1.4+random()),4.6+random()*1.6,Math.sin(angle)*(1.4+random()));
    wood.push(cylinderBetween(start,end,.075,.009));
    for(let j=0;j<3;j++){
      const root=start.clone().lerp(end,.45+j*.18),tip=end.clone().add(new THREE.Vector3((random()-.5)*1.8,random()*1.0,(random()-.5)*1.8));
      wood.push(cylinderBetween(root,tip,.022,.003));
      for(let k=0;k<leafCount;k++){
        const p=root.clone().lerp(tip,.35+random()*.65).add(new THREE.Vector3((random()-.5)*1.2,(random()-.5)*.8,(random()-.5)*1.2));
        const length=(.32+random()*.23)*leafScale,width=length*.44,rotation=new THREE.Euler(random()*2.7,random()*6.28,random());
        const shape=[[-width,0,0],[0,.035,length*.55],[width,0,0],[0,-.01,-length*.45]];
        const transformed=shape.map(v=>new THREE.Vector3(...v).applyEuler(rotation).add(p));
        leafColor.setHSL(.23+random()*.09,.32+random()*.22,.17+random()*.10);
        for(const index of [0,1,2,0,2,3]){const v=transformed[index];leafPositions.push(v.x,v.y,v.z);leafColors.push(leafColor.r,leafColor.g,leafColor.b);leafUvs.push(0,0)}
      }
    }
  }
  const branches=mergeGeometries(wood);wood.forEach(g=>g.dispose());
  const leaves=new THREE.BufferGeometry();leaves.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));leaves.setAttribute('color',new THREE.Float32BufferAttribute(leafColors,3));leaves.setAttribute('uv',new THREE.Float32BufferAttribute(leafUvs,2));leaves.computeVertexNormals();
  return {branches,leaves};
}

export function buildWorldVisuals(parent,layout,materials,addCollider,{mobile=false}={}){
  const world=new THREE.Group();world.name='bairroPlanejado';parent.add(world);
  const n=layout.gridSize,positions=[],uvs=[],colors=[],indices=[];
  const tint=new THREE.Color();
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const px=x*4-500,pz=z*4-500,y=layout.heights[z*n+x];positions.push(px,y,pz);uvs.push(px,pz);
    const shade=.9+.1*Math.sin(px*.05)*Math.cos(pz*.037);tint.setRGB(shade,shade,.92*shade);colors.push(tint.r,tint.g,tint.b);
    if(x<n-1&&z<n-1){const i=z*n+x;indices.push(i,i+n,i+1,i+1,i+n,i+n+1)}
  }
  const groundGeometry=new THREE.BufferGeometry();groundGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));groundGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));groundGeometry.setIndex(indices);groundGeometry.computeVertexNormals();
  materials.grass.vertexColors=true;const ground=new THREE.Mesh(groundGeometry,materials.grass);ground.receiveShadow=true;ground.name='terrenoComAlturaFisica';world.add(ground);
  const layerMaterial={asphalt:materials.asphalt,gravel:materials.soil,sidewalk:materials.concrete,curb:materials.concrete,shoulder:materials.soil};
  for(const layer of layout.layers){
    world.add(surfaceMesh(layer.triangles,layerMaterial[layer.name],layer.height,layer.name));
    if(layer.name==='curb'||layer.name==='sidewalk'){
      const walls=[],uv=[];
      for(const poly of layer.polygons)for(const ring of poly)for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        for(const [p,h,u,v] of [[a,0,0,0],[b,layer.height,len,.16],[b,0,len,0],[a,0,0,0],[a,layer.height,0,.16],[b,layer.height,len,.16]]){walls.push(p[0],h,p[1]);uv.push(u,v)}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(walls,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();const m=new THREE.Mesh(g,materials.concrete);m.material.side=THREE.DoubleSide;m.receiveShadow=true;world.add(m);
    }
  }
  const white=colorMat(0xede9d6),yellow=colorMat(0xe0bc46),metal=colorMat(0x6b7275,{metalness:.75,roughness:.48});
  const paint=[],edges=[],joints=[],grates=[],poles=[],arms=[],heads=[],bases=[],stopBars=[];
  const isJunction=(x,z,road,margin=5)=>layout.nearestRoad(x,z,road.id).distance<margin;
  const trees=[];
  for(const road of layout.roads){
    let distance=0,lastDash=-1,lastPole=-1,lastTree=-1;
    for(let i=1;i<road.samples.length;i++){
      const a=road.samples[i-1],b=road.samples[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,nx=dz/length,nz=-dx/length;
      distance+=length;
      if(road.markings&&Math.floor(distance/8)!==lastDash){
        lastDash=Math.floor(distance/8);
        if(!isJunction(x,z,road,5))paint.push({x,y:.052,z,w:.1,h:.004,d:2.8,yaw});
      }
      if(road.markings&&!road.sidewalks&&!isJunction(x,z,road,3))for(const side of [-1,1])edges.push({x:x+nx*side*(road.width/2-.2),y:.052,z:z+nz*side*(road.width/2-.2),w:.09,h:.004,d:length+.02,yaw});
      if(road.sidewalks&&Math.floor(distance/2.5)!==Math.floor((distance-length)/2.5))for(const side of [-1,1]){
        const offset=road.width/2+1.35,px=x+nx*side*offset,pz=z+nz*side*offset;
        if(layout.surfaceAt(px,pz)?.name==='sidewalk'&&!isJunction(x,z,road,5))joints.push({x:px,y:.168,z:pz,w:2.08,h:.002,d:.016,yaw});
      }
      if(road.type==='asfalto'&&road.markings&&Math.floor(distance/28)!==lastPole){
        lastPole=Math.floor(distance/28);const side=lastPole%2?1:-1,offset=road.width/2+3.1,px=x+nx*side*offset,pz=z+nz*side*offset;
        if(layout.placeAllowed(px,pz,.16)){
          const y=layout.groundHeight(px,pz);poles.push({x:px,y:y+3.7,z:pz,w:.19,h:7.4,d:.19});bases.push({x:px,y:y+.18,z:pz,w:.36,h:.36,d:.36});
          arms.push({x:px-nx*side*.9,y:y+7.35,z:pz-nz*side*.9,w:1.9,h:.09,d:.09,yaw:Math.atan2(-nz,nx)});
          heads.push({x:px-nx*side*1.85,y:y+7.3,z:pz-nz*side*1.85,w:.65,h:.13,d:.26,yaw:Math.atan2(-nz,nx)});
          addCollider({cx:px,cz:pz,w:.28,d:.28,h:7.5,label:'poste',owner:'via'});
        }
      }
      if(Math.floor(distance/19)!==lastTree){
        lastTree=Math.floor(distance/19);
        const side=lastTree%2?1:-1,offset=road.width/2+8.2,px=x+nx*side*offset,pz=z+nz*side*offset;
        if(layout.placeAllowed(px,pz,3.1))trees.push({x:px,z:pz,scale:.85+((lastTree*13)%10)*.035,yaw:distance});
      }
    }
  }
  // Crossings sit on the approaches and are clipped by the actual asphalt footprint.
  for(const j of layout.junctions.filter(j=>Math.abs(j.x)<150&&Math.abs(j.z)<160)){
    for(const axis of [0,1])for(const sign of [-1,1])for(let k=-2;k<=2;k++){
      const x=j.x+(axis===0?sign*8:k*.9),z=j.z+(axis===0?k*.9:sign*8);
      if(layout.surfaceAt(x,z)?.name==='asphalt')edges.push({x,y:.054,z,w:axis===0?2:.42,h:.004,d:axis===0?.42:2});
    }
  }
  for(const z of [13.2,18.8,23.4])for(const x of [-10.15,-5.45])edges.push({x,y:.054,z,w:.09,h:.004,d:4.1});
  mergedBoxes(paint,yellow,world,'pinturaEixo');mergedBoxes(edges,white,world,'faixasTravessiasEVagas');mergedBoxes(joints,colorMat(0x828078),world,'juntasCalcada');
  const polesMesh=mergedBoxes(poles,metal,world,'postes',new THREE.CylinderGeometry(.3,.5,1,10));if(polesMesh)polesMesh.castShadow=true;
  mergedBoxes(arms,metal,world,'bracosPostes');mergedBoxes(bases,materials.concrete,world,'basesPostes');mergedBoxes(heads,colorMat(0xccccbf,{metalness:.3}),world,'luminariasLED');
  for(const road of layout.roads.filter(r=>r.sidewalks))for(let i=12;i<road.samples.length;i+=25){
    const [x,z]=road.samples[i],prev=road.samples[i-1],yaw=Math.atan2(x-prev[0],z-prev[1]),nx=Math.cos(yaw),nz=-Math.sin(yaw),px=x+nx*(road.width/2+.6),pz=z+nz*(road.width/2+.6);
    if(layout.surfaceAt(px,pz)?.name==='sidewalk'&&!isJunction(x,z,road,4))for(let k=-2;k<=2;k++)grates.push({x:px+nx*k*.085,y:.17,z:pz+nz*k*.085,w:.032,h:.006,d:.5,yaw});
  }
  mergedBoxes(grates,colorMat(0x3c4242,{metalness:.7}),world,'grelhasDrenagem');
  const random=rng(36401);
  for(let i=0;i<300;i++){
    const x=(random()-.5)*950,z=(random()-.5)*950;
    if(layout.placeAllowed(x,z,3.1))trees.push({x,z,scale:.85+random()*.3,yaw:random()*6.28});
    if(trees.length>=230)break;
  }
  const leafMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,side:THREE.DoubleSide});
  const prototypes=[treePrototype(71,mobile?28:48),treePrototype(47,mobile?24:40)];
  const distantPrototypes=[treePrototype(71,12,1.5),treePrototype(47,10,1.5)];
  const sectors=new Map();
  for(const [index,tree] of trees.entries()){
    const key=`${Math.floor(tree.x/100)},${Math.floor(tree.z/100)},${index%2}`,batch=sectors.get(key)||{type:index%2,items:[]};batch.items.push(tree);sectors.set(key,batch);
    addCollider({cx:tree.x,cz:tree.z,w:.5,d:.5,h:4.5,label:'tronco',owner:'vegetacao'});
  }
  const dummy=new THREE.Object3D(),treeBatches=[];
  for(const {type,items} of sectors.values()){
    const center=new THREE.Vector3(items.reduce((n,t)=>n+t.x,0)/items.length,0,items.reduce((n,t)=>n+t.z,0)/items.length);
    const lod=new THREE.LOD();lod.position.copy(center);world.add(lod);
    for(const [level,prototype] of [prototypes[type],distantPrototypes[type]].entries()){
    const levelGroup=new THREE.Group();lod.addLevel(levelGroup,level?110:0,.15);
    for(const [geometry,material,name] of [[prototype.branches,materials.bark,'galhos'],[prototype.leaves,leafMaterial,'folhas']]){
      const mesh=new THREE.InstancedMesh(geometry,material,items.length);
      for(let i=0;i<items.length;i++){const t=items[i];dummy.position.set(t.x-center.x,layout.groundHeight(t.x,t.z),t.z-center.z);dummy.rotation.set(0,t.yaw,0);dummy.scale.setScalar(t.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name;mesh.computeBoundingSphere();levelGroup.add(mesh);treeBatches.push(mesh);
    }
    }
  }
  // Rural fences and low field vegetation occupy inspected rectangles away from roads.
  const fenceBoxes=[],wireBoxes=[],cropBoxes=[];
  for(const field of [{x0:125,x1:185,z0:48,z1:110},{x0:-175,x1:-115,z0:-125,z1:-65}]){
    for(const [a,b] of [[[field.x0,field.z0],[field.x1,field.z0]],[[field.x0,field.z1],[field.x1,field.z1]],[[field.x0,field.z0],[field.x0,field.z1]],[[field.x1,field.z0],[field.x1,field.z1]]]){
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length/4);let previous=null;
      for(let i=0;i<=count;i++){
        const x=a[0]+(b[0]-a[0])*i/count,z=a[1]+(b[1]-a[1])*i/count;
        if(!layout.placeAllowed(x,z,.3)){previous=null;continue;}
        const y=layout.groundHeight(x,z);fenceBoxes.push({x,y:y+.7,z,w:.12,h:1.4,d:.12});
        addCollider({cx:x,cz:z,w:.16,d:.16,h:1.4,y0:y,label:'mourao',owner:'campo'});
        if(previous){
          const cx=(x+previous.x)/2,cz=(z+previous.z)/2,w=Math.abs(x-previous.x)||.03,d=Math.abs(z-previous.z)||.03;
          for(const h of [.45,.85,1.2])wireBoxes.push({x:cx,y:(y+previous.y)/2+h,z:cz,w,h:.016,d});
          addCollider({cx,cz,w,d,h:1.3,y0:Math.min(y,previous.y),label:'cerca',owner:'campo'});
        }
        previous={x,y,z};
      }
    }
    for(let x=field.x0+3;x<field.x1-3;x+=2)for(let z=field.z0+3;z<field.z1-3;z+=2.5)if(layout.nearestRoad(x,z).distance>5)cropBoxes.push({x,y:layout.terrainHeight(x,z)+.2,z,w:.5,h:.4,d:.65,yaw:random()});
  }
  mergedBoxes(fenceBoxes,materials.bark,world,'mouroesCampo');mergedBoxes(wireBoxes,metal,world,'aramesCampo');
  const blades=[];
  for(let i=0;i<8;i++){
    const a=i*2.4,x=Math.cos(a)*.3,z=Math.sin(a)*.3;
    blades.push(x-.025,0,z,x+.025,0,z,x*1.2,.45+random()*.35,z*1.2);
  }
  const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));bladeGeometry.computeVertexNormals();
  const grassTufts=new THREE.InstancedMesh(bladeGeometry,colorMat(0x677941,{side:THREE.DoubleSide}),cropBoxes.length);
  cropBoxes.forEach((t,i)=>{dummy.position.set(t.x,layout.groundHeight(t.x,t.z),t.z);dummy.scale.setScalar(1);dummy.rotation.set(0,t.yaw,0);dummy.updateMatrix();grassTufts.setMatrixAt(i,dummy.matrix)});
  grassTufts.name='vegetacaoCampo';grassTufts.receiveShadow=true;world.add(grassTufts);
  parent.userData.environmentStats={trees:trees.length,poles:poles.length,...layout.audit};
  return {world,treeBatches,stats:parent.userData.environmentStats};
}
