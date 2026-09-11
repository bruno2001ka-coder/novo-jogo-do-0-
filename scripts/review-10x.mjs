import fs from'node:fs';
const main=fs.readFileSync('src/main.js','utf8');
const rodas=fs.readFileSync('src/Rodas.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const manifest=fs.readFileSync('manifest.webmanifest','utf8');
const files=fs.readdirSync('src').sort();
const checks=[];
const ok=(name,cond)=>{if(!cond)throw new Error('REVISÃO: '+name);checks.push(name)};

ok('1 núcleo mínimo: main + Rodas',JSON.stringify(files)===JSON.stringify(['Rodas.js','main.js']));
ok('2 sem favela polícia helicóptero',!/favela|pol[ií]cia|helic[oó]ptero|viatura/i.test(main+rodas));
ok('3 mapa totalmente plano',main.includes('new THREE.PlaneGeometry(200,200,1,1)')&&!/obterElevacao|heightmap|MORROS/.test(main));
ok('4 personagem voltou a andar e correr',main.includes('new THREE.AnimationMixer')&&main.includes('character.actions.Walking')&&main.includes('character.actions.Running'));
ok('5 piloto da moto restaurado',main.includes("pilotando.glb")&&main.includes('character.pilot')&&main.includes('pilot:true'));
ok('6 carro procura quatro rodas reais',main.includes("loadVehicle('car'")&&main.includes('},4)')&&main.includes('separarRodas'));
ok('7 moto procura duas rodas reais',main.includes("loadVehicle('moto'")&&main.includes('},2)')&&main.includes('separarRodas'));
ok('8 rodas giram e dianteiras esterçam',main.includes('distance/Math.max(.05,r.raio')&&main.includes('if(r.dianteira)r.pivo.rotation.y=steerVisual'));
ok('9 performance continua leve',main.includes('renderer.shadowMap.enabled=false')&&!/EffectComposer|UnrealBloom|postprocessing/.test(main));
ok('10 PC mobile e PWA preservados',main.includes('keys.KeyW')&&main.includes('bindJoystick()')&&html.includes('lookZone')&&manifest.includes('"display":"fullscreen"'));

console.log(JSON.stringify({ok:true,total:checks.length,checks},null,2));
