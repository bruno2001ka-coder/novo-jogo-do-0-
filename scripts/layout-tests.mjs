import assert from 'node:assert/strict';
import {createLayout,LOT,SPAWN} from '../src/WorldLayout.js';
const start=performance.now();
const layout=createLayout();
assert.equal(layout.audit.houseOverlapM2,0);
assert.equal(layout.roads.length,15);
for(let x=LOT.x0+.5;x<LOT.x1-.5;x+=.5)for(let z=LOT.z0+.5;z<LOT.z1-.5;z+=.5){
  assert.equal(layout.surfaceAt(x,z),null,`Public surface inside house at ${x},${z}`);
}
for(const r of layout.roads){
  for(const [x,z] of r.samples){
    const surface=layout.surfaceAt(x,z);
    assert.ok(surface&&['asphalt','gravel'].includes(surface.name),`Broken road ${r.id}: ${x},${z}`);
    assert.ok(Number.isFinite(layout.groundHeight(x,z)));
  }
  if(r.id.startsWith('ligacao-'))for(const [x,z] of [r.samples[0],r.samples.at(-1)]){
    assert.ok(layout.nearestRoad(x,z,r.id).distance<=0,`Disconnected ${r.id}`);
  }
}
for(const [name,p] of Object.entries(SPAWN)){
  assert.ok(Number.isFinite(layout.groundHeight(p.x,p.z)));
  assert.equal(layout.placeAllowed(p.x,p.z,1),false,`Spawn obstructable: ${name}`);
}
assert.equal(layout.placeAllowed(-26,31,2),false);
assert.equal(layout.placeAllowed(0,75,2),false);
assert.equal(layout.surfaceAt(0,75).name,'asphalt');
console.log(JSON.stringify({ok:true,...layout.audit,triangles:layout.layers.map(l=>({surface:l.name,count:l.triangles.length})),timeMs:Math.round(performance.now()-start)},null,2));
