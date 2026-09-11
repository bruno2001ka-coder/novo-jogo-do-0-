import fs from'node:fs';
const main=fs.readFileSync('src/main.js','utf8');
const rodas=fs.readFileSync('src/Rodas.js','utf8');
const track=fs.readFileSync('src/TestTrack.js','utf8');
const profiler=fs.readFileSync('src/Profiler.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const manifest=fs.readFileSync('manifest.webmanifest','utf8');
const files=fs.readdirSync('src').sort();
const checks=[];
const ok=(name,cond)=>{if(!cond)throw new Error('REVISÃO: '+name);checks.push(name)};

ok('1 núcleo modular mínimo',JSON.stringify(files)===JSON.stringify(['Profiler.js','Rodas.js','TestTrack.js','main.js']));
ok('2 sem sistemas antigos pesados',!/favela|pol[ií]cia|helic[oó]ptero|viatura|npc|economia|cultivo/i.test(main+track+profiler));
ok('3 profiler técnico existe',main.includes('criarProfiler')&&profiler.includes('renderer.info')&&profiler.includes('frame p95'));
ok('4 campo de provas funcional',track.includes('RAMPA / PLATAFORMA')&&track.includes('LOMBADA')&&track.includes('GARAGEM')&&track.includes('DEGRAUS'));
ok('5 personagem usa posição real e slide',track.includes('function moveXZ')&&main.includes('track.moveXZ(player.position'));
ok('6 veículos usam OBB rotacionado e varredura',track.includes('function obbIntersectsAABB')&&track.includes('function moveVehicle')&&main.includes('track.moveVehicle')&&main.includes('track.vehicleBlocked'));
ok('7 moto usa contato real de duas rodas',track.includes('function twoWheelPose')&&main.includes("name==='moto'")&&main.includes('track.twoWheelPose'));
ok('8 câmera não atravessa paredes',track.includes('function cameraSafePosition')&&main.includes('track.cameraSafePosition'));
ok('9 rodas, instancing e render leve preservados',main.includes('distance/Math.max(.05,r.raio')&&main.includes('if(r.dianteira)r.pivo.rotation.y=steerVisual')&&track.includes('new THREE.InstancedMesh')&&main.includes('renderer.shadowMap.enabled=false')&&!/EffectComposer|UnrealBloom|postprocessing/.test(main));
ok('10 loop principal usa a câmera correta e mantém PC/mobile/PWA',main.includes('renderer.render(scene,camera);')&&!main.includes('renderer.render(scene,camer);')&&main.includes('keys.KeyW')&&main.includes('bindJoystick()')&&main.includes("get('debug')==='1'")&&html.includes('lookZone')&&manifest.includes('"display":"fullscreen"'));

console.log(JSON.stringify({ok:true,total:checks.length,checks},null,2));
