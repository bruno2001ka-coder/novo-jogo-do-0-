import fs from'node:fs';
const main=fs.readFileSync('src/main.js','utf8');
const rodas=fs.readFileSync('src/Rodas.js','utf8');
const track=fs.readFileSync('src/TestTrack.js','utf8');
const profiler=fs.readFileSync('src/Profiler.js','utf8');
const physics=fs.readFileSync('src/GamePhysics.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const manifest=fs.readFileSync('manifest.webmanifest','utf8');
const files=fs.readdirSync('src').sort();
const checks=[];
const ok=(name,cond)=>{if(!cond)throw new Error('REVISÃO: '+name);checks.push(name)};

ok('1 núcleo modular mínimo',JSON.stringify(files)===JSON.stringify(['GamePhysics.js','Profiler.js','Rodas.js','TestTrack.js','main.js']));
ok('2 sem sistemas antigos pesados',!/favela|pol[ií]cia|helic[oó]ptero|viatura|npc|economia|cultivo/i.test(main+track+profiler));
ok('3 profiler técnico existe',main.includes('criarProfiler')&&profiler.includes('renderer.info')&&profiler.includes('frame p95'));
ok('4 campo de provas e grade original presentes',track.includes('RAMPA / PLATAFORMA')&&track.includes('LOMBADA')&&track.includes('GARAGEM')&&track.includes('DEGRAUS')&&track.includes('const baseGrid=new THREE.GridHelper(200,100,0x506246,0x596d4c)'));
ok('5 personagem arcade sempre em pé',main.includes('planarApproach(locomotion.vx')&&main.includes('player.rotation.x=0')&&main.includes('player.rotation.z=0')&&main.includes('groundClampY(player.position.y'));
ok('6 direção arcade sem giro residual',track.includes('function obbIntersectsAABB')&&track.includes('function moveVehicle')&&track.includes('function vehicleTurnAllowed')&&main.includes('arcadeTurnDelta')&&!main.includes('stabilizeYawRate')&&!main.includes('bicycleYawRate'));
ok('7 física fixa com interpolação visual',main.includes('FIXED_DT')&&main.includes('MAX_PHYSICS_STEPS')&&main.includes('while(accumulator>=FIXED_DT')&&main.includes('applyRenderInterpolation(renderAlpha)')&&main.includes('restorePhysicsTransforms()')&&physics.includes('integrateVehicleSpeed'));
ok('8 travas arcade de pitch roll e solo',track.includes('function cameraSafePosition')&&main.includes('track.cameraSafePosition')&&main.includes('clampPitch')&&main.includes('clampLean')&&main.includes('enforceArcadeLocks()')&&main.includes('car.rotation.z=0'));
ok('9 rodas, instancing e render leve preservados',main.includes('distance/Math.max(.05,r.raio')&&main.includes('if(r.dianteira)r.pivo.rotation.y=steerVisual')&&track.includes('new THREE.InstancedMesh')&&main.includes('renderer.shadowMap.enabled=false')&&!/EffectComposer|UnrealBloom|postprocessing/.test(main));
ok('10 loop principal usa a câmera correta e mantém PC/mobile/PWA',main.includes('renderer.render(scene,camera);')&&!main.includes('renderer.render(scene,camer);')&&main.includes('keys.KeyW')&&main.includes('bindJoystick()')&&main.includes("get('debug')==='1'")&&html.includes('lookZone')&&manifest.includes('"display":"fullscreen"'));

console.log(JSON.stringify({ok:true,total:checks.length,checks},null,2));
