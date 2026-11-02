#!/usr/bin/env node
// Explicit local verification, never publication. Requires a populated npm cache.
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const cache=process.env.A2ASSET_NPM_CACHE;
if(!cache){process.stderr.write('A2ASSET_NPM_CACHE must explicitly name a populated local npm cache.\n');process.exit(5);}
const work=await mkdtemp(join(tmpdir(),'a2asset-package-'));
const evidence={schemaVersion:'1.0.0',status:'FAIL',checks:[],note:'npm offline mode, not OS network isolation; no publication.'};
function run(args,cwd=root,expect=0){const p=spawnSync('npm',args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,env:{...process.env,npm_config_cache:resolve(cache)}});if(p.error||p.status!==expect)throw Error(p.error?.message??`npm exited ${p.status}: ${p.stderr} ${p.stdout}`);return p.stdout;}
try{
 run(['run','build']);
 // A seeded stale artifact must not survive a repeated generated-output build.
 await writeFile(join(root,'dist','__stale__.txt'),'verification sentinel');run(['run','build']);
 const first=JSON.parse(run(['pack','--offline','--ignore-scripts','--json','--pack-destination',work]))[0];
 const second=JSON.parse(run(['pack','--offline','--ignore-scripts','--json','--pack-destination',work]))[0];
 if(first.integrity!==second.integrity||first.files.some(f=>f.path.includes('__stale__')))throw Error('Package drift or stale generated artifact');
 for(const p of ['dist/src/index.js','dist/src/runtime/index.js','dist/schemas/asset-definition.schema.json','dist/src/importer/png-worker.mjs','dist/src/media/worker.mjs','scripts/a2asset.mjs'])if(!first.files.some(f=>f.path===p))throw Error('Missing package file '+p);
 evidence.checks.push({name:'reproducible-complete-package',status:'PASS',integrity:first.integrity});
 const consumer=join(work,'consumer');await mkdir(consumer);await writeFile(join(consumer,'package.json'),'{"private":true,"type":"module"}\n');
 run(['install','--offline','--ignore-scripts',join(work,first.filename)],consumer);
 const script=`import assert from 'node:assert/strict';import {validateContract,buildBundle} from 'a2asset-toolkit';import {createCocosAssetRuntime} from 'a2asset-toolkit/runtime';assert.equal(validateContract('asset-definition',{}).status,'FAIL');assert.equal(typeof buildBundle,'function');assert.equal(typeof createCocosAssetRuntime,'function');`;
 const p=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:consumer,encoding:'utf8',timeout:10000});if(p.error||p.status!==0)throw Error(p.error?.message??p.stderr);
 evidence.checks.push({name:'offline-consumer-exports-schemas',status:'PASS'});evidence.status='PASS';
}catch(e){evidence.error=e instanceof Error?e.message:String(e);process.exitCode=1;}finally{await rm(work,{recursive:true,force:true});process.stdout.write(JSON.stringify(evidence,null,2)+'\n');}
