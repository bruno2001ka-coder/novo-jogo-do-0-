import * as THREE from 'three';
import '../vendor/polygon-clipping.umd.js';

const clip=globalThis.polygonClipping;
export const BUILD='37';
export const LOT={x0:-44,x1:-22,z0:24,z1:46};
export const SPAWN={player:{x:-11.5,z:18},car:{x:-8,z:16},moto:{x:-8,z:20.5}};
export const rect=(x0,z0,x1,z1)=>[[[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]]];
export const area=multi=>multi.reduce((total,poly)=>total+poly.reduce((sum,ring,i)=>{
  const a=Math.abs(ring.slice(1).reduce((v,p,j)=>v+ring[j][0]*p[1]-p[0]*ring[j][1],0))/2;
  return sum+(i===0?a:-a);
},0),0);
const insideRect=(x,z,r,pad=0)=>x>=r.x0-pad&&x<=r.x1+pad&&z>=r.z0-pad&&z<=r.z1+pad;
function circle(x,z,r){const points=Array.from({length:24},(_,i)=>[x+Math.cos(i*Math.PI/12)*r,z+Math.sin(i*Math.PI/12)*r]);return [[...points,points[0]]]}
const road=(id,points,{width=6.4,rural=false,closed=false,curved=false,sidewalks=!rural,markings=!rural}={})=>({id,points,width,type:rural?'cascalho':'asfalto',sidewalks,closed,curved,markings});

export const ROAD_NETWORK=[
  road('rua-central',[[0,-220],[0,-60],[0,8],[0,75],[0,150],[0,220]],{width:7}),
  road('rua-da-casa',[[-85,8],[0,8],[90,8]]),
  road('rua-dos-ipes',[[-85,75],[0,75],[90,75]]),
  road('rua-do-campo',[[-85,150],[0,150],[90,150]]),
  road('rua-oeste',[[-85,8],[-85,75],[-85,150]]),
  road('rua-leste',[[90,-60],[90,8],[90,75],[90,150]]),
  road('avenida-sul',[[0,-60],[90,-60],[145,-90],[180,-150],[220,-180]],{curved:true,width:7}),
  road('anel-bairro',[[0,-220],[180,-220],[220,-180],[220,0],[220,180],[180,220],[0,220],[-180,220],[-220,180],[-220,0],[-220,-180],[-180,-220]],{curved:true,closed:true,width:7.2,sidewalks:false}),
  road('acesso-casa',[[-21.8,26.35],[-12,26.35],[0,26.35]],{width:4.8,sidewalks:false,markings:false}),
  road('estacionamento',[[-7.8,8],[-7.8,24.5]],{width:5.4,sidewalks:false,markings:false}),
  road('anel-rural',[[0,-445],[300,-430],[445,-300],[455,0],[440,260],[300,420],[0,450],[-300,420],[-445,280],[-455,0],[-445,-300],[-300,-430]],{rural:true,closed:true,curved:true,width:7}),
  road('ligacao-sul',[[0,-220],[0,-285],[0,-365],[0,-445]],{rural:true,width:6}),
  road('ligacao-leste',[[220,0],[290,0],[370,0],[455,0]],{rural:true,width:6}),
  road('ligacao-oeste',[[-220,0],[-300,0],[-380,0],[-455,0]],{rural:true,width:6}),
  road('ligacao-norte',[[0,220],[0,290],[0,375],[0,450]],{rural:true,width:6}),
];

