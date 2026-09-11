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
ok('5 colisão simples com slide',track.includes('function moveXZ')&&track.includes('blocked')&&main.includes('track.moveXZ'));
ok('6 terreno de teste afeta personagem e veículos',main.includes('track.groundHeight')&&main.includes('track.terrainPose'));
ok('7 rodas continuam físicas visuais',main.includes('distance/Math.max(.05,r.raio')&&main.includes('if(r.dianteira)r.pivo.rotation.y=steerVisual'));
ok('8 slalom usa instancing',track.includes('new THREE.InstancedMesh'));
ok('9 render continua sem sombra/pós pesado',main.includes('renderer.shadowMap.enabled=false')&&!/EffectComposer|UnrealBloom|postprocessing/.test(main));
ok('10 PC mobile PWA e debug por URL',main.includes('keys.KeyW')&&main.includes('bindJoystick()')&&main.includes("get('debug')==='1'")&&html.includes('lookZone')&&manifest.includes('"display":"fullscreen"'));

console.log(JSON.stringify({ok:true,total:checks.length,checks},null,2));
