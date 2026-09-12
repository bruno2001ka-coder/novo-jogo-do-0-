import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const source=await fs.readFile('src/WorldLayout.js','utf8');
const build=source.match(/export const BUILD='(\d+)'/)[1];
const release=`releases/${build}`;
const out=path.resolve('dist');
await fs.mkdir(out,{recursive:true});
const files=[];
async function copyTree(directory){
  for(const item of await fs.readdir(directory,{withFileTypes:true})){
    const file=`${directory}/${item.name}`;
    if(item.isDirectory()){await copyTree(file);continue;}
    if(file.endsWith('.jpg'))continue;
    const target=`${release}/${file}`;
    await fs.mkdir(path.dirname(path.join(out,target)),{recursive:true});
    await fs.copyFile(file,path.join(out,target));files.push(target);
  }
}
for(const folder of ['src','vendor','assets'])await copyTree(folder);
for(const file of ['manifest.webmanifest','icon.svg']){await fs.copyFile(file,path.join(out,file));files.push(file);}
let html=await fs.readFile('index.html','utf8');
html=html.replaceAll('./vendor/',`./${release}/vendor/`).replace('./src/main.js',`./${release}/src/main.js`);
await fs.writeFile(path.join(out,'index.html'),html);
await fs.copyFile('sw.js',path.join(out,'sw.js'));
await fs.writeFile(path.join(out,'.nojekyll'),'');
const hashes={};
for(const file of [...files,'index.html','sw.js'])hashes[file]=createHash('sha256').update(await fs.readFile(path.join(out,file))).digest('hex');
await fs.writeFile(path.join(out,'release.json'),JSON.stringify({build,files,sha256:hashes},null,2));
console.log(`Build ${build}: ${files.length} arquivos locais em ${out}`);
