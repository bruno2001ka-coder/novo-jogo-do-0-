import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import './build.mjs';

const release=JSON.parse(await fs.readFile('dist/release.json','utf8'));
for(const [file,hash] of Object.entries(release.sha256)){
  const bytes=await fs.readFile(`dist/${file}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  if(file.endsWith('.glb'))assert.equal(bytes.subarray(0,4).toString(),'glTF');
}
const base='https://example.test/novo-jogo-do-0-/';
let offline=false,missing=false,activated=false;
const stores=new Map([['other-app',new Map()]]),listeners={};
const key=value=>typeof value==='string'?value:value.url;
async function fetchFile(input){
  if(offline)throw new Error('offline');
  const file=new URL(key(input)).pathname.slice(new URL(base).pathname.length);
  if(missing&&file.endsWith('.webp'))return new Response('',{status:404});
  try{return new Response(await fs.readFile(`dist/${file}`));}catch{return new Response('',{status:404});}
}
const caches={
  async keys(){return [...stores.keys()];},
  async delete(name){return stores.delete(name);},
  async match(input){for(const store of stores.values()){const value=store.get(key(input));if(value)return value.clone();}},
  async open(name){
    if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
    return {
      async put(input,response){store.set(key(input),response.clone());},
      async match(input){return store.get(key(input))?.clone();},
      async addAll(inputs){const responses=await Promise.all(inputs.map(fetchFile));if(responses.some(r=>!r.ok))throw new Error('precache incompleto');inputs.forEach((input,i)=>store.set(key(input),responses[i]));}
    };
  }
};
const context={URL,Request,Response,caches,fetch:fetchFile,self:{location:{href:`${base}sw.js`},addEventListener:(name,fn)=>listeners[name]=fn,skipWaiting:async()=>{activated=true;},clients:{claim:async()=>{}}}};
vm.runInNewContext(await fs.readFile('sw.js','utf8'),context);
async function event(name,request){let pending;listeners[name]({request,waitUntil:p=>pending=p,respondWith:p=>pending=p});return pending;}
missing=true;await assert.rejects(event('install'));assert.equal(activated,false,'pacote incompleto nao pode ativar');
missing=false;await event('install');assert.equal(activated,true);await event('activate');assert.ok(stores.has('other-app'));
offline=true;
const page=await event('fetch',{method:'GET',url:`${base}?build=35`,mode:'navigate'});
assert.ok((await page.text()).includes(`releases/${release.build}/src/main.js`));
for(const file of release.files.filter(f=>f.startsWith('releases/'))){
  const response=await event('fetch',{method:'GET',url:base+file,mode:'cors'});
  assert.ok(response?.ok,`arquivo offline ausente: ${file}`);
}
console.log(JSON.stringify({ok:true,build:release.build,verifiedHashes:Object.keys(release.sha256).length,offlineAssets:release.files.length,atomicInstall:true}));
