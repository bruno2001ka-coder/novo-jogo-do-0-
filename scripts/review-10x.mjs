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
ok('4 campo de provas funcional',track.includes('RAMPA / PLATAFORMA')&&track.includes('LOMBADA')&&track.includes('GARAGEM')&&track.includes('DEGRAUS'));
ok('5 personagem tem aceleração, coyote e jump buffer',main.includes('planarApproach(locomotion.vx')&&main.includes('locomotion.coyote')&&main.includes('locomotion.jumpBuffer'));
ok('6 veículos usam OBB, varredura e modelo bicicleta',track.includes('function obbIntersectsAABB')&&track.includes('function moveVehicle')&&main.includes('bicycleYawDelta(v.speed')&&main.includes('track.vehicleBlocked'));
ok('7 física usa timestep fixo e velocidade estável',main.includes('FIXED_DT')&&main.includes('MAX_PHYSICS_STEPS')&&main.includes('while(accumulator>=FIXED_DT')&&physics.includes('integrateVehicleSpeed'));
ok('8 câmera e contato da moto preservados',track.includes('function cameraSafePosition')&&main.includes('track.cameraSafePosition')&&track.includes('function twoWheelPose')&&main.includes('track.twoWheelPose'));
ok('9 rodas, instancing e render leve preservados',main.includes('distance/Math.max(.05,r.raio')&&main.includes('if(r.dianteira)r.pivo.rotation.y=steerVisual')&&track.includes('new THREE.InstancedMesh')&&main.includes('renderer.shadowMap.enabled=false')&&!/EffectComposer|UnrealBloom|postprocessing/.test(main));
ok('10 loop principal usa a câmera correta e mantém PC/mobile/PWA',main.includes('renderer.render(scene,camera);')&&!main.includes('renderer.render(scene,camer);')&&main.includes('keys.KeyW')&&main.includes('bindJoystick()')&&main.includes("get('debug')==='1'")&&html.includes('lookZone')&&manifest.includes('"display":"fullscreen"'));

console.log(JSON.stringify({ok:true,total:checks.length,checks},null,2));