function roadSamples(r){
  if(r.curved){
    const curve=new THREE.CatmullRomCurve3(r.points.map(([x,z])=>new THREE.Vector3(x,0,z)),r.closed,'centripetal',.4);
    return curve.getSpacedPoints(Math.ceil(curve.getLength()/2)).map(p=>[p.x,p.z]);
  }
  const result=[];
  for(let i=1;i<r.points.length;i++){
    const a=r.points[i-1],b=r.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
    for(let j=0;j<n;j++)result.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);
  }
  result.push(r.points.at(-1));return result;
}
function ribbon(samples,half,closed){
  const left=[],right=[],count=samples.length;
  for(let i=0;i<count;i++){
    const a=samples[i===0?(closed?count-2:0):i-1],b=samples[i===count-1?(closed?1:count-1):i+1];
    const len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len,p=samples[i];
    left.push([p[0]+nx*half,p[1]+nz*half]);right.push([p[0]-nx*half,p[1]-nz*half]);
  }
  if(closed){left[left.length-1]=left[0];right[right.length-1]=right[0];return [left,right.reverse()]}
  const ring=[...left,...right.reverse()];ring.push(ring[0]);return [ring];
}
const union=items=>items.length?clip.union(...items):[];
export function trianglesFor(polygons){
  const result=[];
  for(const polygon of polygons){
    const rings=polygon.map(r=>r.slice(0,-1).map(([x,z])=>new THREE.Vector2(x,z)));
    const vertices=rings.flat(),indices=THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1));
    for(const face of indices)result.push(face.map(i=>[vertices[i].x,vertices[i].y]));
  }
  return result;
}
const cellKey=(x,z)=>`${Math.floor(x/16)},${Math.floor(z/16)}`;
export function createLayout(){
  const roads=ROAD_NETWORK.map(r=>({...r,samples:roadSamples(r)}));
  const junctionMap=new Map();
  for(const r of roads.filter(r=>r.markings))for(const p of r.points){
    const key=p.join(',');const j=junctionMap.get(key)||{x:p[0],z:p[1],roads:[],radius:0};j.roads.push(r.id);j.radius=Math.max(j.radius,r.width/2+1.4);junctionMap.set(key,j);
  }
  const junctions=[...junctionMap.values()].filter(j=>j.roads.length>1);
  const protectedLot=rect(LOT.x0-.6,LOT.z0-.6,LOT.x1+.6,LOT.z1+.6);
  const publicShapes=roads.filter(r=>r.id!=='acesso-casa').map(r=>ribbon(r.samples,r.width/2,r.closed));
  const violations=area(clip.intersection(union(publicShapes),protectedLot));
  if(violations>.001)throw new Error(`Public road overlaps protected house by ${violations.toFixed(2)} m2`);
  const paved=union([...roads.filter(r=>r.type==='asfalto').map(r=>ribbon(r.samples,r.width/2,r.closed)),...junctions.map(j=>circle(j.x,j.z,j.radius))]);
  const rural=clip.difference(union(roads.filter(r=>r.type==='cascalho').map(r=>ribbon(r.samples,r.width/2,r.closed))),paved);
  const drivable=clip.union(paved,rural);
  const urban=roads.filter(r=>r.sidewalks);
  const inner=union([...urban.map(r=>ribbon(r.samples,r.width/2+.22,r.closed)),...junctions.map(j=>circle(j.x,j.z,j.radius+.22))]);
  const outer=union([...urban.map(r=>ribbon(r.samples,r.width/2+2.5,r.closed)),...junctions.map(j=>circle(j.x,j.z,j.radius+2.5))]);
  const sidewalks=clip.difference(clip.union(outer,rect(-13.5,12,-10.5,24.5)),inner,drivable,protectedLot);
  const curbs=clip.difference(inner,drivable,protectedLot);
  const shoulders=clip.difference(union(roads.filter(r=>!r.sidewalks).map(r=>ribbon(r.samples,r.width/2+1.1,r.closed))),drivable,outer,protectedLot);
  const sidewalkTriangles=trianglesFor(sidewalks),curbTriangles=trianglesFor(curbs);
  const layers=[{name:'asphalt',height:.045,polygons:paved},{name:'gravel',height:.04,polygons:rural},{name:'sidewalk',height:.165,polygons:sidewalks,triangles:sidewalkTriangles},{name:'curb',height:.165,polygons:curbs,triangles:curbTriangles},{name:'shoulder',height:.012,polygons:shoulders}];
  const cells=new Map();
  for(const layer of layers){
    layer.triangles??=trianglesFor(layer.polygons);
    for(const points of layer.triangles){
      const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
      for(let x=Math.floor(Math.min(...xs)/16);x<=Math.floor(Math.max(...xs)/16);x++)for(let z=Math.floor(Math.min(...zs)/16);z<=Math.floor(Math.max(...zs)/16);z++){
        const key=`${x},${z}`,arr=cells.get(key)||[];arr.push({points,layer});cells.set(key,arr);
      }
    }
  }
  function surfaceAt(x,z){
    for(const {points:[a,b,c],layer} of cells.get(cellKey(x,z))||[]){
      const cross=(p,q)=>(q[0]-p[0])*(z-p[1])-(q[1]-p[1])*(x-p[0]);
      const d=[cross(a,b),cross(b,c),cross(c,a)];
      if(d.every(v=>v>=-1e-7)||d.every(v=>v<=1e-7))return layer;
    }
    return null;
  }
  const segments=new Map();
  for(const r of roads)for(let i=1;i<r.samples.length;i++){
    const a=r.samples[i-1],b=r.samples[i],margin=22;
    for(let x=Math.floor((Math.min(a[0],b[0])-margin)/16);x<=Math.floor((Math.max(a[0],b[0])+margin)/16);x++)for(let z=Math.floor((Math.min(a[1],b[1])-margin)/16);z<=Math.floor((Math.max(a[1],b[1])+margin)/16);z++){
      const key=`${x},${z}`,arr=segments.get(key)||[];arr.push({a,b,r});segments.set(key,arr);
    }
  }
  function nearestRoad(x,z,exclude){
    let distance=Infinity,road=null;
    for(const {a,b,r} of segments.get(cellKey(x,z))||[]){
      if(r.id===exclude)continue;
      const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
      const d=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)-r.width/2;
      if(d<distance){distance=d;road=r}
    }
    return {distance,road};
  }
  function rawGround(x,z){
    const d=nearestRoad(x,z).distance;
    const taper=THREE.MathUtils.smoothstep(d,5,20)*THREE.MathUtils.smoothstep(Math.hypot(x,z),100,260);
    return taper*(1.5+1.7*Math.sin(x*.021)*Math.cos(z*.017)+.6*Math.sin((x+z)*.041));
  }
  // The mesh and collision sampler share the same triangulated four-metre grid.
  const step=4,n=251,heights=new Float32Array(n*n);
  for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++)heights[iz*n+ix]=rawGround(ix*step-500,iz*step-500);
  function terrainHeight(x,z){
    const gx=THREE.MathUtils.clamp((x+500)/step,0,n-1.00001),gz=THREE.MathUtils.clamp((z+500)/step,0,n-1.00001),ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz;
    const a=heights[iz*n+ix],b=heights[iz*n+ix+1],c=heights[(iz+1)*n+ix],d=heights[(iz+1)*n+ix+1];
    return tx+tz<=1?a+(b-a)*tx+(c-a)*tz:d+(c-d)*(1-tx)+(b-d)*(1-tz);
  }
  const groundHeight=(x,z)=>surfaceAt(x,z)?.height??(insideRect(x,z,LOT)? .045:terrainHeight(x,z));
  const occupied=[];
  function placeAllowed(x,z,radius){
    if(insideRect(x,z,LOT,3+radius)||insideRect(x,z,{x0:-24,x1:7,z0:3,z1:34},radius))return false;
    if(Math.abs(x)+radius>487||Math.abs(z)+radius>487)return false;
    if(nearestRoad(x,z).distance<radius+2.8)return false;
    if(junctions.some(j=>Math.hypot(x-j.x,z-j.z)<j.radius+radius+9))return false;
    if(occupied.some(p=>Math.hypot(x-p.x,z-p.z)<radius+p.radius+1))return false;
    occupied.push({x,z,radius});return true;
  }
  return {roads,junctions,layers,surfaceAt,nearestRoad,terrainHeight,groundHeight,heights,gridSize:n,gridStep:step,placeAllowed,occupied,audit:{houseOverlapM2:violations,roadCount:roads.length},insideRect};
}
