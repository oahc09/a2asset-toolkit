import {spawnSync} from 'node:child_process';import {cp,mkdir} from 'node:fs/promises';
const p=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.build.json'],{stdio:'inherit'});if(p.status!==0)process.exit(p.status??1);
await mkdir('dist/schemas',{recursive:true});await cp('schemas','dist/schemas',{recursive:true});

await cp('src/importer/png-worker.mjs','dist/src/importer/png-worker.mjs');
