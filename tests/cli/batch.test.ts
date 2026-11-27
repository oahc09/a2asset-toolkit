import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,existsSync} from 'node:fs';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const bin=resolve('scripts/a2asset.mjs');
test('compiled batch CLI imports relative paths, reports per-job failure and never approves',()=>{
 const root=mkdtempSync(join(tmpdir(),'a2asset-batch-cli-'));try{
 const source=join(root,'source');mkdirSync(source);const bytes=readFileSync('examples/m0-runtime/assets/player.png');writeFileSync(join(source,'player.png'),bytes);writeFileSync(join(source,'license.txt'),'SYNTHETIC TEST ONLY, NOT PRODUCTION APPROVAL');
 const d=JSON.parse(readFileSync('examples/asset-definition-UNPUBLISHABLE.json','utf8'));d.approvalStatus='imported';d.geometry.pixelSize=[32,32];d.sources=[{path:'player.png',mediaType:'image/png',sha256:createHash('sha256').update(bytes).digest('hex')}];d.provenance.licenseEvidencePath='license.txt';
 const batch=join(root,'batch.json'),registry=join(root,'registry');writeFileSync(batch,JSON.stringify({jobs:[{id:'first',path:'source',definition:d},{id:'bad',path:'missing',definition:d},{id:'later',path:'source',definition:d}]}));
 const p=spawnSync(process.execPath,[bin,'import-batch',batch,'--registry',registry],{encoding:'utf8',timeout:15000});assert.notEqual(p.status,0,p.stderr);const r=JSON.parse(p.stdout);assert.deepEqual(r.items.map((x:any)=>x.outcome),['IMPORTED','FAILED','NOT_RUN']);assert.equal(r.items[0].state,'inspected');assert.equal(r.summary.imported,1);
 const q=spawnSync(process.execPath,[bin,'registry','list','--registry',registry],{encoding:'utf8',timeout:10000});assert.equal(q.status,0,q.stderr);assert.equal(JSON.parse(q.stdout).records[0].state,'inspected');
 writeFileSync(batch,JSON.stringify({jobs:[{id:'a',path:'source',definition:d}],approve:true}));const invalidRegistry=join(root,'never-created');const invalid=spawnSync(process.execPath,[bin,'import-batch',batch,'--registry',invalidRegistry],{encoding:'utf8',timeout:10000});assert.equal(invalid.status,2);assert.equal(existsSync(invalidRegistry),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
