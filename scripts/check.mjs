import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const commands=readdirSync('src').filter(f=>f.endsWith('.js')).map(f=>['--check',`src/${f}`]);
commands.push(['--check','sw.js'],['scripts/review-10x.mjs'],['scripts/physics-tests.mjs'],['--loader','./scripts/test-loader.mjs','scripts/layout-tests.mjs'],['--loader','./scripts/test-loader.mjs','scripts/world-tests.mjs']);
commands.push(['scripts/release-tests.mjs']);
for(const args of commands){const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
