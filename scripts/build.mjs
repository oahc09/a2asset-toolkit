import {spawnSync} from 'node:child_process';import {cp,mkdir,rm} from 'node:fs/promises';
// dist is exclusively generated output; prevent stale modules entering a later package.
await rm('dist',{recursive:true,force:true});
const p=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.build.json'],{stdio:'inherit'});if(p.status!==0)process.exit(p.status??1);
await mkdir('dist/schemas',{recursive:true});await cp('schemas','dist/schemas',{recursive:true});

await cp('src/importer/png-worker.mjs','dist/src/importer/png-worker.mjs');

await mkdir('dist/src/media',{recursive:true});await cp('src/media/worker.mjs','dist/src/media/worker.mjs');
